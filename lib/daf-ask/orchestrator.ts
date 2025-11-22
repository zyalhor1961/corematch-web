/**
 * Ask DAF - Orchestrator
 * Coordonne Intent Classifier, RAG, et Agent LLM
 *
 * Pipeline:
 * 1. Intent Classification (règles + LLM si ambiguë)
 * 2. RAG Context Retrieval (si nécessaire)
 * 3. Tool Execution avec contexte enrichi
 * 4. Response Generation avec validation
 */

import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { classifyIntent, getRecommendedTools, logClassification, IntentClassification, ToolRecommendation } from './intent-classifier';
import { DAF_TOOLS, DafAskResponse, ColumnDefinition, AskMode } from './types';
import { executeTool, generateCSV } from './tools';
import { validateDafResponse } from './validation';
import type { RAGContext, SearchResult } from '../rag/types';

// =============================================================================
// Configuration
// =============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;
const MAX_TOOL_ITERATIONS = 5;

// RAG settings
const RAG_MAX_CHUNKS = 5;
const RAG_MIN_SIMILARITY = 0.6;

// =============================================================================
// System Prompts (More Natural)
// =============================================================================

function buildSystemPrompt(
  language: 'fr' | 'en',
  currentDate: string,
  ragContext?: RAGContext,
  orgInstructions?: string
): string {
  const baseFR = `Tu es l'assistant financier Corematch, spécialisé dans l'analyse des documents comptables et RH.

Date : ${currentDate}

PÉRIMÈTRE
Questions acceptées :
- Factures, paiements, dépenses, budgets
- Documents entreprise (contrats, devis, relevés)
- Candidatures et CV reçus
- Statistiques d'activité

Pour les questions hors périmètre :
"Cette question sort du cadre de l'analyse documentaire. Je peux vous aider sur vos factures, dépenses, documents ou candidatures."

RÈGLES
- Toujours utiliser les outils pour accéder aux données
- Ne jamais inventer de chiffres
- Indiquer clairement si aucune donnée n'est trouvée
- Rester factuel et concis

OUTILS DISPONIBLES
- list_invoices : factures (status='unpaid' pour impayés)
- sum_invoices : totaux
- invoices_by_supplier : par fournisseur
- invoices_by_month : évolution mensuelle
- list_documents : tous les documents
- list_cvs : candidatures
- get_overview_stats : statistiques générales
- search_documents : recherche par mots-clés
- semantic_search : recherche par thème

FORMAT
- Résultat principal d'abord (nombre, montant)
- Détails si pertinent
- Mentionner les liens vers les documents`;

  const baseEN = `You are the Corematch financial assistant, specialized in accounting and HR documents.

Date: ${currentDate}

SCOPE
Accepted questions:
- Invoices, payments, expenses, budgets
- Company documents (contracts, quotes, statements)
- Applications and CVs
- Activity statistics

For out-of-scope questions:
"This question is outside document analysis. I can help with invoices, expenses, documents or applications."

RULES
- Always use tools to access data
- Never invent numbers
- Clearly state if no data is found
- Stay factual and concise

AVAILABLE TOOLS
- list_invoices: invoices (status='unpaid' for overdue)
- sum_invoices: totals
- invoices_by_supplier: by supplier
- invoices_by_month: monthly trends
- list_documents: all documents
- list_cvs: applications
- get_overview_stats: general statistics
- search_documents: keyword search
- semantic_search: topic search

FORMAT
- Main result first (count, amount)
- Details if relevant
- Mention document links`;

  let prompt = language === 'fr' ? baseFR : baseEN;

  // Add RAG context if available
  if (ragContext && ragContext.chunks.length > 0) {
    const contextHeader = language === 'fr'
      ? '\n\nCONTEXTE DOCUMENTAIRE (extrait des documents pertinents)'
      : '\n\nDOCUMENT CONTEXT (from relevant documents)';

    prompt += `${contextHeader}\n${ragContext.context_text}`;
  }

  // Add org-specific instructions
  if (orgInstructions) {
    const instrHeader = language === 'fr'
      ? '\n\nINSTRUCTIONS SPÉCIFIQUES'
      : '\n\nSPECIFIC INSTRUCTIONS';
    prompt += `${instrHeader}\n${orgInstructions}`;
  }

  return prompt;
}

// =============================================================================
// RAG Integration
// =============================================================================

