import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use Node.js runtime for better FormData support
export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orgId = formData.get('orgId') as string;
    const userId = formData.get('userId') as string;
    const documentType = formData.get('documentType') as string || 'general';

    console.log('File:', file?.name, file?.size, file?.type);
    console.log('OrgId:', orgId);
    console.log('DocumentType:', documentType);

    if (!file || !orgId) {
      return NextResponse.json(
        { error: 'File and orgId are required' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    const storagePath = `${orgId}/${filename}`;

    // Convert File to Buffer for Supabase storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    console.log('📦 Uploading to storage:', storagePath);

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('idp-documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600'
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
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        document_type: documentType,
        storage_bucket: 'idp-documents',
        storage_path: storagePath,
        storage_url: publicUrlData.publicUrl,
        status: 'uploaded',
        created_by: userId || null
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
    await supabase
      .from('idp_audit_log')
      .insert({
        org_id: orgId,
        document_id: document.id,
        action: 'document_uploaded',
        action_category: 'document',
        user_id: userId || null,
        metadata: {
          filename: file.name,
          file_size: file.size,
          document_type: documentType
        }
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
        filename: file.name,
        documentType: documentType,
        autoDetect: true
      })
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
        analyzing: analyzeResponse.ok
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
