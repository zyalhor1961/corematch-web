/**
 * Générateur automatique de JobSpec via OpenAI
 * Crée une configuration déterministe à partir de la description du poste
 */

import OpenAI from 'openai';
import type { JobSpec } from './deterministic-evaluator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Génère un JobSpec complet à partir des informations du projet
 */
export async function generateJobSpec(projectInfo: {
  job_title: string;
  description?: string;
  requirements?: string;
}): Promise<JobSpec> {
  const systemPrompt = `Tu es un expert en recrutement et en analyse de compétences.
Ta mission est de créer une configuration JOB_SPEC détaillée et structurée à partir d'une description de poste.

**OBJECTIF:** Produire un JSON conforme au schéma JobSpec avec:
- Must-have rules (règles obligatoires, max 10)
- Skills required (compétences techniques requises, max 30)
- Nice-to-have (compétences bonus, max 20)
- Relevance rules (taxonomie d'expérience: DIRECTE, ADJACENTE, PÉRIPHÉRIQUE)
- Weights (poids: w_exp, w_skills, w_nice, p_adjacent)
- Thresholds (seuils: years_full_score, shortlist_min, consider_min)

**PRINCIPES:**
1. **Must-have:** Identifie les critères VRAIMENT obligatoires (diplômes critiques, expérience minimale, certifications).
   - severity: "critical" = éliminatoire si non satisfait
   - severity: "standard" = important mais pas éliminatoire

2. **Skills required:** Liste les compétences techniques/métier essentielles (langages, outils, méthodes)

3. **Nice-to-have:** Compétences valorisées mais non essentielles

4. **Relevance rules:**
   - direct: Mots-clés du poste exact (ex: "développeur java" → ["java", "développeur", "programmer"])
   - adjacent: Compétences transférables (ex: "enseignant" → ["formateur", "tuteur", "pédagogue"])
   - peripheral: Secteurs/contextes similaires (ex: "finance" → ["banque", "assurance", "comptabilité"])

5. **Weights:** Ajuste selon le poste:
   - w_exp: Importance de l'expérience (0.3-0.6, défaut 0.5)
   - w_skills: Importance des compétences (0.2-0.5, défaut 0.3)
   - w_nice: Importance du bonus (0.1-0.3, défaut 0.2)
   - p_adjacent: Poids des expériences adjacentes (0.3-0.7, défaut 0.5)

6. **Thresholds:**
   - years_full_score: Années d'expérience pour score max (2-5, défaut 3)
   - shortlist_min: Score minimum pour shortlist (70-85, défaut 75)
   - consider_min: Score minimum pour considération (55-70, défaut 60)

**IMPORTANT:** Sois PRÉCIS et RÉALISTE. Base-toi sur les informations fournies.

Réponds UNIQUEMENT avec un JSON conforme au schéma suivant:

{
  "title": "string",
  "must_have": [
    {"id": "M1", "desc": "...", "severity": "critical|standard"}
  ],
  "skills_required": ["skill1", "skill2"],
  "nice_to_have": ["bonus1", "bonus2"],
  "relevance_rules": {
    "direct": ["keyword1", "keyword2"],
    "adjacent": ["keyword3"],
    "peripheral": ["keyword4"]
  },
  "weights": {
    "w_exp": 0.5,
    "w_skills": 0.3,
    "w_nice": 0.2,
    "p_adjacent": 0.5
  },
  "thresholds": {
    "years_full_score": 3,
    "shortlist_min": 75,
    "consider_min": 60
  }
}`;

  const userPrompt = `**POSTE À ANALYSER:**

**Titre:** ${projectInfo.job_title || 'Non spécifié'}

**Description:**
${projectInfo.description || 'Non fournie'}

**Exigences:**
${projectInfo.requirements || 'Non fournies'}

---

Génère maintenant le JOB_SPEC complet en JSON.`;

  console.log('[JobSpec Generator] Calling OpenAI with gpt-4o...');

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.CM_OPENAI_MODEL || 'gpt-4o',
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
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const resultText = completion.choices[0]?.message?.content;
    if (!resultText) {
      throw new Error('No content returned from OpenAI');
    }

    let jobSpec: JobSpec;
    try {
      jobSpec = JSON.parse(resultText) as JobSpec;
    } catch (parseError) {
      console.error('[JobSpec Generator] JSON parse error:', parseError);
      console.error('[JobSpec Generator] Raw response:', resultText);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // Validate required fields
    if (!jobSpec.title || !Array.isArray(jobSpec.must_have) || !Array.isArray(jobSpec.skills_required)) {
      console.error('[JobSpec Generator] Invalid JobSpec structure:', jobSpec);
      throw new Error('Generated JobSpec is missing required fields');
    }

    // Ajouter la date d'analyse
    jobSpec.analysis_date = new Date().toISOString().split('T')[0];

    console.log('[JobSpec Generator] Generated successfully');
    console.log(`- Must-have: ${jobSpec.must_have.length} rules`);
    console.log(`- Skills required: ${jobSpec.skills_required.length}`);
    console.log(`- Nice-to-have: ${jobSpec.nice_to_have?.length || 0}`);

    return jobSpec;
  } catch (error) {
    console.error('[JobSpec Generator] Error:', error);
    if (error instanceof Error) {
      throw new Error(`JobSpec generation failed: ${error.message}`);
    }
    throw new Error('JobSpec generation failed: Unknown error');
  }
}
