/**
 * CV extraction module (Pass 1)
 */

import { extractCVWithOpenAI } from '../vendors/openai';
import { validateCV } from '../utils/json';
import { logger } from '../utils/logger';

export interface CV_JSON {
  identite?: {
    nom?: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    linkedin?: string;
    github?: string;
  };
  experiences: Array<{
    titre: string;
    employeur?: string;
    ville_pays?: string;
    debut_iso: string;
    fin_iso?: string | null;
    en_cours?: boolean;
    missions?: string[];
  }>;
  formations?: Array<{
    intitule?: string;
    niveau?: string;
    etablissement?: string;
    obtention_iso?: string;
  }>;
  competences: string[];
  langues?: Array<{
    langue: string;
    niveau?: string;
  }>;
  evidences?: Array<{
    field: string;
    quote: string;
  }>;
}

/**
 * Extract CV information from raw text (Pass 1)
 * Uses OpenAI gpt-4o-mini with temperature=0
 */
export async function extractCV(cvText: string): Promise<CV_JSON> {
  logger.info('Starting CV extraction (Pass 1)');

  try {
    const extracted = await extractCVWithOpenAI(cvText);

    // Validate against schema
    if (!validateCV(extracted)) {
      throw new Error('CV extraction validation failed');
    }

    logger.info('CV extraction completed successfully');
    return extracted as CV_JSON;

  } catch (error) {
    logger.error('CV extraction failed:', error);
    throw new Error(`CV extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
