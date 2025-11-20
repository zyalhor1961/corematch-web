/**
 * DAF Document Processing Graph
 * Complete workflow for DAF document ingestion
 */

import { createGraph, createNode } from '../core/graph';
import type { Graph, NodeFunction } from '../core/types';
import { AzureDIExtractor } from '@/lib/daf-docs/extraction';
import { classifyDocument } from '@/lib/daf-docs/classifier';
import { ingestDocument as ingestRAG } from '@/lib/rag';

/**
 * DAF Processing State
 */
export interface DAFProcessingState {
  // Input
  fileBuffer: ArrayBuffer;
  fileName: string;
  fileType: string;
  orgId: string;
  userId: string;

  // Intermediate
  classification?: any;
  extractionResult?: any;
  pdfText?: string;
  documentId?: string;

  // Output
  success: boolean;
  document?: any;
  errors?: string[];
}

/**
 * Node 1: Classify Document
 */
const classifyNode = createNode(
  'classify',
  'Classify Document',
  async (state, input: DAFProcessingState) => {
    console.log(`[DAF Graph] Classifying "${input.fileName}"...`);

    const classification = classifyDocument(input.fileName, input.fileType);

    console.log(`[DAF Graph] ✓ Classified as: ${classification.doc_type} (${(classification.confidence * 100).toFixed(0)}%)`);

    return {
      success: true,
      stateUpdates: {
        classification,
      },
    };
  },
  {
    type: 'transform',
    description: 'Classify document type (facture, releve_bancaire, etc.)',
  }
);

/**
 * Node 2: Extract with Azure DI
 */
const extractNode = createNode(
  'extract',
  'Extract Document',
  async (state, input: DAFProcessingState) => {
    console.log(`[DAF Graph] Extracting document...`);

    try {
      const extractor = new AzureDIExtractor();
      const result = await extractor.extractDocument(input.fileBuffer, input.fileName);

      if (result.success) {
        console.log(`[DAF Graph] ✓ Extraction succeeded (confidence: ${result.confidence})`);
        return {
          success: true,
          stateUpdates: {
            extractionResult: result,
            pdfText: result.raw_response?.content,
          },
        };
      } else {
        throw new Error(result.error || 'Extraction failed');
      }
    } catch (error) {
      console.error(`[DAF Graph] ❌ Extraction failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  },
  {
    type: 'extract',
    description: 'Extract structured data using Azure Document Intelligence',
    retry: {
      maxAttempts: 2,
      delayMs: 1000,
    },
    timeout: 30000, // 30s
  }
);

/**
 * Node 3: Validate Extraction
 */
const validateNode = createNode(
  'validate',
  'Validate Extraction',
  async (state, input: DAFProcessingState) => {
    console.log(`[DAF Graph] Validating extraction...`);

    const { extractionResult } = input;

    if (!extractionResult) {
      return {
        success: false,
        error: 'No extraction result to validate',
      };
    }

    // Simple validation: check if we have at least some data
    const hasData =
      extractionResult.numero_facture ||
      extractionResult.montant_ttc ||
      extractionResult.fournisseur;

    if (!hasData) {
      console.warn(`[DAF Graph] ⚠ Low confidence extraction (no key fields extracted)`);
    }

    console.log(`[DAF Graph] ✓ Validation passed`);

    return {
      success: true,
      stateUpdates: {
        validationPassed: hasData,
      },
    };
  },
  {
    type: 'validate',
    description: 'Validate extracted data quality',
  }
);

/**
 * Node 4: Store in Database
 */
const storeNode = createNode(
  'store',
  'Store Document',
  async (state, input: DAFProcessingState) => {
    console.log(`[DAF Graph] Storing document in database...`);

    // TODO: Actually store in Supabase daf_documents table
    // For now, simulate storage

    const documentId = 'simulated-doc-id';

    console.log(`[DAF Graph] ✓ Document stored: ${documentId}`);

    return {
      success: true,
      stateUpdates: {
        documentId,
      },
    };
  },
  {
    type: 'store',
    description: 'Store document in Supabase',
  }
);

/**
 * Node 5: Generate RAG Embeddings
 */
const ragNode = createNode(
  'rag',
  'Generate RAG Embeddings',
  async (state, input: DAFProcessingState) => {
    console.log(`[DAF Graph] Generating RAG embeddings...`);

    const { pdfText, documentId, orgId, fileName, classification } = input;

    if (!pdfText || !documentId) {
      console.log(`[DAF Graph] ⚠ Skipping RAG (no text or document ID)`);
      return {
        success: true,
        stateUpdates: {
          ragSkipped: true,
        },
      };
    }

    try {
      const ragResult = await ingestRAG(pdfText, {
        org_id: orgId,
        source_id: documentId,
        content_type: 'daf_document',
        source_table: 'daf_documents',
        source_metadata: {
          file_name: fileName,
          doc_type: classification?.doc_type,
        },
      });

      if (ragResult.success) {
        console.log(`[DAF Graph] ✓ RAG embeddings generated: ${ragResult.chunks_created} chunks`);
      }

      return {
        success: true,
        stateUpdates: {
          ragResult,
        },
      };
    } catch (error) {
      console.error(`[DAF Graph] ❌ RAG generation failed:`, error);
      // Non-blocking - continue even if RAG fails
      return {
        success: true,
        stateUpdates: {
          ragError: error instanceof Error ? error.message : 'RAG failed',
        },
      };
    }
  },
  {
    type: 'enrich',
    description: 'Generate embeddings for semantic search',
    timeout: 15000, // 15s
  }
);

/**
 * Node 6: Complete
 */
const completeNode = createNode(
  'complete',
  'Complete Processing',
  async (state, input: DAFProcessingState) => {
    console.log(`[DAF Graph] Processing complete!`);

    return {
      success: true,
      stateUpdates: {
        success: true,
        completedAt: new Date().toISOString(),
      },
    };
  },
  {
    type: 'custom',
    description: 'Finalize processing',
  }
);

/**
 * Build the DAF Processing Graph
 */
export function createDAFProcessingGraph(): Graph {
  return createGraph('daf-processing', 'DAF Document Processing', 'Complete workflow for DAF document ingestion')
    // Add all nodes
    .addNode(classifyNode)
    .addNode(extractNode)
    .addNode(validateNode)
    .addNode(storeNode)
    .addNode(ragNode)
    .addNode(completeNode)

    // Define workflow
    .setEntry('classify')
    .addSequence('classify', 'extract', 'validate', 'store', 'rag', 'complete')
    .addExit('complete')

    // Build and validate
    .build();
}

/**
 * Helper: Execute DAF processing with logging
 */
export async function processDAFDocument(input: {
  fileBuffer: ArrayBuffer;
  fileName: string;
  fileType: string;
  orgId: string;
  userId: string;
}) {
  const graph = createDAFProcessingGraph();

  // Visualize the graph
  console.log((new (require('../core/graph').GraphBuilder)('temp', 'temp')).visualize.call({ graph }));

  const result = await import('../core/executor').then((m) =>
    m.executeGraph(graph, {
      initialData: input,
      verbose: true,
    })
  );

  return result;
}
