import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { extractTextFromPDF, cleanPDFText, parseCV } from '@/lib/utils/pdf-extractor';
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

/**
 * Analyse un candidat avec le système déterministe
 */
async function analyzeCandidateDeterministic(
  candidate: any,
  cvText: string,
  jobSpec: JobSpec
) {
  // Parse CV to structured JSON
  const cvStructure = parseCV(cvText);

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

  // Build prompts
  const systemPrompt = buildEvaluatorSystemPrompt();
  const userPrompt = buildEvaluatorUserPrompt(jobSpec, cvJson);

  console.log(`[Deterministic] Analyzing ${candidate.first_name} ${candidate.last_name}`);

  // TEMPORARY FIX: Hardcode model to avoid env var issues
  const modelToUse = 'gpt-4o';
  console.log(`[Deterministic] Using model: ${modelToUse} (env var: ${process.env.CM_OPENAI_MODEL})`);

  // Call OpenAI with deterministic settings
  const completion = await openai.chat.completions.create({
    model: modelToUse,
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
    response_format: { type: 'json_object' }
  });

  const analysisText = completion.choices[0].message.content || '{}';
  const evaluation = parseEvaluationResult(analysisText);
  const legacyFormat = convertToLegacyFormat(evaluation);

  return {
    evaluation,
    legacyFormat,
    score: evaluation.overall_score_0_to_100,
    shortlist: evaluation.recommendation === 'SHORTLIST',
    explanation: `**ANALYSE DÉTERMINISTE**

**Score : ${evaluation.overall_score_0_to_100}/100**
Recommandation : ${evaluation.recommendation}

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
${evaluation.improvements.map(i => `• ${i.point}`).join('\n')}
${evaluation.fails.length > 0 ? `\n**⚠️ Règles non satisfaites :**\n${evaluation.fails.map(f => `• ${f.reason}`).join('\n')}` : ''}`
  };
}

/**
 * Analyse un candidat avec le système legacy
 */
async function analyzeCandidateLegacy(
  candidate: any,
  cvText: string,
  project: any
) {
  const prompt = `Tu es un expert en recrutement. Analyse RIGOUREUSEMENT ce CV par rapport au poste suivant.

**POSTE À POURVOIR:**
- Titre: ${project.job_title || 'Non spécifié'}
- Description: ${project.description || 'Non spécifiée'}
- Exigences: ${project.requirements || 'Non spécifiées'}

**CV DU CANDIDAT:**
${cvText}

Réponds en JSON:
{
  "score": number,
  "strengths": ["point fort 1", "point fort 2"],
  "weaknesses": ["point faible 1", "point faible 2"],
  "recommendation": "Recommandé|À considérer|Non recommandé",
  "summary": "Résumé en 2-3 phrases",
  "shortlist": boolean,
  "shortlist_reason": "Justification"
}`;

  console.log(`[Legacy] Analyzing ${candidate.first_name} ${candidate.last_name}`);

  // TEMPORARY FIX: Hardcode model to avoid env var issues
  const modelToUse = 'gpt-4o';
  console.log(`[Legacy] Using model: ${modelToUse} (env var: ${process.env.CM_OPENAI_MODEL})`);

  const completion = await openai.chat.completions.create({
    model: modelToUse,
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en recrutement. Réponds UNIQUEMENT en JSON valide.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const analysisText = completion.choices[0].message.content || '{}';
  const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const analysis = JSON.parse(cleanJson);

  return {
    score: analysis.score,
    shortlist: analysis.shortlist,
    explanation: `**Score:** ${analysis.score}/100

**Recommandation:** ${analysis.recommendation}

**Points forts:**
${analysis.strengths.map((s: string) => `• ${s}`).join('\n')}

**Points à améliorer:**
${analysis.weaknesses.map((w: string) => `• ${w}`).join('\n')}

**Résumé:**
${analysis.summary}

**Shortlist:** ${analysis.shortlist ? 'OUI' : 'NON'}
${analysis.shortlist_reason}`
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
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

    // Use custom JobSpec if provided, otherwise use project's JobSpec or default
    const jobSpec = customJobSpec ||
                   (project.job_spec_config as JobSpec | null) ||
                   createDefaultJobSpec(project);

    // ALWAYS use deterministic analysis (legacy mode deprecated)
    const useDeterministicAnalysis = true;

    console.log(`\n========== BATCH ANALYSIS ==========`);
    console.log(`Project: ${project.name}`);
    console.log(`Candidates: ${candidates.length}`);
    console.log(`Mode: 🎯 DÉTERMINISTE (improved multi-provider system)`);
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
        const pathMatch = candidate.notes?.match(/Path: ([^|]+)/);
        const cvPath = pathMatch ? pathMatch[1].trim() : null;
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

        // Analyze with appropriate method
        const analysisResult = useDeterministicAnalysis
          ? await analyzeCandidateDeterministic(candidate, cvText, jobSpec)
          : await analyzeCandidateLegacy(candidate, cvText, project);

        // Update candidate
        const updateData: any = {
          status: 'analyzed',
          score: Math.round(analysisResult.score), // Round to integer for DB
          explanation: analysisResult.explanation,
          shortlisted: analysisResult.shortlist,
          notes: `${candidate.notes}\n\n--- ANALYSE ---\n${analysisResult.explanation}`
        };

        // Note: evaluation_result, relevance_months_direct, relevance_months_adjacent
        // are not included as these columns don't exist in the candidates table yet
        // TODO: Add migration to create these columns if needed

        const { error: updateError } = await supabaseAdmin
          .from('candidates')
          .update(updateData)
          .eq('id', candidate.id);

        if (updateError) {
          console.error('[Update Error]', updateError);
          console.error('[Update Data]', JSON.stringify(updateData, null, 2));
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
        mode: useDeterministicAnalysis ? 'deterministic' : 'legacy'
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
