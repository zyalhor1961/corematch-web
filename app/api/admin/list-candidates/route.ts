import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    console.log('Loading candidates for projectId:', projectId);

    // Get candidates using admin client (bypasses RLS and auth checks)
    const { data: candidates, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch candidates', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Found ${candidates?.length || 0} candidates for project ${projectId}`);

    // Transform candidates to match frontend interface
    const transformedCandidates = (candidates || []).map(candidate => ({
      ...candidate,
      // Combine first_name and last_name into name
      name: [candidate.first_name, candidate.last_name]
        .filter(Boolean)
        .join(' ') || 'Nom non renseigné',
      // Extract cv_filename from notes if not directly available
      cv_filename: candidate.cv_filename ||
        (() => {
          const match = candidate.notes?.match(/CV file: ([^\|]+)/);
          return match ? match[1].trim() : 'CV non disponible';
        })(),
      // Ensure other expected fields exist
      email: candidate.email || '',
      phone: candidate.phone || '',
      cv_url: candidate.cv_url || '',
      score: candidate.score || null,
      explanation: candidate.explanation || '',
      shortlisted: candidate.shortlisted || false,
      status: candidate.status || 'pending',
    }));

    return NextResponse.json({
      success: true,
      data: transformedCandidates,
    });

  } catch (error) {
    console.error('Candidates fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates', details: (error as Error).message },
      { status: 500 }
    );
  }
}