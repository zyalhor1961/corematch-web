/**
 * RAG Orchestrator
 * Pipeline complet d'ingestion et de retrieval
 */

import type {
  RAGConfig,
  ContentType,
  SourceTable,
  RAGContext,
  SearchParams,
  RetrievalResult,
  Chunk,
  ChunkingResult,
} from './types';
import { DEFAULT_RAG_CONFIG } from './types';
import { DocumentChunker } from './chunker';
import { EmbeddingsGenerator } from './embeddings';
import { RAGStorage } from './storage';
import { RAGRetrieval } from './retrieval';
import { CitationGenerator } from './citations';

/**
 * Paramètres d'ingestion de document
 */
export interface IngestDocumentParams {
  org_id: string;
  content_type: ContentType;
  source_id: string;
  source_table: SourceTable;
  source_metadata: Record<string, any>;
  text: string;
  pages?: Array<{ page_number: number; text: string }>;
  force_regenerate?: boolean; // Re-générer même si embeddings existent
}

/**
 * Résultat d'ingestion
 */
export interface IngestResult {
  success: boolean;
  source_id: string;
  chunks_created: number;
  embeddings_generated: number;
  total_tokens: number;
  estimated_cost_usd: number;
  duration_ms: number;
  errors: string[];
}

/**
 * Orchestrateur RAG principal
 */
export class RAGOrchestrator {
  private config: RAGConfig;
  private chunker: DocumentChunker;
  private embeddings: EmbeddingsGenerator;
  private storage: RAGStorage;
  private retrieval: RAGRetrieval;
  private citations: CitationGenerator;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = {
      ...DEFAULT_RAG_CONFIG,
      ...config,
      chunking: {
        ...DEFAULT_RAG_CONFIG.chunking,
        ...config.chunking,
      },
      embedding: {
        ...DEFAULT_RAG_CONFIG.embedding,
        ...config.embedding,
      },
      retrieval: {
        ...DEFAULT_RAG_CONFIG.retrieval,
        ...config.retrieval,
      },
    };

