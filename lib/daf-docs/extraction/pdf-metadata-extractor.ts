/**
 * PDF Metadata Extractor - Extraction exhaustive des métadonnées
 *
 * Objectif : 99.99% de fiabilité sur l'extraction des métadonnées
 *
 * Extrait TOUTES les métadonnées disponibles :
 * - Propriétés du document (titre, auteur, dates, etc.)
 * - Structure du PDF (pages, taille, format)
 * - Propriétés techniques (version PDF, encryption, etc.)
 * - Texte brut complet
 * - Hash MD5 pour intégrité
 */

import PDFParser from 'pdf2json';
import crypto from 'crypto';

export interface PDFMetadata {
  // Informations du document
  info: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string; // Application qui a créé le PDF
    producer?: string; // Application qui a produit le PDF
    creationDate?: string;
    modificationDate?: string;
    [key: string]: any; // Autres propriétés personnalisées
  };

  // Structure du document
  structure: {
    pageCount: number;
    fileSizeBytes: number;
    pdfVersion?: string;
    isEncrypted: boolean;
    hasText: boolean;
    textLength: number;
    avgCharsPerPage: number;
  };

  // Analyse du contenu
  content: {
    fullText: string;
    textByPage?: string[]; // Si disponible
    type: 'native' | 'scanned' | 'hybrid';
    recommendation: 'simple-parser' | 'ocr-required';
  };

  // Intégrité
  integrity: {
    md5Hash: string;
    sha256Hash: string;
  };

  // Timing
  extraction: {
    durationMs: number;
    extractedAt: string; // ISO timestamp
  };
}

/**
 * Extrait TOUTES les métadonnées d'un PDF
 */
