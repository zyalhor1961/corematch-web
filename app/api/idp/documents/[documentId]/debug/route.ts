import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * GET /api/idp/documents/[documentId]/debug
 *
 * Get detailed debug information about a document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get extracted fields count
    const { count: fieldsCount } = await supabase
      .from('idp_extracted_fields')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);

    // Get some sample fields
    const { data: sampleFields } = await supabase
      .from('idp_extracted_fields')
      .select('field_name, value_text, confidence')
      .eq('document_id', documentId)
      .limit(10);

    // Get audit log
    const { data: auditLog } = await supabase
      .from('idp_audit_log')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        extracted_fields_count: fieldsCount || 0
      },
      sample_fields: sampleFields || [],
      audit_log: auditLog || [],
      diagnostics: {
        has_storage_path: !!document.storage_path,
        has_invoice_number: !!document.invoice_number,
        has_vendor_name: !!document.vendor_name,
        has_total_amount: !!document.total_amount,
        status: document.status,
        processing_notes: document.processing_notes,
        created_at: document.created_at,
        processed_at: document.processed_at,
        time_since_upload: document.created_at
          ? `${Math.round((Date.now() - new Date(document.created_at).getTime()) / 1000 / 60)} minutes`
          : 'unknown'
      }
    });
  } catch (error: any) {
    console.error('Error in debug API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
