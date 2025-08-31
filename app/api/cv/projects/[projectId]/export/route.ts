import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const shortlistedOnly = searchParams.get('shortlisted') === 'true';

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('name, job_title')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get candidates
    let query = supabaseAdmin
      .from('candidates')
      .select('name, email, phone, score, explanation, cv_filename, shortlisted, status, created_at')
      .eq('project_id', projectId)
      .order('score', { ascending: false, nullsLast: true });

    if (shortlistedOnly) {
      query = query.eq('shortlisted', true);
    } else {
      // Only include analyzed candidates for export
      query = query.eq('status', 'analyzed');
    }

    const { data: candidates, error: candidatesError } = await query;

    if (candidatesError) {
      console.error('Error fetching candidates:', candidatesError);
      return NextResponse.json(
        { error: 'Failed to fetch candidates' },
        { status: 500 }
      );
    }

    if (!candidates?.length) {
      return NextResponse.json(
        { error: 'No candidates to export' },
        { status: 404 }
      );
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Name',
        'Email',
        'Phone',
        'Score',
        'Shortlisted',
        'CV Filename',
        'Explanation',
        'Date Added'
      ];

      const rows = candidates.map(candidate => [
        candidate.name || '',
        candidate.email || '',
        candidate.phone || '',
        candidate.score?.toString() || '',
        candidate.shortlisted ? 'Yes' : 'No',
        candidate.cv_filename || '',
        (candidate.explanation || '').replace(/"/g, '""'), // Escape quotes
        new Date(candidate.created_at).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(field => 
            typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))
              ? `"${field}"`
              : field
          ).join(',')
        )
      ].join('\n');

      const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_candidates_${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data: {
        project: {
          name: project.name,
          job_title: project.job_title,
        },
        candidates,
        exported_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}