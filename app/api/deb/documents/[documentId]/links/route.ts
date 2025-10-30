import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;

    // Get all links for this document (both directions)
    const { data: links, error } = await supabaseAdmin
      .from('deb_document_links')
      .select(`
        *,
        document:deb_documents!deb_document_links_document_id_fkey(id, filename, doc_type, supplier_name, invoice_number, delivery_note_number, total_ht),
        linked_document:deb_documents!deb_document_links_linked_document_id_fkey(id, filename, doc_type, supplier_name, invoice_number, delivery_note_number, total_ht)
      `)
      .or(`document_id.eq.${documentId},linked_document_id.eq.${documentId}`);

    if (error) {
      console.error('Error fetching document links:', error);
      return NextResponse.json(
        { error: 'Failed to fetch document links' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: links || []
    });

  } catch (error) {
    console.error('Get document links error:', error);
    return NextResponse.json(
      { error: 'Failed to get document links' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;
    const { linkedDocumentId, linkType = 'manual', confidence = 0.5, notes } = await request.json();

    if (!linkedDocumentId) {
      return NextResponse.json(
        { error: 'linkedDocumentId is required' },
        { status: 400 }
      );
    }

    // Check if both documents exist and belong to the same org
    const { data: documents, error: docError } = await supabaseAdmin
      .from('deb_documents')
      .select('id, org_id')
      .in('id', [documentId, linkedDocumentId]);

    if (docError || !documents || documents.length !== 2) {
      return NextResponse.json(
        { error: 'Invalid document IDs' },
        { status: 400 }
      );
    }

    if (documents[0].org_id !== documents[1].org_id) {
      return NextResponse.json(
        { error: 'Documents must belong to the same organization' },
        { status: 400 }
      );
    }

    // Create the link
    const { data: link, error: linkError } = await supabaseAdmin
      .from('deb_document_links')
      .insert({
        document_id: documentId,
        linked_document_id: linkedDocumentId,
        link_type: linkType,
        confidence: confidence,
        notes: notes
      })
      .select()
      .single();

    if (linkError) {
      console.error('Error creating document link:', linkError);
      return NextResponse.json(
        { error: 'Failed to create document link' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: link
    });

  } catch (error) {
    console.error('Create document link error:', error);
    return NextResponse.json(
      { error: 'Failed to create document link' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json(
        { error: 'linkId parameter is required' },
        { status: 400 }
      );
    }

    // Delete the specific link
    const { error } = await supabaseAdmin
      .from('deb_document_links')
      .delete()
      .eq('id', linkId)
      .or(`document_id.eq.${documentId},linked_document_id.eq.${documentId}`);

    if (error) {
      console.error('Error deleting document link:', error);
      return NextResponse.json(
        { error: 'Failed to delete document link' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document link deleted successfully'
    });

  } catch (error) {
    console.error('Delete document link error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document link' },
      { status: 500 }
    );
  }
}