async function fetchRAGContext(
  question: string,
  orgId: string,
  supabase: SupabaseClient,
  contentType?: string
): Promise<RAGContext | undefined> {
  try {
    // Import dynamically to avoid circular dependencies
    const { RAGRetrieval } = await import('../rag/retrieval');
    const retrieval = new RAGRetrieval();

    const results = await retrieval.search({
      query: question,
      org_id: orgId,
      content_type: contentType as any,
      limit: RAG_MAX_CHUNKS,
      similarity_threshold: RAG_MIN_SIMILARITY,
      mode: 'hybrid',
    });

    if (results.results.length === 0) {
      console.log('[Orchestrator] No RAG context found');
      return undefined;
    }

    // Build context text
    const contextParts: string[] = [];
    const citations: RAGContext['citations'] = [];

    results.results.forEach((r, index) => {
      const citation = {
        number: index + 1,
        source_id: r.source_id,
        source_name: r.source_metadata?.file_name || 'Document',
        page_number: r.chunk_metadata?.page_number,
        section_title: r.chunk_metadata?.section_title,
        quoted_text: r.chunk_text.substring(0, 200),
        relevance_score: r.combined_score || r.vector_similarity || 0,
      };

      citations.push(citation);

      contextParts.push(`[${citation.number}] ${citation.source_name}${citation.page_number ? ` (p.${citation.page_number})` : ''}\n${r.chunk_text}\n`);
    });

    const context_text = contextParts.join('\n---\n');

    // Estimate tokens (rough: 4 chars per token)
    const total_tokens = Math.ceil(context_text.length / 4);

    console.log(`[Orchestrator] RAG context: ${results.results.length} chunks, ~${total_tokens} tokens`);

    return {
      chunks: results.results,
      context_text,
      citations,
      total_tokens,
    };
  } catch (error) {
    console.error('[Orchestrator] RAG error:', error);
    return undefined;
  }
}

// =============================================================================
// Tool Format Conversion
// =============================================================================

function getAnthropicTools(): Anthropic.Tool[] {
  return DAF_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.parameters.properties,
      required: tool.parameters.required || [],
    },
  }));
}

// =============================================================================
// Mode Detection
// =============================================================================

function determineMode(toolsCalled: string[], rows: any[]): AskMode {
  if (toolsCalled.some(t => t.includes('sum') || t.includes('stats'))) {
    return 'kpi';
  }
  if (toolsCalled.some(t => t.includes('by_'))) {
    return 'analysis';
  }
  if (rows.length > 0) {
    return 'listing';
  }
  return 'analysis';
}

// =============================================================================
// Main Orchestrator
// =============================================================================

export interface OrchestratorOptions {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  language?: 'fr' | 'en' | 'auto';
  orgInstructions?: string;
  enableRAG?: boolean;
}

