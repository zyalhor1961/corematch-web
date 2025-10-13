import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, verifyAuthAndOrgAccess } from '@/lib/auth/middleware';

// Use Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/idp/upload
 *
 * Upload a document using native FormData API (Vercel-compatible)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload request received');
    console.log('Content-Type:', request.headers.get('content-type'));

    const { user, error } = await verifyAuth(request);

    if (!user || error) {
      return NextResponse.json(
        { error: error ?? 'Authentication required' },
        { status: 401 }
      );
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing');
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_URL not set' },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'Server configuration error: SERVICE_ROLE_KEY not set' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    console.log('✅ Supabase client created');

    // Parse FormData (native API - works better with Vercel)
    console.log('📝 Parsing form data...');
    const formData = await request.formData();

    // Extract fields
    const file = formData.get('file') as File | null;
    const orgId = formData.get('orgId') as string | null;
    const userIdRaw = formData.get('userId') as string | null;
    const documentType = (formData.get('documentType') as string) || 'general';

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const hasAccess = await verifyAuthAndOrgAccess(user, orgId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Validate userId is a proper UUID or set to null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userId = userIdRaw && uuidRegex.test(userIdRaw) ? userIdRaw : null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    console.log('File:', file.name, file.size, file.type);
    console.log('OrgId:', orgId);
    console.log('DocumentType:', documentType);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    const storagePath = `${orgId}/${filename}`;

    // Upload to Supabase Storage
    console.log('📦 Uploading to storage:', storagePath);

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('idp-documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/pdf',
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

    // Get signed URL (valid for 1 hour)
    console.log('🔗 Creating signed URL for Azure access...');
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('idp-documents')
      .createSignedUrl(storagePath, 3600);

    if (urlError || !urlData) {
      console.error('❌ Failed to create signed URL:', urlError);
      return NextResponse.json(
        { error: 'Failed to create signed URL', details: urlError?.message },
        { status: 500 }
      );
    }

    console.log('✅ Signed URL created');

    // Get public URL for display
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
        mime_type: file.type || 'application/pdf',
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
        filename: file.name,
        file_size: file.size,
        document_type: documentType,
      },
    });

    // Trigger Azure analysis (don't block on this)
    console.log('🔍 Triggering Azure analysis...');
    let analyzing = false;
    let analysisError = null;

    try {
      const analyzeResponse = await fetch(`${request.nextUrl.origin}/api/idp/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrl: urlData.signedUrl,
          documentId: document.id,
          orgId: orgId,
          filename: file.name,
          documentType: documentType,
          autoDetect: true,
        }),
      });

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.error('❌ Analysis failed:', errorText);
        analysisError = errorText;

        await supabase
          .from('idp_documents')
          .update({
            status: 'failed',
            processing_notes: `Azure analysis failed: ${errorText.substring(0, 500)}`
          })
          .eq('id', document.id);
      } else {
        analyzing = true;
        console.log('✅ Analysis started successfully');
      }
    } catch (analysisErr: any) {
      console.error('❌ Analysis trigger error:', analysisErr);
      analysisError = analysisErr.message;

      await supabase
        .from('idp_documents')
        .update({
          status: 'failed',
          processing_notes: `Analysis error: ${analysisErr.message}`
        })
        .eq('id', document.id);
    }

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        analyzing,
        analysisError,
      },
      message: analyzing
        ? 'Document uploaded and analysis started'
        : 'Document uploaded but analysis failed - check logs'
    });
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({
      error: error.message || 'Upload failed',
      details: error.stack
    }, { status: 500 });
  }
}
