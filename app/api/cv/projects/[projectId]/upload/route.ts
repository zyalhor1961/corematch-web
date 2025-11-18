import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { checkQuota } from '@/lib/utils/quotas';
import { secureApiRoute, logSecurityEvent } from '@/lib/auth/middleware';
import { ApiErrorHandler, ValidationHelper } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';

/**
 * Verify user has access to project through organization membership
 */
async function verifyProjectAccess(userId: string, projectId: string, isMasterAdmin: boolean = false): Promise<{ hasAccess: boolean; orgId?: string }> {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Master admin has access to all projects
    if (isMasterAdmin) {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('org_id')
        .eq('id', projectId)
        .single();

      return {
        hasAccess: true,
        orgId: project?.org_id
      };
    }

    // Get project's organization
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return { hasAccess: false };
    }

    // Check if user is member of the project's organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', project.org_id)
      .single();

    if (membershipError || !membership) {
      console.error('User not member of organization:', membershipError);
      return { hasAccess: false };
    }

    return {
      hasAccess: true,
      orgId: project.org_id
    };
  } catch (error) {
    console.error('Project access verification failed:', error);
    return { hasAccess: false };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let projectId: string | undefined;
  let user: any;

  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // ⚠️ SECURITY CHECK: Verify authentication before allowing file uploads
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    user = securityResult.user;
    const paramsData = await params;
    projectId = paramsData.projectId;

    // Verify user has access to this project
    const projectAccess = await verifyProjectAccess(user!.id, projectId, user!.isMasterAdmin);
    if (!projectAccess.hasAccess) {
      logSecurityEvent({
        type: 'ACCESS_DENIED',
        userId: user!.id,
        email: user!.email,
        route: `/api/cv/projects/${projectId}/upload [POST]`,
        details: 'Attempted to upload files without project access'
      });

      throw new AppError(ErrorType.ACCESS_DENIED, 'No access to this project');
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // ===== SECURITY: Limit number of files to prevent DoS attacks =====
    const MAX_FILES_PER_UPLOAD = 50; // Maximum 50 files at once
    if (files.length > MAX_FILES_PER_UPLOAD) {
      logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        userId: user!.id,
        email: user!.email,
        orgId: projectAccess.orgId,
        route: `/api/cv/projects/${projectId}/upload [POST]`,
        details: `Attempted to upload ${files.length} files (max ${MAX_FILES_PER_UPLOAD}) - BLOCKED`
      });

      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `Too many files. Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload`,
        'files'
      );
    }

    // Normal activity log (not suspicious)
    console.log(`[upload] User ${user!.id} uploading ${files.length} files to project ${projectId}`);

    if (!files.length) {
      throw new AppError(ErrorType.MISSING_REQUIRED_FIELD, 'No files provided', 'files');
    }

    // Validate each file before processing
    for (const file of files) {
      ValidationHelper.validateFile(file, {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        allowedExtensions: ['.pdf', '.doc', '.docx']
      });
    }

    // Get project and organization info
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('org_id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new AppError(ErrorType.RESOURCE_NOT_FOUND, `Project ${projectId} not found`);
    }

    // Check quota before processing
    const quotaCheck = await checkQuota(project.org_id, 'cv', files.length);
    if (!quotaCheck.canUse) {
      throw new AppError(
        ErrorType.QUOTA_EXCEEDED,
        `CV quota exceeded. Remaining: ${quotaCheck.remaining}/${quotaCheck.quota}`
      );
    }

    const uploadedCandidates = [];
    const errors = [];

    for (const file of files) {
      try {
        // Note: File validation already done above, but we re-validate here for individual error tracking
        try {
          ValidationHelper.validateFile(file);
        } catch (validationError) {
          if (validationError instanceof AppError) {
            errors.push({
              fileName: file.name,
              error: validationError.userMessage,
              type: validationError.type
            });
          } else {
            errors.push({
              fileName: file.name,
              error: 'Erreur de validation du fichier',
              type: ErrorType.VALIDATION_ERROR
            });
          }
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
          errors.push({
            fileName: file.name,
            error: 'Échec du téléchargement du fichier vers le serveur',
            type: ErrorType.FILE_UPLOAD_FAILED,
            details: uploadError.message
          });
          continue;
        }

        const uploadPath = uploadData.path;

        // Build public URL for the CV
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const cvPublicUrl = `${supabaseUrl}/storage/v1/object/public/cv/${uploadPath}`;

        // Extract candidate name from filename (remove extension)
        const candidateName = file.name.replace(/\.[^/.]+$/, "");
        // Try to split into first and last name if there's a space or underscore
        const nameParts = candidateName.split(/[\s_-]+/);
        const firstName = nameParts[0] || candidateName;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // Create candidate record
        const { data: candidate, error: candidateError } = await supabaseAdmin
          .from('candidates')
          .insert({
            project_id: projectId,
            org_id: project.org_id,
            first_name: firstName,
            last_name: lastName || null,
            name: candidateName, // Full name from filename
            cv_filename: file.name, // Original filename
            cv_url: cvPublicUrl, // Public URL to access the CV
            cv_path: uploadPath, // ✅ Dedicated column for CV storage path
            status: 'pending',
            notes: `CV file: ${file.name} | Path: ${uploadPath} | Original file: ${file.name}`,
          })
          .select()
          .single();

        if (candidateError) {
          console.error('Candidate creation error:', candidateError);
          errors.push({
            fileName: file.name,
            error: 'Échec de la création du profil candidat en base de données',
            type: ErrorType.INTERNAL_ERROR,
            details: candidateError.message
          });
          continue;
        }

        uploadedCandidates.push({
          ...candidate,
          originalFileName: file.name
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors.push({
          fileName: file.name,
          error: fileError instanceof AppError ? fileError.userMessage : 'Échec du traitement du fichier',
          type: fileError instanceof AppError ? fileError.type : ErrorType.INTERNAL_ERROR,
          details: fileError instanceof Error ? fileError.message : String(fileError)
        });
      }
    }

    // Créer une réponse détaillée et professionnelle
    const responseData = {
      success: true,
      data: {
        summary: {
          total: files.length,
          uploaded: uploadedCandidates.length,
          failed: errors.length
        },
        candidates: uploadedCandidates,
        errors: errors.length > 0 ? errors : undefined
      },
      message: errors.length === 0
        ? `${uploadedCandidates.length} CV(s) téléchargé(s) avec succès`
        : `${uploadedCandidates.length} CV(s) téléchargé(s), ${errors.length} échec(s)`
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Upload error:', error);
    return ApiErrorHandler.handleError(error, user?.id, `/api/cv/projects/${projectId || 'unknown'}/upload [POST]`);
  }
}