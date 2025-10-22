/**
 * OpenAI API wrapper with retry logic
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { safeJSONParse } from '../utils/json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface OpenAICallOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Call OpenAI with retry logic and timeout
 */
export async function callOpenAI<T>(options: OpenAICallOptions): Promise<T> {
  const {
    model,
    systemPrompt,
    userPrompt,
    temperature = 0,
    maxRetries = 2,
    timeout = 30000
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`OpenAI call attempt ${attempt + 1}/${maxRetries + 1} with model ${model}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        response_format: { type: 'json_object' }
      }, {
        signal: controller.signal as AbortSignal
      });

      clearTimeout(timeoutId);

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = safeJSONParse<T>(content);
      if (!parsed) {
        throw new Error('Invalid JSON in OpenAI response');
      }

      logger.info(`OpenAI call successful (model: ${model}, tokens: ${completion.usage?.total_tokens || 'N/A'})`);
      return parsed;

    } catch (error) {
      lastError = error as Error;
      logger.warn(`OpenAI call attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry on certain errors
      if (error instanceof Error && (
        error.message.includes('API key') ||
        error.message.includes('model')
      )) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        logger.debug(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`OpenAI call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Extract CV using OpenAI (Pass 1)
 */
export async function extractCVWithOpenAI(cvText: string): Promise<unknown> {
  const model = process.env.CM_STAGE1_MODEL || 'gpt-4o-mini';

  const systemPrompt = `Vous êtes un extracteur de CV neutre et précis.
Langue de sortie : français. Répondez uniquement en JSON conforme au schéma demandé.

Règles d'extraction :
- Zéro invention : si une information manque, écrire "INFORMATION_MANQUANTE" ou laisser le champ vide selon le schéma.
- Dates au format ISO : YYYY-MM ou YYYY-MM-DD pour debut_iso/fin_iso, YYYY ou YYYY-MM pour obtention_iso.
- Pour les expériences en cours : en_cours = true et fin_iso = null.
- Extraire toutes les missions/responsabilités dans le tableau missions.
- Extraire toutes les compétences techniques dans competences (liste de strings).

Ne portez aucun jugement, ne faites aucune évaluation. Extraction brute uniquement.`;

  const userPrompt = `Extrait les informations suivantes du CV ci-dessous et retourne-les au format JSON :

CV:
${cvText}

Retourne un JSON avec: identite, experiences (avec debut_iso, fin_iso, en_cours, missions), formations, competences, langues.`;

  return callOpenAI({
    model,
    systemPrompt,
    userPrompt,
    temperature: 0
  });
}

/**
 * Analyze CV with OpenAI (Pass 2)
 */
export async function analyzeCVWithOpenAI(
  systemPrompt: string,
  cvJson: unknown,
  jobSpec: unknown
): Promise<unknown> {
  const model = process.env.CM_STAGE2_OPENAI || 'gpt-4o';

  const userPrompt = `Analyse ce CV par rapport au poste :

CV (JSON):
${JSON.stringify(cvJson, null, 2)}

Spécification du poste:
${JSON.stringify(jobSpec, null, 2)}

Retourne l'évaluation complète au format JSON demandé.`;

  return callOpenAI({
    model,
    systemPrompt,
    userPrompt,
    temperature: 0
  });
}
