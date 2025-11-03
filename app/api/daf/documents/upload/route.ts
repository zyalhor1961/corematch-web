import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute, logSecurityEvent } from '@/lib/auth/middleware';
import { ApiErrorHandler, ValidationHelper } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import { classifyDocument } from '@/lib/daf-docs/classifier';
import type { DAFDocument } from '@/lib/daf-docs/types';

/**
 * Upload de documents DAF
 *
 * Phase 0: Upload + classification automatique
 * Phase 1+: + extraction Azure DI
 *
 * Réutilise la logique de app/api/cv/projects/[projectId]/upload/route.ts
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // ⚠️ SECURITY CHECK
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;

    // Get user's org
    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // ===== SECURITY: Limit number of files =====
    const MAX_FILES_PER_UPLOAD = 20;
    if (files.length > MAX_FILES_PER_UPLOAD) {
      logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        userId: user!.id,
        email: user!.email,
        orgId,
        route: '/api/daf/documents/upload [POST]',
        details: `Attempted to upload ${files.length} files (max ${MAX_FILES_PER_UPLOAD}) - BLOCKED`,
      });

      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `Too many files. Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload`,
        'files'
      );
    }

    console.log(`[DAF Upload] User ${user!.id} uploading ${files.length} files to org ${orgId}`);

    if (!files.length) {
      throw new AppError(ErrorType.MISSING_REQUIRED_FIELD, 'No files provided', 'files');
    }

    // Validate each file
    for (const file of files) {
      ValidationHelper.validateFile(file, {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/tiff',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.doc', '.docx'],
      });
    }

    const uploadedDocuments: DAFDocument[] = [];
    const errors: Array<{ fileName: string; error: string; type: ErrorType }> = [];

    for (const file of files) {
      try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${orgId}/${fileName}`;

        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Upload to Supabase Storage (bucket 'daf-docs')
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('daf-docs')
          .upload(filePath, buffer, {
            contentType: file.type,
            metadata: {
              originalName: file.name,
              orgId: orgId,
              uploadedBy: user!.id,
            },
          });

        if (uploadError) {
          console.error('[DAF Upload] Storage error:', uploadError);
          errors.push({
            fileName: file.name,
            error: 'Failed to upload file to storage',
            type: ErrorType.FILE_UPLOAD_FAILED,
          });
          continue;
        }

        const uploadPath = uploadData.path;

        // Build public URL (signed)
        const { data: signedUrl } = await supabaseAdmin.storage
          .from('daf-docs')
          .createSignedUrl(uploadPath, 3600 * 24 * 7); // 7 days

        // Classify document automatically
        const classification = classifyDocument(file.name, file.type);

        console.log(`[DAF Upload] Classified "${file.name}" as ${classification.doc_type} (${(classification.confidence * 100).toFixed(0)}% confidence)`);

        // Create document record
        const { data: document, error: documentError } = await supabaseAdmin
          .from('daf_documents')
          .insert({
            org_id: orgId,
            file_name: file.name,
            file_path: uploadPath,
            file_url: signedUrl?.signedUrl,
            file_size_bytes: file.size,
            file_type: file.type,
            doc_type: classification.doc_type,
            fournisseur: classification.fournisseur_detecte,
            status: 'uploaded',
            source: 'manual_upload',
            notes: `Auto-classé: ${classification.raison}`,
            created_by: user!.id,
          })
          .select()
          .single();

        if (documentError) {
          console.error('[DAF Upload] DB error:', documentError);
          errors.push({
            fileName: file.name,
            error: 'Failed to create document record',
            type: ErrorType.INTERNAL_ERROR,
          });
          continue;
        }

        uploadedDocuments.push(document as DAFDocument);

      } catch (fileError) {
        console.error(`[DAF Upload] Error processing file ${file.name}:`, fileError);
        errors.push({
          fileName: file.name,
          error: fileError instanceof AppError ? fileError.userMessage : 'Failed to process file',
          type: fileError instanceof AppError ? fileError.type : ErrorType.INTERNAL_ERROR,
        });
      }
    }

    // Response
    const responseData = {
      success: true,
      data: {
        summary: {
          total: files.length,
          uploaded: uploadedDocuments.length,
          failed: errors.length,
        },
        documents: uploadedDocuments,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: errors.length === 0
        ? `${uploadedDocuments.length} document(s) uploadé(s) avec succès`
        : `${uploadedDocuments.length} document(s) uploadé(s), ${errors.length} échec(s)`,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[DAF Upload] Error:', error);
    return ApiErrorHandler.handleError(error, user?.id, '/api/daf/documents/upload [POST]');
  }
}
