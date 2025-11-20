/**
 * Common Extraction Nodes
 * Reusable nodes for document extraction
 */

import type { NodeFunction, NodeResult } from '../../core/types';
import { AzureDIExtractor } from '@/lib/daf-docs/extraction';
import type { DAFExtractionResult } from '@/lib/daf-docs/extraction/types';

/**
 * Extract document using Azure DI
 */
export const extractWithAzureDI: NodeFunction<
  { fileBuffer: ArrayBuffer; fileName: string },
  DAFExtractionResult
> = async (state, input) => {
  const startTime = Date.now();

  try {
    const extractor = new AzureDIExtractor();
    const result = await extractor.extractDocument(input.fileBuffer, input.fileName);

    return {
      success: result.success,
      data: result,
      stateUpdates: {
        extractionResult: result,
        pdfText: result.raw_response?.content,
      },
      metadataUpdates: {
        extractionDuration: Date.now() - startTime,
        extractionProvider: 'azure-di',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    };
  }
};

/**
 * Extract text from PDF (generic)
 */
export const extractPDFText: NodeFunction<
  { fileBuffer: ArrayBuffer },
  string
> = async (state, input) => {
  try {
    // Use simple text extraction if Azure DI not needed
    // TODO: Implement pdf-parse or pdf2json extraction
    return {
      success: true,
      data: '',
      stateUpdates: {
        pdfText: '',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF text extraction failed',
    };
  }
};
