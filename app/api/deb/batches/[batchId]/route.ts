import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../../_helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { batchId } = await params;

    if (!batchId) {
      return NextResponse.json({ error: 'batchId requis' }, { status: 400 });
    }

    // Get batch info to verify org membership and get storage path
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('deb_batches')
      .select('org_id, storage_object_path, source_filename')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 });
    }

    // Verify user has permission to delete
    const membership = await requireOrgMembership(batch.org_id, ['org_admin', 'org_manager']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    // Delete associated documents from storage
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('storage_object_path')
      .eq('batch_id', batchId);

    const pathsToDelete = [batch.storage_object_path];
    if (documents && documents.length > 0) {
      documents.forEach(doc => {
        if (doc.storage_object_path && doc.storage_object_path !== batch.storage_object_path) {
          pathsToDelete.push(doc.storage_object_path);
        }
      });
    }

    // Delete files from storage
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('deb-docs')
        .remove(pathsToDelete);

      if (storageError) {
        console.warn('Warning: Could not delete files from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete lines first (foreign key constraint)
    await supabaseAdmin
      .from('lines')
      .delete()
      .in('document_id',
        (await supabaseAdmin.from('documents').select('id').eq('batch_id', batchId)).data?.map(d => d.id) || []
      );

    // Delete documents
    await supabaseAdmin
      .from('documents')
      .delete()
      .eq('batch_id', batchId);

    // Finally, delete the batch
    const { error: deleteBatchError } = await supabaseAdmin
      .from('deb_batches')
      .delete()
      .eq('id', batchId);

    if (deleteBatchError) {
      console.error('Error deleting batch:', deleteBatchError);
      return NextResponse.json(
        { error: 'Impossible de supprimer le lot' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lot supprimé avec succès'
    });

  } catch (error) {
    console.error('Delete batch error:', error);
    return NextResponse.json(
      { error: 'Erreur inattendue' },
      { status: 500 }
    );
  }
}
