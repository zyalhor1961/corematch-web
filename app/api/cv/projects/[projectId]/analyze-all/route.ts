import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { extractTextFromPDF, cleanPDFText } from '@/lib/utils/pdf-extractor';
import { orchestrateAnalysis } from '@/lib/cv-analysis';
import { generateJobSpec } from '@/lib/cv-analysis/utils/jobspec-generator';
import type { JobSpec } from '@/lib/cv-analysis/types';
import { normalizePhone, maskPII } from '@/lib/utils/data-normalization';

/**
 * Analyse un candidat avec le système multi-provider orchestré
 */
async function analyzeCandidateMultiProvider(
  candidate: any,
  cvText: string,
  jobSpec: JobSpec
) {
  // Masquer les PII dans les logs
  const maskedName = maskPII(`${candidate.first_name} ${candidate.last_name}`);
  console.log(`[🎯 Multi-Provider] Analyzing ${maskedName}`);
  console.log(`[🎯 Multi-Provider] JobSpec: ${jobSpec.title}`);
  console.log(`[🎯 Multi-Provider] Mode: BALANCED`);

  // Appeler le nouveau système orchestré
  const result = await orchestrateAnalysis(cvText, jobSpec, {
    mode: 'balanced', // Mode BALANCED par défaut pour batch
    enablePrefilter: true,
    enablePacking: true,
  });

  console.log(`[🎯 Multi-Provider] ✅ Analysis complete`);
  console.log(`[🎯 Multi-Provider] Score: ${result.final_decision.overall_score_0_to_100}/100`);
  console.log(`[🎯 Multi-Provider] Providers: ${result.debug.providers_used.join(', ')}`);
  console.log(`[🎯 Multi-Provider] Consensus: ${result.consensus?.level || 'N/A'}`);
  console.log(`[🎯 Multi-Provider] Months DIRECTE: ${result.final_decision.relevance_summary.months_direct}`);

  // Extraire email/téléphone du CV JSON si disponible
  const extractedEmail = result.cv_json?.identite?.email || candidate.email || 'INFORMATION_MANQUANTE';
  const extractedPhone = result.cv_json?.identite?.telephone || candidate.phone || 'INFORMATION_MANQUANTE';

  const evaluation = result.final_decision;
  const SENTINEL = 'COREMATCH-V2-MULTI-PROVIDER';

  return {
    evaluation,
    legacyFormat: evaluation, // Le nouveau format est déjà compatible
    score: Math.round(evaluation.overall_score_0_to_100),
    shortlist: evaluation.recommendation === 'SHORTLIST',
    extractedEmail,
    extractedPhone,
    explanation: `**[${SENTINEL}] ANALYSE MULTI-PROVIDER**

**Score : ${Math.round(evaluation.overall_score_0_to_100)}/100**
Recommandation : ${evaluation.recommendation}
Mode : ${result.debug.mode} | Providers : ${result.debug.providers_used.join(', ')} | Consensus : ${result.consensus?.level || 'N/A'}

**Sous-scores :**
- Expérience pertinente : ${evaluation.subscores.experience_years_relevant.toFixed(1)} ans
- Compétences : ${evaluation.subscores.skills_match_0_to_100}%
- Nice-to-have : ${evaluation.subscores.nice_to_have_0_to_100}%

**Pertinence :**
- ${evaluation.relevance_summary.months_direct} mois DIRECTE
- ${evaluation.relevance_summary.months_adjacent} mois ADJACENTE

**Points forts :**
${evaluation.strengths.map(s => `• ${s.point}`).join('\n')}

**Points d'amélioration :**
${evaluation.improvements.map(i => `• ${i.suggestion}`).join('\n')}
${evaluation.fails?.length > 0 ? `\n**⚠️ Règles non satisfaites :**\n${evaluation.fails.map(f => `• ${f.reason}`).join('\n')}` : ''}

**💰 Coût : $${result.cost.total_usd.toFixed(4)} | ⏱️ Temps : ${result.performance.total_execution_time_ms}ms**`
  };
}

