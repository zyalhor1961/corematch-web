/**
 * RAG Retrieval Module
 * Recherche vectorielle, full-text, et hybride
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SearchParams, SearchResult, RetrievalResult } from './types';
import { EmbeddingsGenerator } from './embeddings';

/**
 * Client de retrieval RAG
 */
export class RAGRetrieval {
  private supabase: SupabaseClient;
  private embeddings: EmbeddingsGenerator;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase URL and Service Role Key required');
    }

    this.supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.embeddings = new EmbeddingsGenerator();
  }

  /**
   * Recherche principale - dispatch selon mode
   */
  async search(params: SearchParams): Promise<RetrievalResult> {
    const startTime = Date.now();

    console.log(`[RAG Retrieval] Searching: "${params.query.substring(0, 50)}..."`);
    console.log(`[RAG Retrieval] Mode: ${params.mode || 'hybrid'}, Limit: ${params.limit || 10}`);

    const mode = params.mode || 'hybrid';
    let results: SearchResult[] = [];

    switch (mode) {
      case 'vector':
        results = await this.vectorSearch(params);
        break;
      case 'fts':
        results = await this.fullTextSearch(params);
        break;
      case 'hybrid':
        results = await this.hybridSearch(params);
        break;
      default:
        results = await this.hybridSearch(params);
    }

    const executionTime = Date.now() - startTime;

    console.log(`[RAG Retrieval] ✓ Found ${results.length} results in ${executionTime}ms`);

    return {
      results,
      total: results.length,
      params,
      execution_time_ms: executionTime,
    };
  }

  /**
   * Recherche vectorielle pure (cosine similarity)
   */
  private async vectorSearch(params: SearchParams): Promise<SearchResult[]> {
    // Générer l'embedding de la requête
    const queryEmbedding = await this.embeddings.generateQueryEmbedding(params.query);

    // Appeler la fonction SQL de recherche vectorielle
    const { data, error } = await this.supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      p_org_id: params.org_id,
      p_content_type: params.content_type || null,
      p_limit: params.limit || 10,
      similarity_threshold: params.similarity_threshold || 0.7,
    });

    if (error) {
      console.error('[RAG Retrieval] Vector search error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      source_id: row.source_id,
      source_table: row.source_table,
      content_type: row.content_type,
      chunk_text: row.chunk_text,
      chunk_metadata: row.chunk_metadata,
      source_metadata: row.source_metadata,
      vector_similarity: row.similarity,
    }));
  }

  /**
   * Recherche full-text (PostgreSQL FTS)
   */
  private async fullTextSearch(params: SearchParams): Promise<SearchResult[]> {
    let query = this.supabase
      .from('content_embeddings')
      .select('*')
      .eq('org_id', params.org_id)
      .textSearch('chunk_text', params.query, {
        type: 'websearch',
        config: 'french',
      })
      .limit(params.limit || 10);

    if (params.content_type) {
      query = query.eq('content_type', params.content_type);
    }

    if (params.metadata_filters) {
      query = query.contains('source_metadata', params.metadata_filters);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RAG Retrieval] FTS error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      source_id: row.source_id,
      source_table: row.source_table,
      content_type: row.content_type,
      chunk_text: row.chunk_text,
      chunk_metadata: row.chunk_metadata,
      source_metadata: row.source_metadata,
      fts_rank: 0.8, // Approximation (FTS ne retourne pas le score directement)
    }));
  }

  /**
   * Recherche hybride (vector + FTS)
   * Meilleure précision dans la plupart des cas
   */
  private async hybridSearch(params: SearchParams): Promise<SearchResult[]> {
    // Générer l'embedding de la requête
    const queryEmbedding = await this.embeddings.generateQueryEmbedding(params.query);

    const weights = params.weights || { vector: 0.7, fts: 0.3 };

    // Appeler la fonction SQL de recherche hybride
    const { data, error } = await this.supabase.rpc('hybrid_search', {
      query_embedding: queryEmbedding,
      query_text: params.query,
      p_org_id: params.org_id,
      p_content_type: params.content_type || null,
      p_metadata_filters: params.metadata_filters || null,
      p_limit: params.limit || 10,
      vector_weight: weights.vector,
      fts_weight: weights.fts,
    });

    if (error) {
      console.error('[RAG Retrieval] Hybrid search error:', error);
      // Fallback to vector search
      console.log('[RAG Retrieval] Falling back to vector search...');
      return this.vectorSearch(params);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      source_id: row.source_id,
      source_table: row.source_table,
      content_type: row.content_type,
      chunk_text: row.chunk_text,
      chunk_metadata: row.chunk_metadata,
      source_metadata: row.source_metadata,
      vector_similarity: row.vector_similarity,
      fts_rank: row.fts_rank,
      combined_score: row.combined_score,
    }));
  }

  /**
   * Recherche par similarité à un document existant
   * (find documents similar to this one)
   */
  async findSimilarDocuments(
    sourceId: string,
    orgId: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Récupérer les chunks du document source
    const { data: sourceChunks, error } = await this.supabase
      .from('content_embeddings')
      .select('embedding')
      .eq('source_id', sourceId)
      .eq('org_id', orgId)
      .limit(3); // Prendre les 3 premiers chunks comme représentation

    if (error || !sourceChunks || sourceChunks.length === 0) {
      console.error('[RAG Retrieval] Error fetching source document:', error);
      return [];
    }

    // Calculer l'embedding moyen du document
    const avgEmbedding = this.averageEmbeddings(sourceChunks.map((c: any) => c.embedding));

    // Rechercher les documents similaires
    const { data, error: searchError } = await this.supabase.rpc('search_embeddings', {
      query_embedding: avgEmbedding,
      p_org_id: orgId,
      p_content_type: null,
      p_limit: limit + 1, // +1 car le document source sera dans les résultats
      similarity_threshold: 0.5,
    });

    if (searchError) {
      console.error('[RAG Retrieval] Similar documents search error:', searchError);
      return [];
    }

    // Filtrer le document source et dédupliquer par source_id
    const uniqueDocs = new Map<string, SearchResult>();

    for (const row of data || []) {
      if (row.source_id !== sourceId && !uniqueDocs.has(row.source_id)) {
        uniqueDocs.set(row.source_id, {
          id: row.id,
          source_id: row.source_id,
          source_table: row.source_table,
          content_type: row.content_type,
          chunk_text: row.chunk_text,
          chunk_metadata: row.chunk_metadata,
          source_metadata: row.source_metadata,
          vector_similarity: row.similarity,
        });
      }
    }

    return Array.from(uniqueDocs.values()).slice(0, limit);
  }

  /**
   * Calcule la moyenne de plusieurs embeddings
   */
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot average empty embeddings array');
    }

    const dimensions = embeddings[0].length;
    const avg = new Array(dimensions).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        avg[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      avg[i] /= embeddings.length;
    }

    return avg;
  }

  /**
   * Recherche multi-requêtes (OR)
   * Utile pour "find documents about X OR Y OR Z"
   */
  async searchMultiple(
    queries: string[],
    orgId: string,
    options: Partial<SearchParams> = {}
  ): Promise<RetrievalResult> {
    const allResults: SearchResult[] = [];
    const seenIds = new Set<string>();

    for (const query of queries) {
      const result = await this.search({
        query,
        org_id: orgId,
        ...options,
      });

      // Dédupliquer
      for (const r of result.results) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          allResults.push(r);
        }
      }
    }

    // Trier par score (prendre le meilleur score disponible)
    allResults.sort((a, b) => {
      const scoreA = a.combined_score || a.vector_similarity || a.fts_rank || 0;
      const scoreB = b.combined_score || b.vector_similarity || b.fts_rank || 0;
      return scoreB - scoreA;
    });

    // Limiter les résultats
    const limited = allResults.slice(0, options.limit || 10);

    return {
      results: limited,
      total: limited.length,
      params: {
        query: queries.join(' OR '),
        org_id: orgId,
        ...options,
      },
      execution_time_ms: 0, // TODO: track actual time
    };
  }
}

/**
 * Helper: Créer un client de retrieval avec config par défaut
 */
export function createRAGRetrieval(): RAGRetrieval {
  return new RAGRetrieval();
}
