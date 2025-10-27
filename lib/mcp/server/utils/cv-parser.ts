/**
 * CV Parser Utility
 *
 * Parse les CVs depuis différentes sources (URL, texte direct, etc.)
 */

import pdf from 'pdf-parse';

/**
 * Télécharge et parse un CV depuis une URL
 *
 * @param cvUrl - URL du fichier CV (PDF, TXT, etc.)
 * @returns Texte extrait du CV
 */
export async function parseCVFromURL(cvUrl: string): Promise<string> {
  console.error(`[cv-parser] Downloading CV from: ${cvUrl}`);

  try {
    // 1. Télécharger le fichier
    const response = await fetch(cvUrl);

    if (!response.ok) {
      throw new Error(`Failed to download CV: ${response.status} ${response.statusText}`);
    }

    // 2. Obtenir le type de fichier
    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    console.error(`[cv-parser] Content-Type: ${contentType}, Size: ${buffer.length} bytes`);

    // 3. Parser selon le type
    if (contentType.includes('application/pdf') || cvUrl.endsWith('.pdf')) {
      return await parsePDF(buffer);
    } else if (contentType.includes('text/plain') || cvUrl.endsWith('.txt')) {
      return buffer.toString('utf-8');
    } else {
      // Essayer de détecter automatiquement
      console.error(`[cv-parser] Unknown content type, trying PDF parser...`);
      return await parsePDF(buffer);
    }
  } catch (error) {
    console.error('[cv-parser] Error parsing CV:', error);
    throw new Error(`CV_PARSE_ERROR: Failed to parse CV from URL - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse un PDF en texte
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    const text = data.text.trim();

    if (!text || text.length < 50) {
      throw new Error('PDF appears to be empty or too short');
    }

    console.error(`[cv-parser] ✅ PDF parsed successfully, ${text.length} characters extracted`);

    return text;
  } catch (error) {
    console.error('[cv-parser] PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Charge le CV d'un candidat (depuis cv_text si disponible, sinon depuis cv_url)
 *
 * @param candidate - Objet candidat avec cv_text et/ou cv_url
 * @returns Texte du CV
 */
export async function loadCandidateCV(candidate: {
  cv_text?: string | null;
  cv_url?: string | null;
  first_name?: string;
  last_name?: string;
}): Promise<string> {
  // Priorité 1: cv_text pré-parsé (si la colonne existe dans le futur)
  if (candidate.cv_text) {
    console.error(`[cv-parser] Using pre-parsed cv_text`);
    return candidate.cv_text;
  }

  // Priorité 2: cv_url (parser à la volée)
  if (candidate.cv_url) {
    console.error(`[cv-parser] Parsing CV from URL for ${candidate.first_name} ${candidate.last_name}`);
    return await parseCVFromURL(candidate.cv_url);
  }

  // Aucun CV disponible
  throw new Error('CV_MISSING: Candidate has no CV uploaded');
}
