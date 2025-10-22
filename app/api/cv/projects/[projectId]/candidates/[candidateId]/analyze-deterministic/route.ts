import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyOrgAccess } from '@/lib/auth/verify-auth';
import { extractTextFromPDF, cleanPDFText, parseCV } from '@/lib/utils/pdf-extractor';
import { handleApiError } from '@/lib/utils/error-handler';
import OpenAI from 'openai';
import {
  buildEvaluatorSystemPrompt,
  buildEvaluatorUserPrompt,
  createDefaultJobSpec,
  parseEvaluationResult,
  convertToLegacyFormat,
  type JobSpec
} from '@/lib/cv-analysis/deterministic-evaluator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; candidateId: string }> }
) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { projectId, candidateId } = await params;
    const body = await request.json();
    const customJobSpec = body.jobSpec as JobSpec | undefined;

    // Get candidate and project info
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select(`
        *,
        project:projects(
          id,
          name,
          job_title,
          requirements,
          description,
          org_id,
          job_spec_config
        )
      `)
      .eq('id', candidateId)
      .eq('project_id', projectId)
      .single();

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

    console.log(`\n========== ANALYSE DÉTERMINISTE ==========`);
    console.log(`Candidate ID: ${candidateId}`);
    console.log(`Candidate Name: ${candidate.first_name} ${candidate.last_name}`);

    // Extract PDF text
    let cvText = '';
    const pathMatch = candidate.notes?.match(/Path: ([^|\n]+)/);
    const filePath = pathMatch?.[1]?.trim();

    if (filePath) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
      }

      // SECURITY: Validate filePath
      if (!filePath || filePath.includes('..') || filePath.includes('//')) {
        throw new Error('Invalid file path detected');
      }

      const pdfUrl = `${supabaseUrl}/storage/v1/object/public/cv/${filePath}`;
      console.log(`[PDF Extract] URL: ${pdfUrl}`);

      try {
        const rawText = await extractTextFromPDF(pdfUrl);
        cvText = cleanPDFText(rawText);
        console.log(`✅ PDF extracted: ${cvText.length} characters`);
      } catch (pdfError) {
        console.error(`❌ PDF extraction failed:`, pdfError);
        cvText = 'ERREUR: Impossible d\'extraire le texte du CV';
      }
    }

    // Parse CV to structured JSON
    const cvStructure = parseCV(cvText);

    // Build CV_JSON
    const cvJson = {
      identite: {
        prenom: candidate.first_name || 'INFORMATION_MANQUANTE',
        nom: candidate.last_name || '',
        email: candidate.email || 'INFORMATION_MANQUANTE',
        telephone: candidate.phone || 'INFORMATION_MANQUANTE'
      },
      experiences: cvStructure.experience.map((exp, index) => ({
        index,
        titre: exp,
        employeur: 'INFORMATION_MANQUANTE',
        date_debut: 'INFORMATION_MANQUANTE',
        date_fin: 'INFORMATION_MANQUANTE',
        missions: [exp]
      })),
      formations: cvStructure.education.map((edu, index) => ({
        index,
        intitule: edu,
        etablissement: 'INFORMATION_MANQUANTE',
        annee: 'INFORMATION_MANQUANTE'
      })),
      competences: cvStructure.skills,
      langues: cvStructure.languages,
      texte_brut: cvText
    };

    // Get or create JOB_SPEC
    const project = candidate.project as any;
    const jobSpec: JobSpec = customJobSpec ||
      project.job_spec_config ||
      createDefaultJobSpec(project);

    console.log(`[Job Spec] Title: ${jobSpec.title}`);
    console.log(`[Job Spec] Must-have: ${jobSpec.must_have.length} règles`);

    // Build prompts
    const systemPrompt = buildEvaluatorSystemPrompt();
    const userPrompt = buildEvaluatorUserPrompt(jobSpec, cvJson);

    console.log(`\n========== ENVOI VERS OPENAI ==========`);

    // Call OpenAI with deterministic settings
    const completion = await openai.chat.completions.create({
      model: process.env.CM_OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0, // DÉTERMINISTE
      top_p: 0.1, // DÉTERMINISTE
      max_tokens: 2500,
      response_format: { type: 'json_object' } // Force JSON
    });

    const analysisText = completion.choices[0].message.content || '{}';
    console.log(`\n========== RÉPONSE OPENAI ==========`);
    console.log(analysisText.substring(0, 500) + '...');

    // Parse and validate result
    const evaluation = parseEvaluationResult(analysisText);

    // Convert to legacy format for UI compatibility
    const legacyFormat = convertToLegacyFormat(evaluation);

    // Prepare detailed explanation
    const explanation = `**ANALYSE DÉTERMINISTE**

**Score global : ${evaluation.overall_score_0_to_100}/100**
Recommandation : ${evaluation.recommendation}

**Sous-scores :**
- Expérience pertinente : ${evaluation.subscores.experience_years_relevant.toFixed(1)} ans
- Compétences : ${evaluation.subscores.skills_match_0_to_100}%
- Nice-to-have : ${evaluation.subscores.nice_to_have_0_to_100}%

**Pertinence des expériences :**
- ${evaluation.relevance_summary.months_direct} mois d'expérience DIRECTE
- ${evaluation.relevance_summary.months_adjacent} mois d'expérience ADJACENTE
- ${evaluation.relevance_summary.months_peripheral} mois d'expérience PÉRIPHÉRIQUE

**Points forts :**
${evaluation.strengths.map(s => `• ${s.point}`).join('\n')}

**Points d'amélioration :**
${evaluation.improvements.map(i => `• ${i.point}\n  → ${i.suggested_action}`).join('\n')}

${evaluation.fails.length > 0 ? `\n**⚠️ Règles non satisfaites :**\n${evaluation.fails.map(f => `• ${f.reason}`).join('\n')}` : ''}
`;

    // Update candidate with analysis results
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({
        status: 'analyzed',
        score: evaluation.overall_score_0_to_100,
        explanation: explanation,
        shortlisted: evaluation.recommendation === 'SHORTLIST',
        notes: `${candidate.notes}\n\n--- ANALYSE DÉTERMINISTE ---\n${explanation}`,
        evaluation_result: evaluation // Store full result as JSONB
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
        score: evaluation.overall_score_0_to_100,
        recommendation: evaluation.recommendation,
        analysis: legacyFormat,
        evaluation: evaluation, // Full deterministic result
        message: 'Analyse déterministe terminée'
      }
    });

  } catch (error) {
    console.error('Deterministic analysis error:', error);

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

    return handleApiError(error);
  }
}