export async function POST(
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

    // Get custom JobSpec from request body if provided
    const body = await request.json().catch(() => ({}));
    const customJobSpec = body.customJobSpec as JobSpec | undefined;

    // Get all pending candidates
    // Note: cv_path column is included in * selector
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select(`
        *,
        project:projects(
          id,
          name,
          job_title,
          requirements,
          description,
          job_spec_config
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'pending');

    if (candidatesError || !candidates) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des candidats' },
        { status: 500 }
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun CV en attente d\'analyse',
        data: { analyzed: 0, failed: 0, shortlisted: 0 }
      });
    }

    const project = candidates[0].project;

    // Use custom JobSpec if provided, otherwise use project's JobSpec or generate from project
    const jobSpec = customJobSpec ||
                   (project.job_spec_config as JobSpec | null) ||
                   generateJobSpec({
                     job_title: project.job_title,
                     description: project.description,
                     requirements: project.requirements,
                     job_spec_config: project.job_spec_config,
                   });

    console.log(`\n========== 🎯 BATCH ANALYSIS (MULTI-PROVIDER) ==========`);
    console.log(`Project: ${project.name}`);
    console.log(`Candidates: ${candidates.length}`);
    console.log(`Mode: BALANCED (multi-provider with consensus)`);
    console.log(`JobSpec: ${jobSpec.title}`);
    if (customJobSpec) {
      console.log(`🔧 Using CUSTOM JobSpec for this analysis`);
    } else if (project.job_spec_config) {
      console.log(`📋 Using SAVED JobSpec from project config`);
    } else {
      console.log(`🤖 Using AUTO-GENERATED JobSpec from project info`);
    }

    let analyzed = 0;
    let failed = 0;
    const results = [];

    // Process each candidate
    for (const candidate of candidates) {
      try {
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'processing' })
          .eq('id', candidate.id);

        // Extract CV text
        // Use cv_path column (fallback to regex for old records)
        const cvPath = candidate.cv_path || candidate.notes?.match(/Path: ([^|]+)/)?.[1]?.trim();
        let cvText = '';

        if (cvPath) {
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (!supabaseUrl) {
              throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
            }

            const pdfUrl = `${supabaseUrl}/storage/v1/object/public/cv/${cvPath}`;
            const rawText = await extractTextFromPDF(pdfUrl);
            cvText = cleanPDFText(rawText);
            console.log(`✅ PDF extracted: ${cvText.length} chars`);
          } catch (extractError) {
            console.error('PDF extraction error:', extractError);
            cvText = `Erreur extraction. Nom: ${candidate.first_name} ${candidate.last_name}`;
          }
        } else {
          cvText = `Nom: ${candidate.first_name} ${candidate.last_name}`;
        }

        // Analyze with multi-provider orchestrated system
        const analysisResult = await analyzeCandidateMultiProvider(candidate, cvText, jobSpec);

        // Update candidate with extracted contact info
        const updateData: any = {
          status: 'analyzed',
          score: Math.round(analysisResult.score), // Round to integer for DB
          explanation: analysisResult.explanation,
          shortlisted: analysisResult.shortlist,
          notes: `${candidate.notes}\n\n--- ANALYSE ---\n${analysisResult.explanation}`
        };

        // Add extracted email and phone if found in CV
        if (analysisResult.extractedEmail && analysisResult.extractedEmail !== 'INFORMATION_MANQUANTE') {
          updateData.email = analysisResult.extractedEmail;
        }
        if (analysisResult.extractedPhone && analysisResult.extractedPhone !== 'INFORMATION_MANQUANTE') {
          // Normaliser le téléphone au format E.164
          updateData.phone = normalizePhone(analysisResult.extractedPhone);
        }

        // Save multi-provider analysis results if available
        if (analysisResult.evaluation) {
          updateData.evaluation_result = analysisResult.evaluation;
          updateData.relevance_months_direct = analysisResult.evaluation.relevance_summary.months_direct || 0;
          updateData.relevance_months_adjacent = analysisResult.evaluation.relevance_summary.months_adjacent || 0;
        }

        const { error: updateError } = await supabaseAdmin
          .from('candidates')
          .update(updateData)
          .eq('id', candidate.id);

        if (updateError) {
          console.error('[Update Error]', updateError);
          // Masquer les PII avant de logger updateData
          const maskedUpdateData = {
            ...updateData,
            email: updateData.email ? maskPII(updateData.email) : undefined,
            phone: updateData.phone ? maskPII(updateData.phone) : undefined,
            notes: updateData.notes ? maskPII(updateData.notes) : undefined
          };
          console.error('[Update Data]', JSON.stringify(maskedUpdateData, null, 2));
          throw new Error(`Erreur mise à jour candidat: ${updateError.message}`);
        }

        results.push({
          candidateId: candidate.id,
          name: `${candidate.first_name} ${candidate.last_name || ''}`.trim(),
          score: analysisResult.score,
          shortlist: analysisResult.shortlist
        });

        analyzed++;

      } catch (error) {
        console.error(`Error analyzing candidate ${candidate.id}:`, error);

        await supabaseAdmin
          .from('candidates')
          .update({ status: 'pending' })
          .eq('id', candidate.id);

        failed++;
      }
    }

    console.log(`\n✅ Batch analysis complete: ${analyzed} analyzed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Analyse terminée: ${analyzed} réussis, ${failed} échoués`,
      data: {
        analyzed,
        failed,
        results,
        shortlisted: results.filter(r => r.shortlist).length,
        mode: 'multi-provider-balanced'
      }
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse en lot' },
      { status: 500 }
    );
  }
}
