import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyOrgAccess } from '@/lib/auth/verify-auth';
import { extractTextFromPDF, cleanPDFText } from '@/lib/utils/pdf-extractor';
import { handleApiError, AppError, ErrorCode } from '@/lib/utils/error-handler';
import { orchestrateAnalysis } from '@/lib/cv-analysis';
import { generateJobSpec } from '@/lib/cv-analysis/utils/jobspec-generator';
import { maskPII } from '@/lib/utils/data-normalization';
import type { JobSpec } from '@/lib/cv-analysis/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; candidateId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { projectId, candidateId } = await params;

    if (!candidateId || !projectId) {
      return NextResponse.json(
        { error: 'Project ID and Candidate ID are required' },
        { status: 400 }
      );
    }

    // SECURITY: Get user's org_id first for defense-in-depth filtering
    const { data: userOrgs } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id);

    const userOrgIds = userOrgs?.map(m => m.org_id) || [];
    if (userOrgIds.length === 0) {
      return NextResponse.json(
        { error: 'User has no organization access' },
        { status: 403 }
      );
    }

    // Get candidate and project info with org_id filter (defense-in-depth)
    // Note: cv_path column is included in * selector
    const { data: candidate, error: candidateError} = await supabaseAdmin
      .from('candidates')
      .select(`
        *,
        project:projects(
          id,
          name,
          job_title,
          requirements,
          description,
          org_id
        )
      `)
      .eq('id', candidateId)
      .eq('project_id', projectId)
      .single();

    // SECURITY: Verify candidate belongs to user's organization (defense-in-depth)
    if (candidate && !(candidate.project as any)?.org_id) {
      console.error(`[analyze] SECURITY: No org_id in project for candidate ${candidateId}`);
      return NextResponse.json({ error: 'Invalid project data' }, { status: 500 });
    }

    const projectOrgId = (candidate.project as any)?.org_id;
    if (candidate && !userOrgIds.includes(projectOrgId)) {
      console.error(`[analyze] SECURITY: Access attempt to org ${projectOrgId} by user ${user.id} (allowed: ${userOrgIds.join(', ')})`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidat non trouvé' },
        { status: 404 }
      );
    }
    
    // Verify user has access to the organization
    const orgId = (candidate.project as any)?.org_id;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from('candidates')
      .update({ status: 'processing' })
      .eq('id', candidateId);

    // Extract PDF text
    let cvText = '';
    // Use cv_path column (fallback to regex for old records)
    const filePath = candidate.cv_path || candidate.notes?.match(/Path: ([^|\n]+)/)?.[1]?.trim();

    console.log(`\n========== 🎯 CV ANALYSIS (Multi-Provider) ==========`);
    console.log(`Candidate ID: ${candidateId}`);
    console.log(`Candidate Name: ${maskPII(candidate.first_name || '')} ${maskPII(candidate.last_name || '')}`);
    console.log(`Extracted filePath: ${filePath}`);

    if (filePath) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'Missing NEXT_PUBLIC_SUPABASE_URL environment variable',
          500
        );
      }
      // SECURITY: Validate filePath to prevent path traversal
      if (!filePath || filePath.includes('..') || filePath.includes('//')) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid file path detected',
          400
        );
      }

      const pdfUrl = `${supabaseUrl}/storage/v1/object/public/cv/${filePath}`;
      console.log(`[CV Analysis] Processing candidate: ${candidateId}`);
      console.log(`[CV Analysis] PDF URL: ${pdfUrl}`);

      try {
        // Extract text from PDF using proper extraction
        const rawText = await extractTextFromPDF(pdfUrl);
        cvText = cleanPDFText(rawText);

        // SECURITY: Only log metadata, never actual CV content (PII)
        console.log(`✅ PDF extraction successful: ${cvText.length} characters extracted`);
      } catch (pdfError) {
        // SECURITY: Sanitize error messages - don't expose internal details
        const sanitizedError = pdfError instanceof Error
          ? pdfError.message.substring(0, 100)
          : 'Unknown error';

        console.error(`❌ PDF extraction failed for candidate ${candidateId}: ${sanitizedError}`);

        // Update candidate with error
        await supabaseAdmin
          .from('candidates')
          .update({
            status: 'pending',
            notes: `${candidate.notes}\n\n⚠️ ERREUR: Impossible d'extraire le texte du CV. Veuillez réessayer.`
          })
          .eq('id', candidateId);

        return NextResponse.json(
          {
            error: 'PDF extraction failed',
            message: 'Impossible d\'extraire le texte du CV'
          },
          { status: 500 }
        );
      }
    } else {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'CV file path not found',
        400
      );
    }

    // Generate or retrieve JobSpec
    const project = candidate.project;
    const jobSpec = generateJobSpec({
      job_title: project.job_title,
      description: project.description,
      requirements: project.requirements,
      job_spec_config: project.job_spec_config,
    });

    console.log(`[CV Analysis] Job Title: ${jobSpec.title}`);
    console.log(`[CV Analysis] Must-have rules: ${jobSpec.must_have.length}`);
    console.log(`[CV Analysis] Using mode: BALANCED (multi-provider)`);

    // Analyze with multi-provider system
    let result;
    try {
      result = await orchestrateAnalysis(cvText, jobSpec, {
        mode: 'balanced', // Use BALANCED mode by default
        enablePrefilter: true,
        enablePacking: true,
      });

      console.log(`\n========== 🎯 ANALYSIS RESULT ==========`);
      console.log(`Score: ${result.final_decision.overall_score_0_to_100}/100`);
      console.log(`Recommendation: ${result.final_decision.recommendation}`);
      console.log(`Providers used: ${result.debug.providers_used.join(', ')}`);
      console.log(`Cost: $${result.cost.total_usd.toFixed(4)}`);
      console.log(`Time: ${result.performance.total_execution_time_ms}ms`);
      if (result.consensus) {
        console.log(`Consensus: ${result.consensus.level}`);
      }
      console.log(`========================================\n`);
    } catch (analysisError) {
      console.error('❌ Multi-provider analysis failed:', analysisError);

      // Update candidate with error
      await supabaseAdmin
        .from('candidates')
        .update({
          status: 'pending',
          notes: `${candidate.notes}\n\n⚠️ ERREUR: L'analyse IA a échoué. Veuillez réessayer.`
        })
        .eq('id', candidateId);

      return NextResponse.json(
        {
          error: 'Analysis failed',
          message: analysisError instanceof Error ? analysisError.message : 'Erreur inconnue'
        },
        { status: 500 }
      );
    }

    // 🎯 SENTINEL: Marker to confirm new multi-provider system is running
    const SENTINEL = 'COREMATCH-V2-MULTI-PROVIDER';

    // Context Snapshot for debugging
    const contextSnapshot = {
      engine: SENTINEL,
      project_id: projectId,
      candidate_id: candidateId,
      job_title: jobSpec.title,
      must_have_count: jobSpec.must_have.length,
      skills_count: jobSpec.skills_required.length,
      providers_called: result.debug.providers_used,
      mode: result.debug.mode,
      consensus_level: result.consensus?.level || 'none',
      cost_usd: result.cost.total_usd,
      execution_time_ms: result.performance.total_execution_time_ms,
      analysis_date: new Date().toISOString(),
      // Relevance check
      experiences_direct: result.final_decision.relevance_summary?.by_experience?.filter(e => e.relevance === 'DIRECTE').length || 0,
      months_direct: result.final_decision.relevance_summary.months_direct,
    };

    // Convert multi-provider result to legacy format for frontend compatibility
    const analysis = {
      score: Math.round(result.final_decision.overall_score_0_to_100),
      strengths: result.final_decision.strengths.map(s => s.point).slice(0, 5),
      weaknesses: result.final_decision.improvements.map(i => i.suggestion).slice(0, 5),
      recommendation:
        result.final_decision.recommendation === 'SHORTLIST' ? 'Recommandé' :
        result.final_decision.recommendation === 'CONSIDER' ? 'À considérer' :
        'Non recommandé',
      summary: `[${SENTINEL}] Score: ${Math.round(result.final_decision.overall_score_0_to_100)}/100. ${
        result.final_decision.meets_all_must_have
          ? '✅ Répond à tous les critères obligatoires.'
          : '❌ Ne répond pas à tous les critères obligatoires.'
      } Analysé avec ${result.debug.providers_used.join(', ')} (${result.debug.mode} mode). Consensus: ${result.consensus?.level || 'N/A'}. Mois DIRECTE: ${result.final_decision.relevance_summary.months_direct}.`,
      // Full metadata for debugging
      _metadata: contextSnapshot
    };

    // Update candidate with analysis results
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({
        status: 'analyzed',
        notes: `${candidate.notes}\n\n--- ANALYSE IA ---\nScore: ${analysis.score}/100\nRecommandation: ${analysis.recommendation}\nRésumé: ${analysis.summary}`
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Error updating candidate:', updateError);
      return NextResponse.json(
        { error: 'Erreur mise à jour candidat' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        candidateId,
        score: analysis.score,
        recommendation: analysis.recommendation,
        analysis: analysis,
        message: 'Analyse terminée avec succès',
        // 🎯 Context Snapshot (visible in browser console)
        contextSnapshot: contextSnapshot,
        // Full result for debugging
        _debug: {
          jobSpec: {
            title: jobSpec.title,
            must_have: jobSpec.must_have,
            relevance_rules: jobSpec.relevance_rules,
          },
          final_decision: result.final_decision,
          performance: result.performance,
          cost: result.cost,
        }
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Reset status to pending on error
    try {
      const { candidateId } = await params;
      if (candidateId) {
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'pending' })
          .eq('id', candidateId);
      }
    } catch (resetError) {
      console.error('Error resetting status:', resetError);
    }

    // Use centralized error handler
    return handleApiError(error);
  }
}