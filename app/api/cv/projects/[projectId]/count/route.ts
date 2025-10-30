import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Count candidates for this project
    const { count: candidateCount } = await supabaseAdmin
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    return NextResponse.json({
      success: true,
      data: {
        candidate_count: candidateCount || 0,
        analyzed_count: 0, // TODO: implement when analysis is ready
        shortlisted_count: 0, // TODO: implement when shortlisting is ready
      },
    });

  } catch (error) {
    console.error('Count fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch counts' },
      { status: 500 }
    );
  }
}