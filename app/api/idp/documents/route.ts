import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

/**
 * GET /api/idp/documents
 *
 * List all IDP documents for an organization with filtering
 *
 * Query params:
 * - orgId: Organization ID (required)
 * - status: Filter by status
 * - documentType: Filter by document type
 * - limit: Number of results (default 100)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status');
    const documentType = searchParams.get('documentType');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('idp_documents')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });
  } catch (error: any) {
    console.error('Error in documents API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/idp/documents
 *
 * Create a new IDP document record (before uploading file)
 *
 * Body:
 * - orgId: Organization ID
 * - filename: Document filename
 * - originalFilename: Original filename
 * - fileSize: File size in bytes
 * - mimeType: MIME type
 * - documentType: Document type
 * - storagePath: Path in storage
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const {
      orgId,
      filename,
      originalFilename,
      fileSize,
      mimeType,
      documentType = 'general',
      storagePath,
      userId
    } = body;

    if (!orgId || !filename || !originalFilename || !fileSize || !mimeType || !storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create document record
    const { data, error } = await supabase
      .from('idp_documents')
      .insert({
        org_id: orgId,
        filename,
        original_filename: originalFilename,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        document_type: documentType,
        storage_bucket: 'idp-documents',
        storage_path: storagePath,
        status: 'uploaded',
        created_by: userId || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Log audit trail
    await supabase
      .from('idp_audit_log')
      .insert({
        org_id: orgId,
        document_id: data.id,
        action: 'document_uploaded',
        action_category: 'document',
        user_id: userId || null,
        metadata: {
          filename,
          file_size: fileSize,
          document_type: documentType
        }
      });

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error in create document API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/idp/documents?id=xxx
 *
 * Soft delete a document
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Soft delete
    const { data, error } = await supabase
      .from('idp_documents')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId || null
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    // Log audit trail
    if (data) {
      await supabase
        .from('idp_audit_log')
        .insert({
          org_id: data.org_id,
          document_id: documentId,
          action: 'document_deleted',
          action_category: 'document',
          user_id: userId || null
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
    console.error('Error in delete document API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