export async function orchestrateQuery(
  question: string,
  options: OrchestratorOptions
): Promise<DafAskResponse> {
  const startTime = Date.now();
  const toolsCalled: string[] = [];

  // ==========================================================================
  // Step 1: Intent Classification
  // ==========================================================================
  const classification = classifyIntent(question);
  logClassification(question, classification);

  const language = options.language === 'auto' || !options.language
    ? classification.language
    : options.language;

  // Handle out-of-scope immediately
  if (classification.intent === 'out_of_scope') {
    console.log(`[Orchestrator] Out-of-scope question detected`);

    return {
      answer: language === 'fr'
        ? "Cette question sort du cadre de l'analyse documentaire. Je peux vous aider sur vos factures, dépenses, documents ou candidatures."
        : "This question is outside document analysis. I can help with invoices, expenses, documents or applications.",
      mode: 'analysis',
      warnings: [language === 'fr' ? 'Question hors domaine' : 'Out-of-scope question'],
      debug: {
        toolsCalled: [],
        duration: Date.now() - startTime,
      },
    };
  }

  // ==========================================================================
  // Step 2: RAG Context (if needed)
  // ==========================================================================
  let ragContext: RAGContext | undefined;

  if ((options.enableRAG !== false) && classification.requiresRAG) {
    console.log('[Orchestrator] Fetching RAG context...');
    ragContext = await fetchRAGContext(
      question,
      options.orgId,
      options.supabase,
      classification.filters.docType
    );
  }

  // ==========================================================================
  // Step 3: Build System Prompt
  // ==========================================================================
  const currentDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const systemPrompt = buildSystemPrompt(
    language,
    currentDate,
    ragContext,
    options.orgInstructions
  );

  // ==========================================================================
  // Step 4: Initialize Claude
  // ==========================================================================
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  // ==========================================================================
  // Step 5: Tool Loop
  // ==========================================================================
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: question }
  ];

  let allRows: Record<string, any>[] = [];
  let allColumns: ColumnDefinition[] = [];
  let sourceDocuments: Array<{ id: string; title: string; type: string; url?: string }> = [];
  let warnings: string[] = [];
  let iterations = 0;

  try {
    let response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: getAnthropicTools(),
      messages,
    });

    while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: [],
      };

      for (const toolUse of toolUseBlocks) {
        toolsCalled.push(toolUse.name);
        console.log(`[Orchestrator] Tool: ${toolUse.name}`, JSON.stringify(toolUse.input));

        try {
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, any>,
            options.supabase,
            options.orgId
          );

          // Collect rows and columns
          if ('rows' in result && Array.isArray(result.rows)) {
            allRows = [...allRows, ...result.rows];
            if (result.columns) {
              allColumns = result.columns;
            }

            // Extract source documents
            for (const row of result.rows) {
              if (row.id && row.file_name) {
                sourceDocuments.push({
                  id: row.id,
                  title: row.file_name,
                  type: row.ai_detected_type || row.doc_type || 'document',
                  url: `/daf/documents/${row.id}/viewer`,
                });
              }
            }
          } else if ('stats' in result) {
            allRows = Object.entries(result.stats).map(([key, value]) => ({
              metric: key,
              value,
            }));
            allColumns = result.columns || [];
          }

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (toolError) {
          console.error(`[Orchestrator] Tool error (${toolUse.name}):`, toolError);
          warnings.push(`Erreur: ${toolUse.name}`);

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: String(toolError) }),
            is_error: true,
          });
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push(toolResults);

      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: getAnthropicTools(),
        messages,
      });
    }

    // ==========================================================================
    // Step 6: Extract Final Response
    // ==========================================================================
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const answer = textBlocks.map(b => b.text).join('\n') ||
      (language === 'fr'
        ? "Je n'ai pas pu générer de réponse."
        : 'I could not generate a response.');

    // ==========================================================================
    // Step 7: Validate Response (using validation layer)
    // ==========================================================================
    const validation = validateDafResponse({
      question,
      answer,
      toolsCalled,
      rows: allRows,
      columns: allColumns,
      language,
    });

    if (!validation.isValid) {
      warnings.push(...validation.warnings.map(w => w.message));
    }

    // Log validation confidence
    if (validation.confidence < 0.8) {
      console.log(`[Orchestrator] Low confidence response (${Math.round(validation.confidence * 100)}%)`);
    }

    // ==========================================================================
    // Step 8: Build Final Response
    // ==========================================================================
    const mode = determineMode(toolsCalled, allRows);

    // Generate CSV if data available
    let csvExport: string | undefined;
    if (allRows.length > 0 && allColumns.length > 0) {
      csvExport = generateCSV(allRows, allColumns);
    }

    // Deduplicate source documents
    const uniqueSources = Array.from(
      new Map(sourceDocuments.map(d => [d.id, d])).values()
    ).slice(0, 10);

    // Add RAG citations to sources
    if (ragContext?.citations) {
      for (const citation of ragContext.citations) {
        if (!uniqueSources.find(s => s.id === citation.source_id)) {
          uniqueSources.push({
            id: citation.source_id,
            title: citation.source_name,
            type: 'document',
            url: `/daf/documents/${citation.source_id}/viewer`,
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Orchestrator] Done in ${duration}ms | Tools: ${toolsCalled.join(', ')} | Rows: ${allRows.length}`);

    return {
      answer,
      mode,
      rows: allRows.length > 0 ? allRows.slice(0, 100) : undefined,
      columns: allColumns.length > 0 ? allColumns : undefined,
      exports: csvExport ? { csv: csvExport } : undefined,
      sourceDocuments: uniqueSources.length > 0 ? uniqueSources : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      debug: {
        toolsCalled,
        duration,
        tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
      },
    };

  } catch (error) {
    console.error('[Orchestrator] Error:', error);

    return {
      answer: language === 'fr'
        ? "Désolé, une erreur s'est produite lors du traitement de votre question."
        : 'Sorry, an error occurred while processing your question.',
      mode: 'analysis',
      warnings: [String(error)],
      debug: {
        toolsCalled,
        duration: Date.now() - startTime,
      },
    };
  }
}

// =============================================================================
// Legacy Export (backwards compatibility)
// =============================================================================

export { orchestrateQuery as runDafAgent };
