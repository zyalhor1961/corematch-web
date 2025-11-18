/**
 * Document Chunker
 * Découpe intelligente de documents pour RAG
 */

import type { Chunk, ChunkingConfig, ChunkingResult, ChunkMetadata } from './types';
import { estimateTokenCount, truncateToTokenLimit } from './token-counter';
import { DEFAULT_CHUNKING_CONFIG } from './types';

/**
 * Découpe un document en chunks intelligents
 */
export class DocumentChunker {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      ...DEFAULT_CHUNKING_CONFIG,
      ...config,
    };
  }

  /**
   * Chunker principal - dispatch selon stratégie
   */
  public chunk(text: string, metadata?: Partial<ChunkMetadata>): ChunkingResult {
    const startTime = Date.now();

    let chunks: Chunk[];

    switch (this.config.strategy) {
      case 'fixed':
        chunks = this.chunkFixed(text, metadata);
        break;
      case 'semantic':
        chunks = this.chunkSemantic(text, metadata);
        break;
      case 'hybrid':
        chunks = this.chunkHybrid(text, metadata);
        break;
      default:
        chunks = this.chunkFixed(text, metadata);
    }

    // Filtrer les chunks trop petits
    chunks = chunks.filter((c) => c.token_count >= this.config.min_tokens);

    // Calculer les statistiques
    const tokenCounts = chunks.map((c) => c.token_count);
    const stats = {
      total_chunks: chunks.length,
      total_tokens: tokenCounts.reduce((sum, count) => sum + count, 0),
      avg_tokens_per_chunk: Math.round(
        tokenCounts.reduce((sum, count) => sum + count, 0) / chunks.length
      ),
      min_tokens: Math.min(...tokenCounts),
      max_tokens: Math.max(...tokenCounts),
    };

    console.log(`[Chunker] Created ${chunks.length} chunks in ${Date.now() - startTime}ms`);
    console.log(`[Chunker] Stats: ${stats.avg_tokens_per_chunk} avg tokens, ${stats.total_tokens} total`);

    return {
      chunks,
      stats,
      config: this.config,
    };
  }

  /**
   * Chunking à taille fixe avec overlap
   */
  private chunkFixed(text: string, metadata?: Partial<ChunkMetadata>): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = text.split('\n');
    let currentChunk = '';
    let currentTokens = 0;
    let chunkStartChar = 0;
    let currentChar = 0;

    for (const line of lines) {
      const lineTokens = estimateTokenCount(line);
      const lineWithNewline = line + '\n';

      // Si ajouter cette ligne dépasse la limite
      if (currentTokens + lineTokens > this.config.max_tokens && currentChunk.length > 0) {
        // Sauvegarder le chunk actuel
        chunks.push({
          index: chunks.length,
          text: currentChunk.trim(),
          token_count: currentTokens,
          metadata: {
            ...metadata,
            start_char: chunkStartChar,
            end_char: currentChar,
          },
        });

        // Calculer l'overlap
        const overlapText = this.getOverlapText(currentChunk, this.config.overlap_tokens);
        const overlapTokens = estimateTokenCount(overlapText);

        // Démarrer nouveau chunk avec overlap
        currentChunk = overlapText + lineWithNewline;
        currentTokens = overlapTokens + lineTokens;
        chunkStartChar = currentChar - overlapText.length;
      } else {
        // Ajouter la ligne au chunk actuel
        currentChunk += lineWithNewline;
        currentTokens += lineTokens;
      }

      currentChar += lineWithNewline.length;
    }

    // Ajouter le dernier chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        index: chunks.length,
        text: currentChunk.trim(),
        token_count: currentTokens,
        metadata: {
          ...metadata,
          start_char: chunkStartChar,
          end_char: currentChar,
        },
      });
    }

    return chunks;
  }

  /**
   * Chunking sémantique (par paragraphes/sections)
   */
  private chunkSemantic(text: string, metadata?: Partial<ChunkMetadata>): Chunk[] {
    const chunks: Chunk[] = [];

    // Détecter les sections (markdown headers, ou double newline)
    const sections = this.detectSections(text);

    let currentChunk = '';
    let currentTokens = 0;
    let chunkStartChar = 0;
    let currentChar = 0;

    for (const section of sections) {
      const sectionTokens = estimateTokenCount(section.text);

      // Si la section est trop grande, la découper
      if (sectionTokens > this.config.max_tokens) {
        // Sauvegarder le chunk actuel si non vide
        if (currentChunk.length > 0) {
          chunks.push({
            index: chunks.length,
            text: currentChunk.trim(),
            token_count: currentTokens,
            metadata: {
              ...metadata,
              start_char: chunkStartChar,
              end_char: currentChar,
              section_title: section.title,
            },
          });
          currentChunk = '';
          currentTokens = 0;
          chunkStartChar = currentChar;
        }

        // Découper la section en plus petits morceaux
        const subChunks = this.chunkFixed(section.text, {
          ...metadata,
          section_title: section.title,
        });
        chunks.push(...subChunks);
        currentChar += section.text.length;
      } else if (currentTokens + sectionTokens > this.config.max_tokens) {
        // Sauvegarder le chunk actuel
        if (currentChunk.length > 0) {
          chunks.push({
            index: chunks.length,
            text: currentChunk.trim(),
            token_count: currentTokens,
            metadata: {
              ...metadata,
              start_char: chunkStartChar,
              end_char: currentChar,
            },
          });
        }

        // Démarrer nouveau chunk avec cette section
        currentChunk = section.text;
        currentTokens = sectionTokens;
        chunkStartChar = currentChar;
        currentChar += section.text.length;
      } else {
        // Ajouter à chunk actuel
        currentChunk += '\n\n' + section.text;
        currentTokens += sectionTokens;
        currentChar += section.text.length + 2;
      }
    }

    // Dernier chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        index: chunks.length,
        text: currentChunk.trim(),
        token_count: currentTokens,
        metadata: {
          ...metadata,
          start_char: chunkStartChar,
          end_char: currentChar,
        },
      });
    }

    return chunks;
  }

  /**
   * Chunking hybride (sémantique + fixed)
   * Meilleur compromis pour la plupart des cas
   */
  private chunkHybrid(text: string, metadata?: Partial<ChunkMetadata>): Chunk[] {
    // Essayer d'abord sémantique
    const semanticChunks = this.chunkSemantic(text, metadata);

    // Si les chunks sont trop grands, re-chunker en fixed
    const finalChunks: Chunk[] = [];

    for (const chunk of semanticChunks) {
      if (chunk.token_count > this.config.max_tokens * 1.2) {
        // Re-chunker ce morceau
        const subChunks = this.chunkFixed(chunk.text, chunk.metadata);
        finalChunks.push(...subChunks);
      } else {
        finalChunks.push(chunk);
      }
    }

    // Réindexer
    return finalChunks.map((chunk, index) => ({
      ...chunk,
      index,
    }));
  }

  /**
   * Détecte les sections dans un document
   */
  private detectSections(text: string): Array<{ title?: string; text: string }> {
    const sections: Array<{ title?: string; text: string }> = [];

    // Détecter headers markdown (# Title)
    const markdownSections = text.split(/^(#{1,6}\s+.+)$/gm);

    if (markdownSections.length > 1) {
      // Markdown avec headers
      let currentTitle: string | undefined;

      for (let i = 0; i < markdownSections.length; i++) {
        const part = markdownSections[i].trim();
        if (part.startsWith('#')) {
          currentTitle = part.replace(/^#{1,6}\s+/, '');
        } else if (part.length > 0) {
          sections.push({
            title: currentTitle,
            text: part,
          });
        }
      }
    } else {
      // Pas de markdown, découper par paragraphes (double newline)
      const paragraphs = text.split(/\n\n+/);
      for (const para of paragraphs) {
        if (para.trim().length > 0) {
          sections.push({ text: para.trim() });
        }
      }
    }

    return sections.length > 0 ? sections : [{ text }];
  }

  /**
   * Récupère le texte d'overlap à partir de la fin d'un chunk
   */
  private getOverlapText(text: string, overlapTokens: number): string {
    if (overlapTokens === 0) {
      return '';
    }

    const totalTokens = estimateTokenCount(text);
    if (totalTokens <= overlapTokens) {
      return text;
    }

    // Approximation: prendre les derniers N caractères
    const charPerToken = 3;
    const overlapChars = overlapTokens * charPerToken;

    let overlapText = text.substring(text.length - overlapChars);

    // Trouver le premier espace pour ne pas couper un mot
    const firstSpace = overlapText.indexOf(' ');
    if (firstSpace !== -1) {
      overlapText = overlapText.substring(firstSpace + 1);
    }

    return overlapText;
  }
}

/**
 * Helper: Chunker un document rapidement avec config par défaut
 */
export function chunkDocument(
  text: string,
  config?: Partial<ChunkingConfig>
): ChunkingResult {
  const chunker = new DocumentChunker(config);
  return chunker.chunk(text);
}

/**
 * Helper: Chunker avec métadonnées de page (pour PDFs)
 */
export function chunkDocumentWithPages(
  pages: Array<{ page_number: number; text: string }>,
  config?: Partial<ChunkingConfig>
): ChunkingResult {
  const chunker = new DocumentChunker(config);
  const allChunks: Chunk[] = [];

  for (const page of pages) {
    const pageResult = chunker.chunk(page.text, {
      page_number: page.page_number,
    });

    // Réindexer les chunks avec offset
    const reindexedChunks = pageResult.chunks.map((chunk) => ({
      ...chunk,
      index: allChunks.length + chunk.index,
    }));

    allChunks.push(...reindexedChunks);
  }

  // Calculer stats globales
  const tokenCounts = allChunks.map((c) => c.token_count);
  const stats = {
    total_chunks: allChunks.length,
    total_tokens: tokenCounts.reduce((sum, count) => sum + count, 0),
    avg_tokens_per_chunk: Math.round(
      tokenCounts.reduce((sum, count) => sum + count, 0) / allChunks.length
    ),
    min_tokens: Math.min(...tokenCounts),
    max_tokens: Math.max(...tokenCounts),
  };

  return {
    chunks: allChunks,
    stats,
    config: chunker['config'],
  };
}
