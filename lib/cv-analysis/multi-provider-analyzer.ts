/**
 * Système d'analyse CV multi-provider (OpenAI + Gemini)
 * - Pass 1: Extraction avec OpenAI gpt-4o-mini
 * - Pass 2: Analyse parallèle avec OpenAI gpt-4o + Gemini gemini-1.5-pro
 * - Agrégation: Vote/moyenne avec traçabilité complète
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Ajv from 'ajv';
import type { JobSpec } from './deterministic-evaluator';
import cvSchema from './schemas/cv.schema.json';
import outputSchema from './schemas/output.schema.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ajv = new Ajv();
const validateCV = ajv.compile(cvSchema);
const validateOutput = ajv.compile(outputSchema);

// Types
export interface CV_JSON {
  identite: {
    prenom: string;
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    linkedin?: string;
    github?: string;
  };
  experiences: Array<{
    index: number;
    titre: string;
    employeur?: string;
    date_debut?: string;
    date_fin?: string | null;
    missions?: string[];
    lieu?: string;
    type_contrat?: string;
  }>;
  formations: Array<{
    index: number;
    intitule: string;
    etablissement?: string;
    annee?: string;
    lieu?: string;
    niveau?: string;
  }>;
  competences: string[];
  langues?: Array<{
    langue: string;
    niveau?: string;
  }>;
  certifications?: Array<{
    nom: string;
    organisme?: string;
    date?: string;
  }>;
  projets?: Array<{
    titre: string;
    description?: string;
    technologies?: string[];
    url?: string;
  }>;
  texte_brut?: string;
}

export interface Evidence {
  quote: string;
  field_path: string;
}

export interface EvaluationOutput {
  meets_all_must_have: boolean;
  fails: Array<{
    rule_id: string;
    reason: string;
    evidence: Evidence[];
  }>;
  relevance_summary: {
    months_direct: number;
    months_adjacent: number;
    months_peripheral: number;
    months_non_pertinent: number;
    by_experience: Array<{
      index: number;
      titre: string;
      employeur?: string;
      start?: string;
      end?: string | null;
      relevance: 'DIRECTE' | 'ADJACENTE' | 'PERIPHERIQUE' | 'NON_PERTINENTE';
      reason: string;
      evidence: Evidence[];
    }>;
  };
  subscores: {
    experience_years_relevant: number;
    skills_match_0_to_100: number;
    nice_to_have_0_to_100: number;
  };
  overall_score_0_to_100: number;
  recommendation: 'SHORTLIST' | 'CONSIDER' | 'REJECT';
  strengths: Array<{
    point: string;
    evidence: Evidence[];
  }>;
  improvements: Array<{
    point: string;
    why: string;
    suggested_action: string;
  }>;
  evidence_global?: Evidence[];
}

export interface AggregatedResult {
  result: EvaluationOutput;
  providers_raw: {
    openai?: EvaluationOutput;
    gemini?: EvaluationOutput;
  };
  debug: {
    model_disagreements: Array<{
      field: string;
      openai_value: any;
      gemini_value: any;
    }>;
    providers_used: string[];
    aggregation_method: string;
  };
}

/**
 * PASS 1: Extraction du CV en JSON structuré
 */
