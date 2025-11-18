/**
 * RAG System Types
 * Types for chunking, embeddings, and retrieval
 */

// =====================================================
// Content Types
// =====================================================

export type ContentType = 'daf_document' | 'cv' | 'job_spec' | 'autre';

export type SourceTable = 'daf_documents' | 'candidates' | 'projects' | 'autre';

// =====================================================
// Chunking
// =====================================================

export interface ChunkingConfig {
  /**
   * Stratégie de chunking
   * - fixed: Taille fixe (caractères ou tokens)
   * - semantic: Découpage par sections/paragraphes
   * - hybrid: Combinaison des deux
   */
  strategy: 'fixed' | 'semantic' | 'hybrid';

  /**
   * Taille max du chunk en tokens
   * Recommandé: 500-1000 tokens pour OpenAI embeddings
   */
  max_tokens: number;

  /**
   * Overlap entre chunks (en tokens)
   * Recommandé: 50-100 tokens pour contexte
   */
  overlap_tokens: number;

  /**
   * Taille min du chunk (rejeter chunks trop petits)
   */
  min_tokens: number;

  /**
   * Respecter les limites de paragraphes/sections
   */
  respect_boundaries: boolean;
}

export interface Chunk {
  /**
   * Index du chunk dans le document (0-based)
   */
  index: number;

  /**
   * Texte du chunk
   */
  text: string;

  /**
   * Nombre de tokens (approximatif)
   */
  token_count: number;

  /**
   * Métadonnées du chunk
   */
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  /**
   * Numéro de page (pour PDFs)
   */
  page_number?: number;

  /**
   * Titre de la section
   */
  section_title?: string;

  /**
   * Position de début dans le texte original (caractères)
   */
  start_char: number;

  /**
   * Position de fin dans le texte original (caractères)
   */
  end_char: number;

  /**
   * Bounding box (pour documents avec layout)
   */
  bounding_box?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /**
   * Heading hierarchy (pour markdown/HTML)
   */
  heading_hierarchy?: string[];
}

export interface ChunkingResult {
  /**
   * Liste des chunks
   */
  chunks: Chunk[];

  /**
   * Statistiques
   */
  stats: {
    total_chunks: number;
    total_tokens: number;
    avg_tokens_per_chunk: number;
    min_tokens: number;
    max_tokens: number;
  };

  /**
   * Configuration utilisée
   */
  config: ChunkingConfig;
}

// =====================================================
// Embeddings
// =====================================================

export interface EmbeddingConfig {
  /**
   * Provider d'embeddings
   */
  provider: 'openai' | 'voyage' | 'cohere';

  /**
   * Modèle d'embedding
   * OpenAI: text-embedding-3-small (1536 dims, $0.02/1M tokens)
   * OpenAI: text-embedding-3-large (3072 dims, $0.13/1M tokens)
   * Voyage: voyage-2 (1024 dims, $0.12/1M tokens)
   */
  model: string;

  /**
   * Dimensions du vecteur
   */
  dimensions: number;

  /**
   * Batch size pour génération d'embeddings
   */
  batch_size: number;
}

export interface EmbeddingResult {
  /**
   * Vecteur d'embedding
   */
  embedding: number[];

  /**
   * Texte source
   */
  text: string;

  /**
   * Nombre de tokens utilisés
   */
  tokens_used: number;

  /**
   * Provider utilisé
   */
  provider: string;

  /**
   * Modèle utilisé
   */
  model: string;
}

// =====================================================
// Storage
// =====================================================

export interface ContentEmbedding {
  id: string;
  org_id: string;
  content_type: ContentType;
  source_id: string;
  source_table: SourceTable;
  source_metadata: Record<string, any>;
  chunk_index: number;
  chunk_text: string;
  chunk_metadata: ChunkMetadata;
  embedding: number[];
  token_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoreEmbeddingsParams {
  org_id: string;
  content_type: ContentType;
  source_id: string;
  source_table: SourceTable;
  source_metadata: Record<string, any>;
  chunks: Chunk[];
  embeddings: EmbeddingResult[];
}

// =====================================================
// Retrieval
// =====================================================

export interface SearchParams {
  /**
   * Texte de la requête
   */
  query: string;

  /**
   * Organisation
   */
  org_id: string;

  /**
   * Type de contenu (optionnel)
   */
  content_type?: ContentType;

  /**
   * Filtres sur métadonnées (optionnel)
   */
  metadata_filters?: Record<string, any>;

  /**
   * Nombre de résultats
   */
  limit?: number;

  /**
   * Seuil de similarité (0-1)
   */
  similarity_threshold?: number;

  /**
   * Mode de recherche
   */
  mode?: 'vector' | 'hybrid' | 'fts';

  /**
   * Poids pour recherche hybride
   */
  weights?: {
    vector: number;
    fts: number;
  };
}

export interface SearchResult {
  /**
   * ID de l'embedding
   */
  id: string;

  /**
   * ID du document source
   */
  source_id: string;

  /**
   * Table source
   */
  source_table: SourceTable;

  /**
   * Type de contenu
   */
  content_type: ContentType;

  /**
   * Texte du chunk
   */
  chunk_text: string;

  /**
   * Métadonnées du chunk
   */
  chunk_metadata: ChunkMetadata;

  /**
   * Métadonnées du document source
   */
  source_metadata: Record<string, any>;

  /**
   * Score de similarité vectorielle (0-1)
   */
  vector_similarity?: number;

  /**
   * Score full-text search
   */
  fts_rank?: number;

  /**
   * Score combiné (pour hybrid search)
   */
  combined_score?: number;
}

export interface RetrievalResult {
  /**
   * Résultats de la recherche
   */
  results: SearchResult[];

  /**
   * Nombre total de résultats
   */
  total: number;

  /**
   * Paramètres de recherche utilisés
   */
  params: SearchParams;

  /**
   * Temps d'exécution (ms)
   */
  execution_time_ms: number;
}

// =====================================================
// RAG Pipeline
// =====================================================

export interface RAGConfig {
  chunking: ChunkingConfig;
  embedding: EmbeddingConfig;
  retrieval: {
    default_limit: number;
    default_threshold: number;
    default_mode: 'vector' | 'hybrid' | 'fts';
  };
}

export interface RAGContext {
  /**
   * Chunks récupérés
   */
  chunks: SearchResult[];

  /**
   * Texte complet pour injection dans prompt
   */
  context_text: string;

  /**
   * Citations (pour traçabilité)
   */
  citations: Citation[];

  /**
   * Nombre total de tokens
   */
  total_tokens: number;
}

export interface Citation {
  /**
   * Numéro de citation (1-based)
   */
  number: number;

  /**
   * ID du document source
   */
  source_id: string;

  /**
   * Nom du fichier source
   */
  source_name: string;

  /**
   * Numéro de page (optionnel)
   */
  page_number?: number;

  /**
   * Section (optionnelle)
   */
  section_title?: string;

  /**
   * Texte exact cité
   */
  quoted_text: string;

  /**
   * Score de pertinence
   */
  relevance_score: number;
}

// =====================================================
// Default Configurations
// =====================================================

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  strategy: 'hybrid',
  max_tokens: 800,
  overlap_tokens: 100,
  min_tokens: 50,
  respect_boundaries: true,
};

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batch_size: 100,
};

export const DEFAULT_RAG_CONFIG: RAGConfig = {
  chunking: DEFAULT_CHUNKING_CONFIG,
  embedding: DEFAULT_EMBEDDING_CONFIG,
  retrieval: {
    default_limit: 10,
    default_threshold: 0.7,
    default_mode: 'hybrid',
  },
};
