import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withOrgAccess } from '@/lib/api/auth-middleware';

export const GET = withOrgAccess(async (request, session, orgId, membership) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    console.log(`[list-candidates] User ${session.user.id} loading candidates for project ${projectId}`);

    // Utiliser client avec RLS (pas supabaseAdmin!)
    const supabase = createRouteHandlerClient({ cookies });

    // Vérifier que le projet appartient à l'org de l'utilisateur
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, org_id')
      .eq('id', projectId)
      .eq('org_id', orgId)
      .single();

    if (projectError || !project) {
      console.error('[list-candidates] Access denied to project:', { userId: session.user.id, projectId, orgId });
      return NextResponse.json(
        { error: 'Access denied to this project' },
        { status: 403 }
      );
    }

    // Get candidates (RLS actif = seulement ceux de l'org)
    const { data: candidates, error } = await supabase
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

      // Extract CV path and generate signed URL
      let cv_url = candidate.cv_url || '';
      // Use cv_path column (fallback to regex for old records)
      const cvPath = candidate.cv_path || candidate.notes?.match(/Path: ([^|\n]+)/)?.[1]?.trim();

      if (cvPath) {
        try {
          // Generate signed URL valid for 1 hour (RLS client)
          const { data: signedUrlData } = await supabase.storage
            .from('cv')
            .createSignedUrl(cvPath, 3600); // 3600 seconds = 1 hour

          if (signedUrlData?.signedUrl) {
            cv_url = signedUrlData.signedUrl;
          }
        } catch (urlError) {
          console.error(`[list-candidates] Error generating signed URL for candidate ${candidate.id}:`, urlError);
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
    console.error('[list-candidates] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates', details: (error as Error).message },
      { status: 500 }
    );
  }
});