/**
 * Citation System
 * Génération de citations traçables pour RAG
 */

import type { SearchResult, Citation, RAGContext } from './types';

/**
 * Générateur de citations
 */
export class CitationGenerator {
  /**
   * Génère des citations à partir de résultats de recherche
   */
  generateCitations(results: SearchResult[]): Citation[] {
    const citations: Citation[] = [];
    const seenSources = new Map<string, number>(); // source_id -> citation number

    for (const result of results) {
      // Vérifier si on a déjà une citation pour ce document
      let citationNumber = seenSources.get(result.source_id);

      if (!citationNumber) {
        citationNumber = citations.length + 1;
        seenSources.set(result.source_id, citationNumber);

        citations.push({
          number: citationNumber,
          source_id: result.source_id,
          source_name: this.extractSourceName(result.source_metadata),
          page_number: result.chunk_metadata.page_number,
          section_title: result.chunk_metadata.section_title,
          quoted_text: this.extractQuote(result.chunk_text),
          relevance_score: this.calculateRelevance(result),
        });
      }
    }

    return citations;
  }

  /**
   * Construit le contexte RAG avec citations intégrées
   */
  buildRAGContext(results: SearchResult[]): RAGContext {
    const citations = this.generateCitations(results);

    // Construire le texte de contexte avec citations inline
    const contextParts: string[] = [];
    let totalTokens = 0;

    for (const result of results) {
      const citationNumber = this.findCitationNumber(citations, result.source_id);
      const sourceName = this.extractSourceName(result.source_metadata);
      const pageRef = result.chunk_metadata.page_number
        ? `, page ${result.chunk_metadata.page_number}`
        : '';

      // Format: [Citation #1: Document.pdf, page 5]
      // Texte du chunk...
      const citationHeader = `[Citation #${citationNumber}: ${sourceName}${pageRef}]`;
      const chunkWithCitation = `${citationHeader}\n${result.chunk_text}`;

      contextParts.push(chunkWithCitation);
      totalTokens += this.estimateTokens(chunkWithCitation);
    }

    const contextText = contextParts.join('\n\n---\n\n');

    return {
      chunks: results,
      context_text: contextText,
      citations,
      total_tokens: totalTokens,
    };
  }

  /**
   * Génère un contexte formaté pour injection dans un prompt LLM
   */
  buildPromptContext(results: SearchResult[], maxTokens: number = 4000): string {
    const context = this.buildRAGContext(results);

    // Si le contexte est trop grand, tronquer
    if (context.total_tokens > maxTokens) {
      return this.truncateContext(context, maxTokens);
    }

    // Ajouter les instructions pour le LLM
    const instructions = `Vous avez accès aux documents suivants pour répondre à la question. Citez toujours vos sources en utilisant le format [Citation #N].

DOCUMENTS DISPONIBLES:
${this.formatCitationsList(context.citations)}

CONTENU DES DOCUMENTS:

${context.context_text}

---

Instructions:
1. Utilisez UNIQUEMENT les informations des documents ci-dessus
2. Citez vos sources avec [Citation #N]
3. Si l'information n'est pas dans les documents, dites "Je n'ai pas trouvé cette information dans les documents fournis"
4. Ne jamais inventer ou halluciner des informations
`;

    return instructions;
  }

  /**
   * Extrait le nom du fichier source depuis les métadonnées
   */
  private extractSourceName(metadata: Record<string, any>): string {
    return (
      metadata.file_name ||
      metadata.filename ||
      metadata.name ||
      metadata.title ||
      'Document sans nom'
    );
  }

  /**
   * Extrait un court extrait du texte pour la citation
   */
  private extractQuote(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Trouver le dernier espace avant maxLength
    let cutIndex = maxLength;
    while (cutIndex > 0 && text[cutIndex] !== ' ') {
      cutIndex--;
    }

    if (cutIndex === 0) {
      cutIndex = maxLength;
    }

    return text.substring(0, cutIndex) + '...';
  }

  /**
   * Calcule le score de pertinence d'un résultat
   */
  private calculateRelevance(result: SearchResult): number {
    return (
      result.combined_score ||
      result.vector_similarity ||
      result.fts_rank ||
      0
    );
  }

  /**
   * Trouve le numéro de citation pour un source_id
   */
  private findCitationNumber(citations: Citation[], sourceId: string): number {
    const citation = citations.find((c) => c.source_id === sourceId);
    return citation?.number || 0;
  }

  /**
   * Estime le nombre de tokens (approximatif)
   */
  private estimateTokens(text: string): number {
    // Approximation simple: 1 token ≈ 3 caractères
    return Math.ceil(text.length / 3);
  }

  /**
   * Tronque le contexte pour respecter la limite de tokens
   */
  private truncateContext(context: RAGContext, maxTokens: number): string {
    const parts: string[] = [];
    let currentTokens = 0;

    for (const result of context.chunks) {
      const chunkTokens = this.estimateTokens(result.chunk_text);

      if (currentTokens + chunkTokens > maxTokens) {
        break;
      }

      const citationNumber = this.findCitationNumber(context.citations, result.source_id);
      const sourceName = this.extractSourceName(result.source_metadata);
      const pageRef = result.chunk_metadata.page_number
        ? `, page ${result.chunk_metadata.page_number}`
        : '';

      parts.push(`[Citation #${citationNumber}: ${sourceName}${pageRef}]\n${result.chunk_text}`);
      currentTokens += chunkTokens;
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * Formate la liste des citations pour le prompt
   */
  private formatCitationsList(citations: Citation[]): string {
    return citations
      .map((c) => {
        const pageRef = c.page_number ? `, page ${c.page_number}` : '';
        const sectionRef = c.section_title ? ` - ${c.section_title}` : '';
        return `[Citation #${c.number}] ${c.source_name}${pageRef}${sectionRef}`;
      })
      .join('\n');
  }
}

/**
 * Helper: Générer des citations rapidement
 */
export function generateCitations(results: SearchResult[]): Citation[] {
  const generator = new CitationGenerator();
  return generator.generateCitations(results);
}

/**
 * Helper: Construire un contexte RAG avec citations
 */
export function buildRAGContext(results: SearchResult[]): RAGContext {
  const generator = new CitationGenerator();
  return generator.buildRAGContext(results);
}

/**
 * Helper: Construire un prompt avec contexte et citations
 */
export function buildPromptContext(results: SearchResult[], maxTokens?: number): string {
  const generator = new CitationGenerator();
  return generator.buildPromptContext(results, maxTokens);
}

/**
 * Valide qu'une réponse LLM cite correctement ses sources
 */
export function validateCitations(
  response: string,
  availableCitations: Citation[]
): {
  valid: boolean;
  used_citations: number[];
  invalid_citations: number[];
  missing_citations: boolean;
} {
  // Extraire les numéros de citations dans la réponse
  const citationPattern = /\[Citation #(\d+)\]/g;
  const matches = Array.from(response.matchAll(citationPattern));
  const usedCitations = matches.map((m) => parseInt(m[1]));

  // Vérifier que toutes les citations utilisées sont valides
  const availableNumbers = availableCitations.map((c) => c.number);
  const invalidCitations = usedCitations.filter(
    (num) => !availableNumbers.includes(num)
  );

  // Vérifier qu'il y a au moins une citation
  const missingCitations = usedCitations.length === 0;

  return {
    valid: invalidCitations.length === 0 && !missingCitations,
    used_citations: [...new Set(usedCitations)], // Dédupliquer
    invalid_citations: invalidCitations,
    missing_citations: missingCitations,
  };
}
