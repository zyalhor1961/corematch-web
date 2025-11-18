/**
 * Embeddings Generator
 * Génération d'embeddings vectoriels via OpenAI
 */

import OpenAI from 'openai';
import type { EmbeddingConfig, EmbeddingResult } from './types';
import { DEFAULT_EMBEDDING_CONFIG } from './types';
import { estimateTokenCount, estimateEmbeddingCost } from './token-counter';

/**
 * Générateur d'embeddings avec support multi-provider
 */
export class EmbeddingsGenerator {
  private config: EmbeddingConfig;
  private openai: OpenAI | null = null;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = {
      ...DEFAULT_EMBEDDING_CONFIG,
      ...config,
    };

    // Initialiser OpenAI si provider OpenAI
    if (this.config.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found in environment');
      }
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Génère un embedding pour un texte unique
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (this.config.provider === 'openai') {
      return this.generateOpenAIEmbedding(text);
    }

    throw new Error(`Provider ${this.config.provider} not implemented yet`);
  }

  /**
   * Génère des embeddings en batch (optimisé pour coût/vitesse)
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    console.log(`[Embeddings] Generating embeddings for ${texts.length} texts...`);
    const startTime = Date.now();

    const results: EmbeddingResult[] = [];

    // Traiter par batch pour respecter les limites de l'API
    const batchSize = this.config.batch_size;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`[Embeddings] Processing batch ${i / batchSize + 1}/${Math.ceil(texts.length / batchSize)}`);

      if (this.config.provider === 'openai') {
        const batchResults = await this.generateOpenAIEmbeddingsBatch(batch);
        results.push(...batchResults);
      } else {
        throw new Error(`Provider ${this.config.provider} not implemented yet`);
      }
    }

    const duration = Date.now() - startTime;
    const totalTokens = results.reduce((sum, r) => sum + r.tokens_used, 0);
    const estimatedCost = estimateEmbeddingCost(totalTokens, this.config.model as any);

    console.log(`[Embeddings] ✓ Generated ${results.length} embeddings in ${duration}ms`);
    console.log(`[Embeddings] Total tokens: ${totalTokens}, Est. cost: $${estimatedCost.toFixed(4)}`);

    return results;
  }

  /**
   * Génère un embedding OpenAI pour un texte unique
   */
  private async generateOpenAIEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: text,
      dimensions: this.config.dimensions,
    });

    const embedding = response.data[0].embedding;
    const tokensUsed = response.usage.total_tokens;

    return {
      embedding,
      text,
      tokens_used: tokensUsed,
      provider: 'openai',
      model: this.config.model,
    };
  }

  /**
   * Génère des embeddings OpenAI en batch
   */
  private async generateOpenAIEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: texts,
        dimensions: this.config.dimensions,
      });

      const totalTokensUsed = response.usage.total_tokens;
      const tokensPerText = Math.round(totalTokensUsed / texts.length);

      return response.data.map((item, index) => ({
        embedding: item.embedding,
        text: texts[index],
        tokens_used: tokensPerText,
        provider: 'openai',
        model: this.config.model,
      }));
    } catch (error) {
      console.error('[Embeddings] Error generating batch:', error);
      throw error;
    }
  }

  /**
   * Génère un embedding pour une requête (query)
   * Identique à generateEmbedding mais sémantiquement différent
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    const result = await this.generateEmbedding(query);
    return result.embedding;
  }
}

/**
 * Helper: Générer un embedding rapidement avec config par défaut
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const generator = new EmbeddingsGenerator();
  const result = await generator.generateEmbedding(text);
  return result.embedding;
}

/**
 * Helper: Générer des embeddings en batch avec config par défaut
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const generator = new EmbeddingsGenerator();
  return generator.generateEmbeddings(texts);
}

/**
 * Calcule la similarité cosine entre deux vecteurs
 *
 * @param a - Premier vecteur
 * @param b - Second vecteur
 * @returns Similarité (0-1, plus proche de 1 = plus similaire)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Trouve les N embeddings les plus similaires à une requête
 *
 * @param queryEmbedding - Embedding de la requête
 * @param candidateEmbeddings - Liste des embeddings candidats
 * @param topK - Nombre de résultats à retourner
 * @returns Indices triés par similarité décroissante
 */
export function findMostSimilar(
  queryEmbedding: number[],
  candidateEmbeddings: number[][],
  topK: number = 10
): Array<{ index: number; similarity: number }> {
  const similarities = candidateEmbeddings.map((embedding, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, embedding),
  }));

  // Trier par similarité décroissante
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Retourner top K
  return similarities.slice(0, topK);
}