export async function extractCV(cvText: string): Promise<CV_JSON> {
  console.log('[Pass 1] Starting CV extraction with gpt-4o-mini...');

  const systemPrompt = `Tu es un extracteur de CV expert. Ta mission est d'extraire TOUTES les informations d'un CV en JSON structuré.

**RÈGLES STRICTES:**
1. N'INVENTE RIEN - Si une info manque, utilise "INFORMATION_MANQUANTE"
2. Respecte exactement le schéma JSON fourni
3. Pour les dates: format "YYYY-MM" ou "INFORMATION_MANQUANTE"
4. Indexe les expériences et formations à partir de 0
5. Si une date de fin est "actuel" ou "présent", utilise "en cours"
6. Extrais toutes les compétences mentionnées (techniques, langues, soft skills)

Réponds UNIQUEMENT avec le JSON structuré, sans markdown ni commentaire.`;

  const userPrompt = `Extrait toutes les informations de ce CV en JSON:

${cvText}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0,
    response_format: { type: 'json_object' }
  });

  const extracted = JSON.parse(completion.choices[0].message.content || '{}');
  extracted.texte_brut = cvText;

  // Validation avec AJV
  const valid = validateCV(extracted);
  if (!valid) {
    console.error('[Pass 1] Validation failed:', validateCV.errors);
    throw new Error(`CV extraction validation failed: ${JSON.stringify(validateCV.errors)}`);
  }

  console.log('[Pass 1] ✅ CV extracted successfully');
  return extracted as CV_JSON;
}

/**
 * Construit le system prompt universel pour l'analyse
 */
function buildUniversalSystemPrompt(): string {
  return `Tu es un évaluateur de candidatures strict, impartial et auditable pour TOUS LES MÉTIERS.

**PRINCIPES FONDAMENTAUX:**

1. **Zéro invention** : Utilise UNIQUEMENT les données présentes dans CV_JSON
2. **Preuves obligatoires** : Chaque décision doit avoir des evidence avec quote + field_path
3. **Taxonomie de pertinence** :
   - DIRECTE : Même métier/fonction que le poste cible
   - ADJACENTE : Compétences transférables, secteur proche
   - PÉRIPHÉRIQUE : Même secteur mais fonction différente
   - NON_PERTINENTE : Hors sujet

4. **Calcul des mois** : Date début → Date fin (ou aujourd'hui si "en cours")
5. **Must-have** : Règles qui DOIVENT être satisfaites
   - severity "critical" → échec = REJECT automatique
   - severity "standard" → échec noté mais pas éliminatoire

**SCORING:**

subscores.experience_years_relevant = (mois_direct + p_adjacent * mois_adjacent) / 12
  où p_adjacent vient de weights.p_adjacent (défaut 0.5)

subscores.skills_match_0_to_100 = % compétences CV présentes dans skills_required

subscores.nice_to_have_0_to_100 = % compétences CV présentes dans nice_to_have

score_exp_norm = min(1, experience_years_relevant / thresholds.years_full_score)

overall_score_0_to_100 = 100 * (w_exp * score_exp_norm + w_skills * (skills/100) + w_nice * (nice/100))

**RECOMMANDATION:**
- Si un must-have "critical" échoue → REJECT
- Sinon si overall ≥ thresholds.shortlist_min → SHORTLIST
- Sinon si overall ≥ thresholds.consider_min → CONSIDER
- Sinon → REJECT

**OUTPUT:**
Réponds UNIQUEMENT avec un JSON valide conforme au schéma. Pas de markdown, pas de commentaire.`;
}

/**
 * PASS 2a: Analyse avec OpenAI gpt-4o
 */
export async function analyzeWithOpenAI(
  jobSpec: JobSpec,
  cvJson: CV_JSON
): Promise<EvaluationOutput> {
  console.log('[Pass 2a] Starting analysis with OpenAI gpt-4o...');

  const systemPrompt = buildUniversalSystemPrompt();
  const userPrompt = `JOB_SPEC:
${JSON.stringify(jobSpec, null, 2)}

CV_JSON:
${JSON.stringify(cvJson, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0,
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(completion.choices[0].message.content || '{}');

  // Validation
  const valid = validateOutput(result);
  if (!valid) {
    console.error('[Pass 2a] OpenAI validation failed:', validateOutput.errors);
    throw new Error(`OpenAI output validation failed: ${JSON.stringify(validateOutput.errors)}`);
  }

  console.log('[Pass 2a] ✅ OpenAI analysis completed');
  return result as EvaluationOutput;
}

/**
 * PASS 2b: Analyse avec Gemini gemini-1.5-pro
 */
export async function analyzeWithGemini(
  jobSpec: JobSpec,
  cvJson: CV_JSON
): Promise<EvaluationOutput> {
  console.log('[Pass 2b] Starting analysis with Gemini gemini-1.5-pro...');

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json'
    }
  });

  const systemPrompt = buildUniversalSystemPrompt();
  const userPrompt = `JOB_SPEC:
${JSON.stringify(jobSpec, null, 2)}

CV_JSON:
${JSON.stringify(cvJson, null, 2)}`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt }
  ]);

  const response = result.response;
  const resultText = response.text();
  const parsed = JSON.parse(resultText);

  // Validation
  const valid = validateOutput(parsed);
  if (!valid) {
    console.error('[Pass 2b] Gemini validation failed:', validateOutput.errors);
    throw new Error(`Gemini output validation failed: ${JSON.stringify(validateOutput.errors)}`);
  }

  console.log('[Pass 2b] ✅ Gemini analysis completed');
  return parsed as EvaluationOutput;
}

