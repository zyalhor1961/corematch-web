import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; candidateId: string }> }
) {
  try {
    const { projectId, candidateId } = await params;

    if (!candidateId) {
      return NextResponse.json(
        { error: 'Candidate ID is required' },
        { status: 400 }
      );
    }

    // First, get candidate info to delete the CV file from storage
    const { data: candidate, error: fetchError } = await supabaseAdmin
      .from('candidates')
      .select('notes')
      .eq('id', candidateId)
      .eq('project_id', projectId) // Security: ensure candidate belongs to this project
      .single();

    if (fetchError) {
      console.error('Error fetching candidate:', fetchError);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Extract file path from notes to delete from storage
    const filePath = candidate.notes?.match(/Path: ([^|]+)/)?.[1];
    if (filePath) {
      const { error: deleteFileError } = await supabaseAdmin.storage
        .from('cv')
        .remove([filePath]);

      if (deleteFileError) {
        console.warn('Warning: Could not delete CV file from storage:', deleteFileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete candidate record from database
    const { error: deleteError } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('id', candidateId)
      .eq('project_id', projectId); // Security: ensure candidate belongs to this project

    if (deleteError) {
      console.error('Error deleting candidate:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete candidate' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'CV supprimé avec succès'
    });

  } catch (error) {
    console.error('Delete candidate error:', error);
    return NextResponse.json(
      { error: 'Failed to delete candidate' },
      { status: 500 }
    );
  }
}