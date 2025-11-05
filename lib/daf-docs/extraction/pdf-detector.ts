/**
 * PDF Type Detector
 *
 * Détecte si un PDF est :
 * - "native" : Contient du texte sélectionnable (facile à parser)
 * - "scanned" : Contient des images/scan (nécessite OCR)
 *
 * Utilisé pour optimiser les coûts :
 * - PDF natif → Simple text extraction (gratuit)
 * - PDF scanné → Landing AI / Azure DI (payant mais nécessaire)
 */

import PDFParser from 'pdf2json';

export interface PDFAnalysis {
  type: 'native' | 'scanned' | 'hybrid';
  textLength: number;
  pageCount: number;
  avgTextPerPage: number;
  confidence: number;
  recommendation: 'simple-parser' | 'ocr-required';
  details: {
    hasText: boolean;
    textRatio: number; // 0-1, ratio de texte par page
    likelyScanned: boolean;
  };
}

/**
 * Seuils de détection
 */
const THRESHOLDS = {
  // Nombre moyen de caractères par page pour un PDF natif
  MIN_CHARS_PER_PAGE: 100,

  // Ratio minimum de texte pour considérer comme natif
  MIN_TEXT_RATIO: 0.5,

  // Si moins que ça, c'est probablement un scan
  SCAN_THRESHOLD: 50,
};

/**
 * Parse PDF avec pdf2json (retourne une Promise)
 */
function parsePDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1); // raw text mode

    pdfParser.on('pdfParser_dataReady', () => {
      try {
        const text = pdfParser.getRawTextContent();
        const pageCount = pdfParser.data?.Pages?.length || 0;
        resolve({ text, pageCount });
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.on('pdfParser_dataError', (error: Error) => {
      reject(error);
    });

    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Analyse un PDF pour déterminer son type
 */
export async function analyzePDFType(pdfBuffer: ArrayBuffer): Promise<PDFAnalysis> {
  try {
    // Parser le PDF avec pdf2json (pas de worker requis!)
    const buffer = Buffer.from(pdfBuffer);

    const { text, pageCount } = await parsePDF(buffer);

    const textLength = text.length;
    const avgTextPerPage = pageCount > 0 ? textLength / pageCount : 0;

    // Calculer le ratio de texte
    // Un PDF natif typique a 1000-5000 caractères par page
    const textRatio = Math.min(avgTextPerPage / 1000, 1);

    // Déterminer le type
    let type: 'native' | 'scanned' | 'hybrid';
    let recommendation: 'simple-parser' | 'ocr-required';
    let confidence: number;

    if (avgTextPerPage >= THRESHOLDS.MIN_CHARS_PER_PAGE) {
      // Beaucoup de texte → PDF natif
      type = 'native';
      recommendation = 'simple-parser';
      confidence = Math.min(textRatio, 0.95);
    } else if (avgTextPerPage < THRESHOLDS.SCAN_THRESHOLD) {
      // Très peu de texte → PDF scanné
      type = 'scanned';
      recommendation = 'ocr-required';
      confidence = 0.9;
    } else {
      // Entre les deux → Hybride (certaines pages scannées, d'autres natives)
      type = 'hybrid';
      recommendation = 'ocr-required'; // Mieux vaut utiliser OCR pour être sûr
      confidence = 0.7;
    }

    const analysis: PDFAnalysis = {
      type,
      textLength,
      pageCount,
      avgTextPerPage,
      confidence,
      recommendation,
      details: {
        hasText: textLength > 0,
        textRatio,
        likelyScanned: avgTextPerPage < THRESHOLDS.MIN_CHARS_PER_PAGE,
      },
    };

    console.log(`[PDF Detector] Type: ${type}, ${avgTextPerPage.toFixed(0)} chars/page, Recommendation: ${recommendation}`);

    return analysis;

  } catch (error) {
    console.error('[PDF Detector] Error analyzing PDF:', error);

    // En cas d'erreur, considérer comme scanné pour être sûr
    return {
      type: 'scanned',
      textLength: 0,
      pageCount: 0,
      avgTextPerPage: 0,
      confidence: 0.5,
      recommendation: 'ocr-required',
      details: {
        hasText: false,
        textRatio: 0,
        likelyScanned: true,
      },
    };
  }
}

export interface TextPosition {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extrait le texte brut d'un PDF natif
 */
export async function extractPDFText(pdfBuffer: ArrayBuffer): Promise<{
  text: string;
  pages: string[];
  metadata: any;
}> {
  const buffer = Buffer.from(pdfBuffer);

  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);

    pdfParser.on('pdfParser_dataReady', () => {
      try {
        const text = pdfParser.getRawTextContent();
        const pdfData = pdfParser.data;

        // Extract text per page
        const pages: string[] = [];
        if (pdfData?.Pages) {
          for (const page of pdfData.Pages) {
            let pageText = '';
            if (page.Texts) {
              for (const textItem of page.Texts) {
                if (textItem.R) {
                  for (const run of textItem.R) {
                    if (run.T) {
                      pageText += decodeURIComponent(run.T) + ' ';
                    }
                  }
                }
              }
            }
            pages.push(pageText.trim());
          }
        }

        resolve({
          text,
          pages,
          metadata: pdfData?.Meta || {},
        });
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.on('pdfParser_dataError', (error: Error) => {
      reject(error);
    });

    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Extrait le texte avec positions (pour bounding boxes)
 */
export async function extractPDFTextWithPositions(pdfBuffer: ArrayBuffer): Promise<{
  text: string;
  pages: string[];
  positions: TextPosition[];
  metadata: any;
}> {
  const buffer = Buffer.from(pdfBuffer);

  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);

    pdfParser.on('pdfParser_dataReady', () => {
      try {
        const text = pdfParser.getRawTextContent();
        const pdfData = pdfParser.data;

        const pages: string[] = [];
        const positions: TextPosition[] = [];

        if (pdfData?.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            let pageText = '';

            if (page.Texts) {
              page.Texts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((run: any) => {
                    if (run.T) {
                      const decodedText = decodeURIComponent(run.T);
                      pageText += decodedText + ' ';

                      // Capture position (pdf2json uses PDF units, 1 PDF unit ≈ 1/72 inch)
                      positions.push({
                        text: decodedText,
                        page: pageIndex,
                        x: textItem.x || 0,
                        y: textItem.y || 0,
                        width: textItem.w || 0,
                        height: page.Height || 0, // Use page height if item height not available
                      });
                    }
                  });
                }
              });
            }

            pages.push(pageText.trim());
          });
        }

        resolve({
          text,
          pages,
          positions,
          metadata: pdfData?.Meta || {},
        });
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.on('pdfParser_dataError', (error: Error) => {
      reject(error);
    });

    pdfParser.parseBuffer(buffer);
  });
}