/**
 * Agrégation et vote des résultats
 */
export async function aggregateResults(
  openaiResult: EvaluationOutput | null,
  geminiResult: EvaluationOutput | null
): Promise<AggregatedResult> {
  console.log('[Aggregation] Starting result aggregation...');

  const disagreements: Array<{ field: string; openai_value: any; gemini_value: any }> = [];
  const providersUsed: string[] = [];

  // Fallback si un seul provider
  if (!openaiResult && !geminiResult) {
    throw new Error('Both providers failed');
  }

  if (!openaiResult) {
    console.log('[Aggregation] ⚠️ OpenAI failed, using Gemini only');
    return {
      result: geminiResult!,
      providers_raw: { gemini: geminiResult! },
      debug: {
        model_disagreements: [],
        providers_used: ['gemini'],
        aggregation_method: 'fallback_gemini'
      }
    };
  }

  if (!geminiResult) {
    console.log('[Aggregation] ⚠️ Gemini failed, using OpenAI only');
    return {
      result: openaiResult,
      providers_raw: { openai: openaiResult },
      debug: {
        model_disagreements: [],
        providers_used: ['openai'],
        aggregation_method: 'fallback_openai'
      }
    };
  }

  // Les deux sont valides → Agrégation
  providersUsed.push('openai', 'gemini');

  // 1. meets_all_must_have = AND
  const meetsAllMustHave = openaiResult.meets_all_must_have && geminiResult.meets_all_must_have;
  if (openaiResult.meets_all_must_have !== geminiResult.meets_all_must_have) {
    disagreements.push({
      field: 'meets_all_must_have',
      openai_value: openaiResult.meets_all_must_have,
      gemini_value: geminiResult.meets_all_must_have
    });
  }

  // 2. fails = union dédupliquée
  const allFails = [...openaiResult.fails, ...geminiResult.fails];
  const failsMap = new Map<string, typeof allFails[0]>();
  for (const fail of allFails) {
    if (!failsMap.has(fail.rule_id)) {
      failsMap.set(fail.rule_id, fail);
    }
  }
  const fails = Array.from(failsMap.values());

  // 3. subscores = moyenne pondérée (OpenAI 55%, Gemini 45%)
  const subscores = {
    experience_years_relevant:
      0.55 * openaiResult.subscores.experience_years_relevant +
      0.45 * geminiResult.subscores.experience_years_relevant,
    skills_match_0_to_100: Math.round(
      0.55 * openaiResult.subscores.skills_match_0_to_100 +
      0.45 * geminiResult.subscores.skills_match_0_to_100
    ),
    nice_to_have_0_to_100: Math.round(
      0.55 * openaiResult.subscores.nice_to_have_0_to_100 +
      0.45 * geminiResult.subscores.nice_to_have_0_to_100
    )
  };

  if (Math.abs(openaiResult.subscores.skills_match_0_to_100 - geminiResult.subscores.skills_match_0_to_100) > 10) {
    disagreements.push({
      field: 'subscores.skills_match',
      openai_value: openaiResult.subscores.skills_match_0_to_100,
      gemini_value: geminiResult.subscores.skills_match_0_to_100
    });
  }

  // 4. overall_score = moyenne
  const overallScore =
    0.55 * openaiResult.overall_score_0_to_100 +
    0.45 * geminiResult.overall_score_0_to_100;

  if (Math.abs(openaiResult.overall_score_0_to_100 - geminiResult.overall_score_0_to_100) > 10) {
    disagreements.push({
      field: 'overall_score',
      openai_value: openaiResult.overall_score_0_to_100,
      gemini_value: geminiResult.overall_score_0_to_100
    });
  }

  // 5. recommendation = vote majoritaire
  const recommendations = [openaiResult.recommendation, geminiResult.recommendation];
  let recommendation: 'SHORTLIST' | 'CONSIDER' | 'REJECT';

  // Si un must-have critique échoue → REJECT
  const hasCriticalFail = fails.some(f => f.rule_id.includes('critical') || f.reason.includes('critique'));
  if (hasCriticalFail) {
    recommendation = 'REJECT';
  } else if (recommendations.includes('SHORTLIST')) {
    recommendation = 'SHORTLIST';
  } else if (recommendations.includes('CONSIDER')) {
    recommendation = 'CONSIDER';
  } else {
    recommendation = 'REJECT';
  }

  if (openaiResult.recommendation !== geminiResult.recommendation) {
    disagreements.push({
      field: 'recommendation',
      openai_value: openaiResult.recommendation,
      gemini_value: geminiResult.recommendation
    });
  }

  // 6. relevance_summary = moyennes arrondies
  const relevanceSummary = {
    months_direct: Math.round(
      (openaiResult.relevance_summary.months_direct + geminiResult.relevance_summary.months_direct) / 2
    ),
    months_adjacent: Math.round(
      (openaiResult.relevance_summary.months_adjacent + geminiResult.relevance_summary.months_adjacent) / 2
    ),
    months_peripheral: Math.round(
      (openaiResult.relevance_summary.months_peripheral + geminiResult.relevance_summary.months_peripheral) / 2
    ),
    months_non_pertinent: Math.round(
      (openaiResult.relevance_summary.months_non_pertinent + geminiResult.relevance_summary.months_non_pertinent) / 2
    ),
    by_experience: openaiResult.relevance_summary.by_experience // Prendre OpenAI comme référence
  };

  // 7. strengths/improvements = concaténation dédupliquée
  const strengthsMap = new Map<string, typeof openaiResult.strengths[0]>();
  for (const s of [...openaiResult.strengths, ...geminiResult.strengths]) {
    if (!strengthsMap.has(s.point)) {
      strengthsMap.set(s.point, s);
    }
  }
  const strengths = Array.from(strengthsMap.values());

  const improvementsMap = new Map<string, typeof openaiResult.improvements[0]>();
  for (const i of [...openaiResult.improvements, ...geminiResult.improvements]) {
    if (!improvementsMap.has(i.point)) {
      improvementsMap.set(i.point, i);
    }
  }
  const improvements = Array.from(improvementsMap.values());

  console.log(`[Aggregation] ✅ Aggregated results with ${disagreements.length} disagreements`);

  return {
    result: {
      meets_all_must_have: meetsAllMustHave,
      fails,
      relevance_summary: relevanceSummary,
      subscores,
      overall_score_0_to_100: overallScore,
      recommendation,
      strengths,
      improvements,
      evidence_global: [
        ...(openaiResult.evidence_global || []),
        ...(geminiResult.evidence_global || [])
      ]
    },
    providers_raw: {
      openai: openaiResult,
      gemini: geminiResult
    },
    debug: {
      model_disagreements: disagreements,
      providers_used: providersUsed,
      aggregation_method: 'weighted_average'
    }
  };
}

