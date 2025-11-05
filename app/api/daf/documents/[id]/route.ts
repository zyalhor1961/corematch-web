import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Get document
    const { data: document, error } = await supabase
      .from('daf_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[DAF API] Error fetching document:', error);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('[DAF API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get document to verify ownership and get file_url
    const { data: document, error: fetchError } = await supabase
      .from('daf_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Verify ownership
      .single();

    if (fetchError || !document) {
      console.error('[DAF API] Error fetching document:', fetchError);
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 }
      );
    }

    // Extract file path from file_url
    // URL format: https://<project>.supabase.co/storage/v1/object/public/daf-documents/<path>
    const filePath = document.file_url.split('/daf-documents/')[1];

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('daf-documents')
      .remove([filePath]);

    if (storageError) {
      console.error('[DAF API] Error deleting from storage:', storageError);
      // Continue to delete from database even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('daf_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Double-check ownership

    if (deleteError) {
      console.error('[DAF API] Error deleting document:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    console.log(`[DAF API] Successfully deleted document ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DAF API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
