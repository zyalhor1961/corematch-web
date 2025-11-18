/**
 * RAG Storage Module
 * Stockage des embeddings dans Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  ContentEmbedding,
  StoreEmbeddingsParams,
  Chunk,
  EmbeddingResult,
  ContentType,
  SourceTable,
} from './types';

/**
 * Client de stockage RAG
 */
export class RAGStorage {
  private supabase: SupabaseClient;

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
  }

  /**
   * Stocke des chunks avec leurs embeddings
   */
  async storeEmbeddings(params: StoreEmbeddingsParams): Promise<{
    success: boolean;
    stored_count: number;
    errors: string[];
  }> {
    const { org_id, content_type, source_id, source_table, source_metadata, chunks, embeddings } = params;

    console.log(`[RAG Storage] Storing ${chunks.length} chunks for ${source_id}...`);

    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings arrays must have same length');
    }

    const errors: string[] = [];
    let storedCount = 0;

    // Préparer les données pour insertion
    const rows = chunks.map((chunk, index) => ({
      org_id,
      content_type,
      source_id,
      source_table,
      source_metadata,
      chunk_index: chunk.index,
      chunk_text: chunk.text,
      chunk_metadata: chunk.metadata,
      embedding: embeddings[index].embedding,
      token_count: chunk.token_count,
    }));

    // Insérer par batch de 100 (limite Supabase)
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const { error } = await this.supabase.from('content_embeddings').insert(batch);

      if (error) {
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        console.error(`[RAG Storage] Error inserting batch:`, error);
      } else {
        storedCount += batch.length;
      }
    }

    console.log(`[RAG Storage] ✓ Stored ${storedCount}/${chunks.length} chunks`);

    return {
      success: errors.length === 0,
      stored_count: storedCount,
      errors,
    };
  }

  /**
   * Supprime tous les embeddings d'un document
   */
  async deleteDocumentEmbeddings(sourceId: string, orgId: string): Promise<{
    success: boolean;
    deleted_count: number;
  }> {
    console.log(`[RAG Storage] Deleting embeddings for document ${sourceId}...`);

    const { data, error } = await this.supabase
      .from('content_embeddings')
      .delete()
      .eq('source_id', sourceId)
      .eq('org_id', orgId)
      .select('id');

    if (error) {
      console.error('[RAG Storage] Error deleting embeddings:', error);
      return { success: false, deleted_count: 0 };
    }

    console.log(`[RAG Storage] ✓ Deleted ${data?.length || 0} embeddings`);

    return {
      success: true,
      deleted_count: data?.length || 0,
    };
  }

  /**
   * Récupère tous les chunks d'un document
   */
  async getDocumentChunks(
    sourceId: string,
    orgId: string
  ): Promise<ContentEmbedding[]> {
    const { data, error } = await this.supabase
      .from('content_embeddings')
      .select('*')
      .eq('source_id', sourceId)
      .eq('org_id', orgId)
      .order('chunk_index', { ascending: true });

    if (error) {
      console.error('[RAG Storage] Error fetching chunks:', error);
      return [];
    }

    return (data || []) as ContentEmbedding[];
  }

  /**
   * Vérifie si un document a déjà des embeddings
   */
  async hasEmbeddings(sourceId: string, orgId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('content_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('org_id', orgId);

    if (error) {
      console.error('[RAG Storage] Error checking embeddings:', error);
      return false;
    }

    return (count || 0) > 0;
  }

  /**
   * Obtient les statistiques d'embeddings pour une organisation
   */
  async getStats(orgId: string): Promise<{
    total_chunks: number;
    total_documents: number;
    by_content_type: Record<string, number>;
    total_tokens: number;
  }> {
    const { data, error } = await this.supabase.rpc('get_embeddings_stats', {
      p_org_id: orgId,
    });

    if (error) {
      console.error('[RAG Storage] Error fetching stats:', error);
      return {
        total_chunks: 0,
        total_documents: 0,
        by_content_type: {},
        total_tokens: 0,
      };
    }

    return data[0] || {
      total_chunks: 0,
      total_documents: 0,
      by_content_type: {},
      total_tokens: 0,
    };
  }

  /**
   * Met à jour les embeddings d'un document
   * (supprime les anciens et insère les nouveaux)
   */
  async updateEmbeddings(params: StoreEmbeddingsParams): Promise<{
    success: boolean;
    stored_count: number;
    errors: string[];
  }> {
    // Supprimer les anciens
    await this.deleteDocumentEmbeddings(params.source_id, params.org_id);

    // Insérer les nouveaux
    return this.storeEmbeddings(params);
  }

  /**
   * Recherche par métadonnées
   */
  async searchByMetadata(
    orgId: string,
    metadataFilters: Record<string, any>,
    contentType?: ContentType
  ): Promise<ContentEmbedding[]> {
    let query = this.supabase
      .from('content_embeddings')
      .select('*')
      .eq('org_id', orgId);

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    // Filtrer par métadonnées (JSON)
    query = query.contains('source_metadata', metadataFilters);

    const { data, error } = await query;

    if (error) {
      console.error('[RAG Storage] Error searching by metadata:', error);
      return [];
    }

    return (data || []) as ContentEmbedding[];
  }
}

/**
 * Helper: Créer un client de stockage avec config par défaut
 */
export function createRAGStorage(): RAGStorage {
  return new RAGStorage();
}
