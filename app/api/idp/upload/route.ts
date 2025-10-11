import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Busboy from 'busboy';
import { Readable } from 'stream';

// Use Node.js runtime for better FormData support
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Parse multipart/form-data using busboy
 */
async function parseMultipartForm(request: NextRequest): Promise<{
  fields: Record<string, string>;
  files: Array<{
    fieldname: string;
    filename: string;
    mimetype: string;
    buffer: Buffer;
  }>;
}> {
  return new Promise(async (resolve, reject) => {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return reject(new Error('Content-Type must be multipart/form-data'));
    }

    const fields: Record<string, string> = {};
    const files: Array<{
      fieldname: string;
      filename: string;
      mimetype: string;
      buffer: Buffer;
    }> = [];

    const busboy = Busboy({ headers: { 'content-type': contentType } });

    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];

      file.on('data', (chunk) => {
        chunks.push(chunk);
      });

      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          mimetype: mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    busboy.on('finish', () => {
      resolve({ fields, files });
    });

    busboy.on('error', (error) => {
      reject(error);
    });

    // Convert Web ReadableStream to Node.js Readable
    const reader = request.body?.getReader();
    if (!reader) {
      return reject(new Error('No request body'));
    }

    const nodeStream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    nodeStream.pipe(busboy);
  });
}

/**
 * POST /api/idp/upload
 *
 * Upload a document and save to database, then trigger Azure analysis
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log('📤 Upload request received');
    console.log('Content-Type:', request.headers.get('content-type'));

    // Parse multipart form data
    const { fields, files } = await parseMultipartForm(request);

    // Extract fields
    const orgId = fields.orgId;
    const userId = fields.userId;
    const documentType = fields.documentType || 'general';

    // Extract file
    const uploadedFile = files.find((f) => f.fieldname === 'file');

    if (!uploadedFile || !orgId) {
      return NextResponse.json(
        { error: 'File and orgId are required' },
        { status: 400 }
      );
    }

    console.log('File:', uploadedFile.filename, uploadedFile.buffer.length, uploadedFile.mimetype);
    console.log('OrgId:', orgId);
    console.log('DocumentType:', documentType);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = uploadedFile.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    const storagePath = `${orgId}/${filename}`;

    // Upload to Supabase Storage
    console.log('📦 Uploading to storage:', storagePath);

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('idp-documents')
      .upload(storagePath, uploadedFile.buffer, {
        contentType: uploadedFile.mimetype || 'application/pdf',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage', details: uploadError.message },
        { status: 500 }
      );
    }

    console.log('✅ File uploaded to storage');

    // Get signed URL (valid for 1 hour) - required for Azure Document Intelligence
    console.log('🔗 Creating signed URL for Azure access...');
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('idp-documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (urlError || !urlData) {
      console.error('❌ Failed to create signed URL:', urlError);
      return NextResponse.json(
        { error: 'Failed to create signed URL', details: urlError?.message },
        { status: 500 }
      );
    }

    console.log('✅ Signed URL created');

    // Also get public URL for display
    const { data: publicUrlData } = supabase
      .storage
      .from('idp-documents')
      .getPublicUrl(storagePath);

    // Create document record in database
    console.log('💾 Creating document record in database...');

    const { data: document, error: dbError } = await supabase
      .from('idp_documents')
      .insert({
        org_id: orgId,
        filename: filename,
        original_filename: uploadedFile.filename,
        file_size_bytes: uploadedFile.buffer.length,
        mime_type: uploadedFile.mimetype || 'application/pdf',
        document_type: documentType,
        storage_bucket: 'idp-documents',
        storage_path: storagePath,
        storage_url: publicUrlData.publicUrl,
        status: 'uploaded',
        created_by: userId || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create document record', details: dbError.message },
        { status: 500 }
      );
    }

    console.log('✅ Document record created:', document.id);

    // Log audit trail
    await supabase.from('idp_audit_log').insert({
      org_id: orgId,
      document_id: document.id,
      action: 'document_uploaded',
      action_category: 'document',
      user_id: userId || null,
      metadata: {
        filename: uploadedFile.filename,
        file_size: uploadedFile.buffer.length,
        document_type: documentType,
      },
    });

    // Trigger Azure analysis with signed URL
    console.log('🔍 Triggering Azure analysis...');
    const analyzeResponse = await fetch(`${request.nextUrl.origin}/api/idp/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUrl: urlData.signedUrl, // Use signed URL for Azure access
        documentId: document.id,
        orgId: orgId,
        filename: uploadedFile.filename,
        documentType: documentType,
        autoDetect: true,
      }),
    });

    if (!analyzeResponse.ok) {
      console.error('Analysis failed:', await analyzeResponse.text());
      // Mark document as failed
      await supabase
        .from('idp_documents')
        .update({ status: 'failed', processing_notes: 'Azure analysis failed' })
        .eq('id', document.id);
    }

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        analyzing: analyzeResponse.ok,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