/**
 * Orchestrateur principal: Analyse complète multi-provider
 */
export async function analyzeCV(
  cvText: string,
  jobSpec: JobSpec
): Promise<AggregatedResult> {
  console.log('\n========== MULTI-PROVIDER CV ANALYSIS ==========');
  console.log(`Job: ${jobSpec.title}`);

  try {
    // PASS 1: Extraction
    const cvJson = await extractCV(cvText);

    // PASS 2: Analyse parallèle
    const [openaiResult, geminiResult] = await Promise.allSettled([
      analyzeWithOpenAI(jobSpec, cvJson),
      analyzeWithGemini(jobSpec, cvJson)
    ]);

    const openaiData = openaiResult.status === 'fulfilled' ? openaiResult.value : null;
    const geminiData = geminiResult.status === 'fulfilled' ? geminiResult.value : null;

    if (openaiResult.status === 'rejected') {
      console.error('[Pass 2a] OpenAI failed:', openaiResult.reason);
    }
    if (geminiResult.status === 'rejected') {
      console.error('[Pass 2b] Gemini failed:', geminiResult.reason);
    }

    // Agrégation
    const result = await aggregateResults(openaiData, geminiData);

    console.log(`[Final] Score: ${result.result.overall_score_0_to_100.toFixed(1)}/100`);
    console.log(`[Final] Recommendation: ${result.result.recommendation}`);
    console.log(`[Final] Providers used: ${result.debug.providers_used.join(', ')}`);
    console.log(`[Final] Disagreements: ${result.debug.model_disagreements.length}`);
    console.log('================================================\n');

    return result;
  } catch (error) {
    console.error('[Fatal] Analysis failed:', error);
    throw error;
  }
}