export async function extractPDFMetadata(pdfBuffer: ArrayBuffer | Buffer): Promise<PDFMetadata> {
  const startTime = Date.now();

  try {
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    // Parse le PDF avec pdf2json (pas de worker requis!)
    const pdfData = await new Promise<any>((resolve, reject) => {
      const pdfParser = new (PDFParser as any)(null, 1);

      pdfParser.on('pdfParser_dataReady', () => {
        resolve(pdfParser.data);
      });

      pdfParser.on('pdfParser_dataError', (error: Error) => {
        reject(error);
      });

      pdfParser.parseBuffer(buffer);
    });

    // Extract text
    const pdfParser2 = new (PDFParser as any)(null, 1);
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser2.on('pdfParser_dataReady', () => {
        resolve(pdfParser2.getRawTextContent());
      });
      pdfParser2.on('pdfParser_dataError', reject);
      pdfParser2.parseBuffer(buffer);
    });

    // Calcul des hash pour intégrité
    const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Analyse du type de document
    const textLength = text.length;
    const pageCount = pdfData?.Pages?.length || 0;
    const avgCharsPerPage = pageCount > 0 ? textLength / pageCount : 0;

    // Déterminer le type
    let type: 'native' | 'scanned' | 'hybrid';
    let recommendation: 'simple-parser' | 'ocr-required';

    if (avgCharsPerPage >= 100) {
      type = 'native';
      recommendation = 'simple-parser';
    } else if (avgCharsPerPage < 50) {
      type = 'scanned';
      recommendation = 'ocr-required';
    } else {
      type = 'hybrid';
      recommendation = 'ocr-required';
    }

    // Construire les métadonnées complètes
    const metadata: PDFMetadata = {
      info: {
        title: pdfData?.Meta?.Title || undefined,
        author: pdfData?.Meta?.Author || undefined,
        subject: pdfData?.Meta?.Subject || undefined,
        keywords: pdfData?.Meta?.Keywords || undefined,
        creator: pdfData?.Meta?.Creator || undefined,
        producer: pdfData?.Meta?.Producer || undefined,
        creationDate: pdfData?.Meta?.CreationDate ? formatPDFDate(pdfData.Meta.CreationDate) : undefined,
        modificationDate: pdfData?.Meta?.ModDate ? formatPDFDate(pdfData.Meta.ModDate) : undefined,
        // Copier toutes les autres propriétés
        ...pdfData?.Meta,
      },

      structure: {
        pageCount: pageCount,
        fileSizeBytes: buffer.length,
        pdfVersion: pdfData?.Meta?.PDFFormatVersion || undefined,
        isEncrypted: pdfData?.Meta?.IsAcroFormPresent === 'true' || false,
        hasText: textLength > 0,
        textLength: textLength,
        avgCharsPerPage: avgCharsPerPage,
      },

      content: {
        fullText: text,
        type,
        recommendation,
      },

      integrity: {
        md5Hash,
        sha256Hash,
      },

      extraction: {
        durationMs: Date.now() - startTime,
        extractedAt: new Date().toISOString(),
      },
    };

    console.log(`[PDF Metadata] Extracted complete metadata in ${metadata.extraction.durationMs}ms`);
    console.log(`[PDF Metadata] Document: ${metadata.info.title || 'Untitled'} (${metadata.structure.pageCount} pages, ${(metadata.structure.fileSizeBytes / 1024).toFixed(1)}KB)`);

    return metadata;

  } catch (error) {
    console.error('[PDF Metadata] Extraction error:', error);

    // Retourner des métadonnées minimales en cas d'erreur
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      info: {},
      structure: {
        pageCount: 0,
        fileSizeBytes: buffer.length,
        isEncrypted: false,
        hasText: false,
        textLength: 0,
        avgCharsPerPage: 0,
      },
      content: {
        fullText: '',
        type: 'scanned',
        recommendation: 'ocr-required',
      },
      integrity: {
        md5Hash,
        sha256Hash,
      },
      extraction: {
        durationMs: Date.now() - startTime,
        extractedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Formate une date PDF (format: D:YYYYMMDDHHmmSSOHH'mm')
 * vers ISO 8601
 */
function formatPDFDate(pdfDate: string): string | undefined {
  try {
    // Exemple: D:20240101120000+01'00'
    // Supprimer le préfixe D: et les quotes
    const cleaned = pdfDate.replace(/^D:/, '').replace(/'/g, '');

    // Extraire les parties
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    const hour = cleaned.substring(8, 10) || '00';
    const minute = cleaned.substring(10, 12) || '00';
    const second = cleaned.substring(12, 14) || '00';

    // Construire ISO 8601
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  } catch (error) {
    return undefined;
  }
}

/**
 * Génère un rapport complet en Markdown
 */
export function generateMetadataReport(metadata: PDFMetadata): string {
  let report = `# Rapport d'Analyse PDF\n\n`;

  // Section Info
  report += `## Informations du Document\n\n`;
  if (metadata.info.title) report += `- **Titre:** ${metadata.info.title}\n`;
  if (metadata.info.author) report += `- **Auteur:** ${metadata.info.author}\n`;
  if (metadata.info.subject) report += `- **Sujet:** ${metadata.info.subject}\n`;
  if (metadata.info.creator) report += `- **Créé avec:** ${metadata.info.creator}\n`;
  if (metadata.info.producer) report += `- **Produit par:** ${metadata.info.producer}\n`;
  if (metadata.info.creationDate) report += `- **Date de création:** ${metadata.info.creationDate}\n`;
  if (metadata.info.modificationDate) report += `- **Dernière modification:** ${metadata.info.modificationDate}\n`;

  // Section Structure
  report += `\n## Structure\n\n`;
  report += `- **Pages:** ${metadata.structure.pageCount}\n`;
  report += `- **Taille:** ${(metadata.structure.fileSizeBytes / 1024).toFixed(2)} KB\n`;
  report += `- **Version PDF:** ${metadata.structure.pdfVersion || 'Inconnue'}\n`;
  report += `- **Chiffré:** ${metadata.structure.isEncrypted ? 'Oui' : 'Non'}\n`;
  report += `- **Contient du texte:** ${metadata.structure.hasText ? 'Oui' : 'Non'}\n`;
  report += `- **Longueur du texte:** ${metadata.structure.textLength} caractères\n`;
  report += `- **Densité:** ${metadata.structure.avgCharsPerPage.toFixed(0)} caractères/page\n`;

  // Section Analyse
  report += `\n## Analyse du Contenu\n\n`;
  report += `- **Type:** ${metadata.content.type === 'native' ? 'PDF Natif' : metadata.content.type === 'scanned' ? 'PDF Scanné' : 'Hybride'}\n`;
  report += `- **Recommandation:** ${metadata.content.recommendation === 'simple-parser' ? 'Parser simple (économique)' : 'OCR requis (coûteux)'}\n`;

  // Section Intégrité
  report += `\n## Intégrité\n\n`;
  report += `- **MD5:** \`${metadata.integrity.md5Hash}\`\n`;
  report += `- **SHA-256:** \`${metadata.integrity.sha256Hash}\`\n`;

  // Section Extraction
  report += `\n## Extraction\n\n`;
  report += `- **Durée:** ${metadata.extraction.durationMs}ms\n`;
  report += `- **Date:** ${metadata.extraction.extractedAt}\n`;

  report += `\n---\n\n`;
  report += `*Rapport généré automatiquement par DAF Docs Assistant*`;

  return report;
}
