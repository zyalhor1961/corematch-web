/**
 * RAG System - Main Export
 * Retrieval-Augmented Generation for Corematch
 */

// =====================================================
// Types
// =====================================================

export type {
  // Content types
  ContentType,
  SourceTable,
  // Chunking
  ChunkingConfig,
  Chunk,
  ChunkMetadata,
  ChunkingResult,
  // Embeddings
  EmbeddingConfig,
  EmbeddingResult,
  // Storage
  ContentEmbedding,
  StoreEmbeddingsParams,
  // Retrieval
  SearchParams,
  SearchResult,
  RetrievalResult,
  // RAG Pipeline
  RAGConfig,
  RAGContext,
  Citation,
} from './types';

export {
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_EMBEDDING_CONFIG,
  DEFAULT_RAG_CONFIG,
} from './types';

// =====================================================
// Token Counter
// =====================================================

export {
  estimateTokenCount,
  truncateToTokenLimit,
  splitByTokenLimit,
  estimateEmbeddingCost,
  calculateTokenStats,
} from './token-counter';

// =====================================================
// Chunking
// =====================================================

export { DocumentChunker, chunkDocument, chunkDocumentWithPages } from './chunker';

// =====================================================
// Embeddings
// =====================================================

export {
  EmbeddingsGenerator,
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  findMostSimilar,
} from './embeddings';

// =====================================================
// Storage
// =====================================================

export { RAGStorage, createRAGStorage } from './storage';

// =====================================================
// Retrieval
// =====================================================

export { RAGRetrieval, createRAGRetrieval } from './retrieval';

// =====================================================
// Citations
// =====================================================

export {
  CitationGenerator,
  generateCitations,
  buildRAGContext,
  buildPromptContext,
  validateCitations,
} from './citations';

// =====================================================
// Orchestrator (Main API)
// =====================================================

export {
  RAGOrchestrator,
  createRAGOrchestrator,
  ingestDocument,
  queryRAG,
} from './orchestrator';

export type { IngestDocumentParams, IngestResult } from './orchestrator';

// =====================================================
// Quick Start Examples
// =====================================================

/**
 * Example 1: Ingest a DAF document
 *
 * ```typescript
 * import { ingestDocument } from '@/lib/rag';
 *
 * const result = await ingestDocument(pdfText, {
 *   org_id: '123',
 *   source_id: docId,
 *   content_type: 'daf_document',
 *   source_table: 'daf_documents',
 *   source_metadata: {
 *     file_name: 'invoice.pdf',
 *     doc_type: 'facture',
 *     date_document: '2025-01-15',
 *   },
 * });
 * ```
 */

/**
 * Example 2: Query documents with RAG
 *
 * ```typescript
 * import { queryRAG } from '@/lib/rag';
 *
 * const context = await queryRAG(
 *   'Quelles sont les factures de janvier 2025?',
 *   orgId
 * );
 *
 * // Use context in LLM prompt
 * const prompt = `${context.context_text}\n\nQuestion: ${userQuestion}`;
 * ```
 */

/**
 * Example 3: Advanced usage with orchestrator
 *
 * ```typescript
 * import { createRAGOrchestrator } from '@/lib/rag';
 *
 * const rag = createRAGOrchestrator({
 *   chunking: {
 *     strategy: 'hybrid',
 *     max_tokens: 800,
 *   },
 *   embedding: {
 *     model: 'text-embedding-3-small',
 *   },
 * });
 *
 * // Ingest
 * await rag.ingestDocument({...});
 *
 * // Query
 * const context = await rag.query({
 *   query: 'Find invoices',
 *   org_id: orgId,
 *   content_type: 'daf_document',
 *   limit: 5,
 * });
 *
 * // Get stats
 * const stats = await rag.getStats(orgId);
 * ```
 */
