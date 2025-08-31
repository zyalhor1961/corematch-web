import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkQuota } from '@/lib/utils/quotas';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Get project and organization info
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('org_id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check quota before processing
    const quotaCheck = await checkQuota(project.org_id, 'cv', files.length);
    if (!quotaCheck.canUse) {
      return NextResponse.json(
        { 
          error: 'CV quota exceeded',
          remaining: quotaCheck.remaining,
          quota: quotaCheck.quota
        },
        { status: 429 }
      );
    }

    const uploadedCandidates = [];
    const errors = [];

    for (const file of files) {
      try {
        // Validate file type
        if (file.type !== 'application/pdf') {
          errors.push(`${file.name}: Only PDF files are supported`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`${file.name}: File size exceeds 10MB limit`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `cv/${project.org_id}/${projectId}/${fileName}`;

        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('cv')
          .upload(filePath, buffer, {
            contentType: file.type,
            metadata: {
              originalName: file.name,
              projectId: projectId,
              orgId: project.org_id,
            }
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          errors.push(`${file.name}: Upload failed`);
          continue;
        }

        // Create candidate record
        const { data: candidate, error: candidateError } = await supabaseAdmin
          .from('candidates')
          .insert({
            project_id: projectId,
            org_id: project.org_id,
            cv_filename: file.name,
            cv_url: uploadData.path,
            status: 'pending',
          })
          .select()
          .single();

        if (candidateError) {
          console.error('Candidate creation error:', candidateError);
          errors.push(`${file.name}: Failed to create candidate record`);
          continue;
        }

        uploadedCandidates.push(candidate);

      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors.push(`${file.name}: Processing failed`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        uploaded: uploadedCandidates.length,
        total: files.length,
        candidates: uploadedCandidates,
        errors: errors,
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'File upload failed' },
      { status: 500 }
    );
  }
}