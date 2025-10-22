/**
 * Google Gemini API wrapper with retry logic
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { safeJSONParse } from '../utils/json';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export interface GeminiCallOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Call Gemini with retry logic and timeout
 */
export async function callGemini<T>(options: GeminiCallOptions): Promise<T> {
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
      logger.debug(`Gemini call attempt ${attempt + 1}/${maxRetries + 1} with model ${model}`);

      const geminiModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature
        }
      });

      // Combine system and user prompts for Gemini
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Gemini call timeout')), timeout);
      });

      const resultPromise = geminiModel.generateContent(fullPrompt);

      const result = await Promise.race([resultPromise, timeoutPromise]);

      const text = result.response.text();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = safeJSONParse<T>(text);
      if (!parsed) {
        throw new Error('Invalid JSON in Gemini response');
      }

      logger.info(`Gemini call successful (model: ${model})`);
      return parsed;

    } catch (error) {
      lastError = error as Error;
      logger.warn(`Gemini call attempt ${attempt + 1} failed:`, lastError.message);

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

  throw new Error(`Gemini call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Analyze CV with Gemini (Pass 2)
 */
export async function analyzeCVWithGemini(
  systemPrompt: string,
  cvJson: unknown,
  jobSpec: unknown
): Promise<unknown> {
  const model = process.env.CM_STAGE2_GEMINI || 'gemini-1.5-pro';

  const userPrompt = `Analyse ce CV par rapport au poste :

CV (JSON):
${JSON.stringify(cvJson, null, 2)}

Spécification du poste:
${JSON.stringify(jobSpec, null, 2)}

Retourne l'évaluation complète au format JSON demandé.`;

  return callGemini({
    model,
    systemPrompt,
    userPrompt,
    temperature: 0
  });
}
