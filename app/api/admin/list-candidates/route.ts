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

    // Transform candidates to match frontend interface with signed URLs
    const transformedCandidates = await Promise.all((candidates || []).map(async (candidate) => {
      // Extract cv_filename from notes if not directly available
      const cv_filename = candidate.cv_filename ||
        (() => {
          const match = candidate.notes?.match(/CV file: ([^\|]+)/);
          return match ? match[1].trim() : 'CV non disponible';
        })();

      // Extract CV path from notes and generate signed URL
      let cv_url = candidate.cv_url || '';
      const pathMatch = candidate.notes?.match(/Path: ([^|\n]+)/);

      if (pathMatch) {
        const cvPath = pathMatch[1].trim();
        try {
          // Generate signed URL valid for 1 hour
          const { data: signedUrlData } = await supabaseAdmin.storage
            .from('cv')
            .createSignedUrl(cvPath, 3600); // 3600 seconds = 1 hour

          if (signedUrlData?.signedUrl) {
            cv_url = signedUrlData.signedUrl;
          }
        } catch (urlError) {
          console.error(`Error generating signed URL for candidate ${candidate.id}:`, urlError);
        }
      }

      return {
        ...candidate,
        // Combine first_name and last_name into name
        name: [candidate.first_name, candidate.last_name]
          .filter(Boolean)
          .join(' ') || 'Nom non renseigné',
        cv_filename,
        cv_url,
        // Ensure other expected fields exist
        email: candidate.email || '',
        phone: candidate.phone || '',
        score: candidate.score || null,
        explanation: candidate.explanation || '',
        shortlisted: candidate.shortlisted || false,
        status: candidate.status || 'pending',
      };
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