    this.chunker = new DocumentChunker(this.config.chunking);
    this.embeddings = new EmbeddingsGenerator(this.config.embedding);
    this.storage = new RAGStorage();
    this.retrieval = new RAGRetrieval();
    this.citations = new CitationGenerator();
  }

  /**
   * Pipeline complet d'ingestion d'un document
   *
   * Étapes:
   * 1. Chunking du document
   * 2. Génération des embeddings
   * 3. Stockage dans Supabase
   *
   * @param params - Paramètres d'ingestion
   * @returns Résultat de l'ingestion
   */
  async ingestDocument(params: IngestDocumentParams): Promise<IngestResult> {
    const startTime = Date.now();

    try {
      // Check if embeddings already exist
      if (!params.force_regenerate) {
        const hasExisting = await this.storage.hasEmbeddings(params.source_id, params.org_id);
        if (hasExisting) {
          return {
            success: true,
            source_id: params.source_id,
            chunks_created: 0,
            embeddings_generated: 0,
            total_tokens: 0,
            estimated_cost_usd: 0,
            duration_ms: Date.now() - startTime,
            errors: [],
          };
        }
      } else {
        // Delete existing embeddings
        await this.storage.deleteDocumentEmbeddings(params.source_id, params.org_id);
      }

      // Chunking
      let chunkingResult: ChunkingResult;

      if (params.pages && params.pages.length > 0) {
        // Document with pages (PDF)
        const { chunkDocumentWithPages } = await import('./chunker');
        chunkingResult = chunkDocumentWithPages(params.pages, this.config.chunking);
      } else {
        // Simple text document
        chunkingResult = this.chunker.chunk(params.text);
      }

      // Generate embeddings
      const chunkTexts = chunkingResult.chunks.map((c) => c.text);
      const embeddingResults = await this.embeddings.generateEmbeddings(chunkTexts);

      // Store in database
      const storageResult = await this.storage.storeEmbeddings({
        org_id: params.org_id,
        content_type: params.content_type,
        source_id: params.source_id,
        source_table: params.source_table,
        source_metadata: params.source_metadata,
        chunks: chunkingResult.chunks,
        embeddings: embeddingResults,
      });

      // Calculate final results
      const totalTime = Date.now() - startTime;
      const totalTokens = embeddingResults.reduce((sum, r) => sum + r.tokens_used, 0);
      const estimatedCost = (totalTokens / 1_000_000) * 0.02; // text-embedding-3-small

      return {
        success: storageResult.success,
        source_id: params.source_id,
        chunks_created: chunkingResult.chunks.length,
        embeddings_generated: embeddingResults.length,
        total_tokens: totalTokens,
        estimated_cost_usd: estimatedCost,
        duration_ms: totalTime,
        errors: storageResult.errors,
      };
    } catch (error) {
      console.error('[RAG Orchestrator] Error during ingestion:', error);

      return {
        success: false,
        source_id: params.source_id,
        chunks_created: 0,
        embeddings_generated: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
        duration_ms: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Recherche avec génération automatique de contexte RAG
   *
   * @param params - Paramètres de recherche
   * @returns Contexte RAG prêt pour LLM
   */
  async query(params: SearchParams): Promise<RAGContext> {
    // Search
    const retrievalResult = await this.retrieval.search(params);

    // Generate context with citations
    const context = this.citations.buildRAGContext(retrievalResult.results);

    return context;
  }

  /**
   * Recherche simple sans contexte (juste les résultats)
   */
  async search(params: SearchParams): Promise<RetrievalResult> {
    return this.retrieval.search(params);
  }

  /**
   * Trouve des documents similaires à un document existant
   */
  async findSimilarDocuments(
    sourceId: string,
    orgId: string,
    limit: number = 10
  ): Promise<RetrievalResult> {
    const results = await this.retrieval.findSimilarDocuments(sourceId, orgId, limit);

    return {
      results,
      total: results.length,
      params: {
        query: `Similar to ${sourceId}`,
        org_id: orgId,
        limit,
      },
      execution_time_ms: 0,
    };
  }

  /**
   * Supprime un document du système RAG
   */
  async deleteDocument(sourceId: string, orgId: string): Promise<boolean> {
    const result = await this.storage.deleteDocumentEmbeddings(sourceId, orgId);
    return result.success;
  }

  /**
   * Obtient les statistiques RAG pour une organisation
   */
  async getStats(orgId: string) {
    return this.storage.getStats(orgId);
  }

  /**
   * Build prompt context directement (helper pour LLM calls)
   */
  async buildPromptContext(
    query: string,
    orgId: string,
    options: {
      content_type?: ContentType;
      limit?: number;
      max_tokens?: number;
    } = {}
  ): Promise<string> {
    const searchResult = await this.query({
      query,
      org_id: orgId,
      content_type: options.content_type,
      limit: options.limit || 10,
    });

    return this.citations.buildPromptContext(
      searchResult.chunks,
      options.max_tokens || 4000
    );
  }
}

/**
 * Helper: Créer un orchestrateur avec config par défaut
 */
export function createRAGOrchestrator(config?: Partial<RAGConfig>): RAGOrchestrator {
  return new RAGOrchestrator(config);
}

/**
 * Helper: Ingérer un document rapidement
 */
export async function ingestDocument(
  text: string,
  metadata: {
    org_id: string;
    source_id: string;
    content_type: ContentType;
    source_table: SourceTable;
    source_metadata: Record<string, any>;
  }
): Promise<IngestResult> {
  const orchestrator = createRAGOrchestrator();
  return orchestrator.ingestDocument({
    ...metadata,
    text,
  });
}

/**
 * Helper: Query avec contexte RAG
 */
export async function queryRAG(query: string, orgId: string): Promise<RAGContext> {
  const orchestrator = createRAGOrchestrator();
  return orchestrator.query({
    query,
    org_id: orgId,
  });
}
