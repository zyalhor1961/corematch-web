/**
 * Ask DAF - LLM Agent with Tool Calling
 * Orchestrates natural language queries into data queries
 */

import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { DAF_TOOLS, DafAskResponse, ColumnDefinition } from './types';
import { executeTool, generateCSV } from './tools';

// =============================================================================
// System Prompt
// =============================================================================

function getSystemPromptFR(currentDate: string): string {
  return `Tu es un assistant financier intelligent pour PME et DAF (Directeur Administratif et Financier).

**DATE ACTUELLE:** ${currentDate}

**TON RÔLE:**
- Tu aides les utilisateurs à analyser leurs documents financiers (factures, contrats, CVs, etc.)
- Tu réponds en utilisant UNIQUEMENT les données présentes dans leur base Corematch via les tools fournis
- Tu ne devines JAMAIS des chiffres ou des informations
- Tu adaptes ta réponse au contexte business de l'utilisateur

**RÈGLES IMPORTANTES:**
1. Utilise TOUJOURS les tools pour récupérer les données AVANT de répondre
2. Si tu ne trouves pas de données, dis-le clairement : "Je n'ai trouvé aucun document correspondant"
3. Donne des montants en euros avec le symbole €
4. Pour les dates, utilise le format français (JJ/MM/AAAA)
5. Sois concis mais informatif
6. Si la question est ambiguë, fais une hypothèse raisonnable et mentionne-la
7. N'invente JAMAIS de données - utilise uniquement ce que les tools retournent

**TOOLS DISPONIBLES:**
- list_invoices: Liste les factures avec filtres (status, supplier, dates, amounts)
- sum_invoices: Calcule les totaux de factures
- invoices_by_supplier: Analyse par fournisseur
- invoices_by_month: Évolution mensuelle
- list_documents: Liste tous les documents
- list_cvs: Liste les CVs reçus
- get_overview_stats: Statistiques générales
- search_documents: Recherche plein texte dans le contenu
- semantic_search: Recherche sémantique IA - utilise pour des questions complexes ou conceptuelles

**FORMAT DE RÉPONSE:**
- Commence par un résumé clair de la réponse basé sur les données des tools
- Mentionne le nombre de résultats trouvés
- Indique si les données peuvent être incomplètes`;
}

function getSystemPromptEN(currentDate: string): string {
  return `You are an intelligent financial assistant for SMBs and CFOs.

**CURRENT DATE:** ${currentDate}

**YOUR ROLE:**
- Help users analyze their financial documents (invoices, contracts, CVs, etc.)
- Answer using ONLY data from their Corematch database via provided tools
- NEVER guess numbers or information
- Adapt your response to the user's business context

**IMPORTANT RULES:**
1. ALWAYS use tools to retrieve data BEFORE answering
2. If no data is found, say clearly: "I found no matching documents"
3. Give amounts in euros with € symbol
4. For dates, use format DD/MM/YYYY
5. Be concise but informative
6. If the question is ambiguous, make a reasonable assumption and mention it
7. NEVER invent data - only use what the tools return

**AVAILABLE TOOLS:**
- list_invoices: List invoices with filters (status, supplier, dates, amounts)
- sum_invoices: Calculate invoice totals
- invoices_by_supplier: Analysis by supplier
- invoices_by_month: Monthly trends
- list_documents: List all documents
- list_cvs: List received CVs
- get_overview_stats: General statistics
- search_documents: Full-text search in content
- semantic_search: AI semantic search - use for complex or conceptual queries

**RESPONSE FORMAT:**
- Start with a clear summary based on tool data
- Mention the number of results found
- Indicate if data may be incomplete`;
}

// =============================================================================
// Language Detection
// =============================================================================

function detectLanguage(text: string): 'fr' | 'en' {
  const frenchIndicators = [
    'facture', 'fournisseur', 'montant', 'combien', 'donne', 'liste', 'montre',
    'dépensé', 'reçu', 'payé', 'échéance', 'réglé', 'moi', 'les', 'des', 'une',
    'qu\'', 'j\'ai', 'ce', 'cette', 'quel', 'quels', 'euros'
  ];

  const englishIndicators = [
    'invoice', 'supplier', 'amount', 'how much', 'give', 'list', 'show',
    'spent', 'received', 'paid', 'due', 'the', 'what', 'which', 'dollars'
  ];

  const lowerText = text.toLowerCase();

  let frScore = 0;
  let enScore = 0;

  for (const word of frenchIndicators) {
    if (lowerText.includes(word)) frScore++;
  }

  for (const word of englishIndicators) {
    if (lowerText.includes(word)) enScore++;
  }

  return frScore >= enScore ? 'fr' : 'en';
}

// =============================================================================
// Convert Tools to Anthropic Format
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
// Agent Execution
// =============================================================================

export interface AgentOptions {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  language?: 'fr' | 'en' | 'auto';
  orgInstructions?: string;
}

export async function runDafAgent(
  question: string,
  options: AgentOptions
): Promise<DafAskResponse> {
  const startTime = Date.now();
  const toolsCalled: string[] = [];

  // Detect language
  const language = options.language === 'auto' || !options.language
    ? detectLanguage(question)
    : options.language;

  // Get current date for context
  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemPrompt = language === 'fr'
    ? getSystemPromptFR(currentDate)
    : getSystemPromptEN(currentDate);

  // Add org-specific instructions if available
  const fullSystemPrompt = options.orgInstructions
    ? `${systemPrompt}\n\n**INSTRUCTIONS SPÉCIFIQUES DE L'ORGANISATION:**\n${options.orgInstructions}`
    : systemPrompt;

  // Initialize Claude client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  // Prepare messages
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: question }
  ];

  let allRows: Record<string, any>[] = [];
  let allColumns: ColumnDefinition[] = [];
  let sourceDocuments: Array<{ id: string; title: string; type: string; url?: string }> = [];
  let mode: 'analysis' | 'listing' | 'kpi' | 'mixed' = 'analysis';
  let warnings: string[] = [];

  try {
    // First call - let Claude decide which tools to use
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: fullSystemPrompt,
      tools: getAnthropicTools(),
      messages,
    });

    // Process tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: [],
      };

      for (const toolUse of toolUseBlocks) {
        toolsCalled.push(toolUse.name);
        console.log(`[Ask DAF] Tool call: ${toolUse.name}`, toolUse.input);

        try {
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, any>,
            options.supabase,
            options.orgId
          );

          // Collect data for response
          if ('rows' in result && Array.isArray(result.rows)) {
            allRows = [...allRows, ...result.rows];
            if (result.columns) {
              allColumns = result.columns;
            }

            // Extract source documents if they have IDs
            for (const row of result.rows) {
              if (row.id && row.file_name) {
                sourceDocuments.push({
                  id: row.id,
                  title: row.file_name,
                  type: row.ai_detected_type || row.doc_type || 'document',
                });
              }
            }

            // Determine mode based on tool
            if (toolUse.name.includes('sum') || toolUse.name.includes('stats')) {
              mode = 'kpi';
            } else if (toolUse.name.includes('list') || toolUse.name.includes('search')) {
              mode = allRows.length > 0 ? 'listing' : mode;
            } else if (toolUse.name.includes('by_')) {
              mode = 'analysis';
            }
          } else if ('stats' in result) {
            // Overview stats - convert to rows
            const stats = result.stats;
            allRows = Object.entries(stats).map(([key, value]) => ({
              metric: key,
              value,
            }));
            allColumns = result.columns || [];
            mode = 'kpi';
          }

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (toolError) {
          console.error(`[Ask DAF] Tool error for ${toolUse.name}:`, toolError);
          warnings.push(`Erreur lors de l'exécution de ${toolUse.name}`);

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: String(toolError) }),
            is_error: true,
          });
        }
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push(toolResults);

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: fullSystemPrompt,
        tools: getAnthropicTools(),
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const answer = textBlocks.map(b => b.text).join('\n') ||
      (language === 'fr'
        ? 'Je n\'ai pas pu générer de réponse.'
        : 'I could not generate a response.');

    // Generate CSV export if we have data
    let csvExport: string | undefined;
    if (allRows.length > 0 && allColumns.length > 0) {
      csvExport = generateCSV(allRows, allColumns);
    }

    // Deduplicate source documents
    const uniqueSources = Array.from(
      new Map(sourceDocuments.map(d => [d.id, d])).values()
    ).slice(0, 10);

    const duration = Date.now() - startTime;

    return {
      answer,
      mode,
      rows: allRows.length > 0 ? allRows.slice(0, 100) : undefined, // Limit to 100 rows
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
    console.error('[Ask DAF] Agent error:', error);

    const errorMessage = language === 'fr'
      ? 'Désolé, une erreur s\'est produite lors du traitement de votre question.'
      : 'Sorry, an error occurred while processing your question.';

    return {
      answer: errorMessage,
      mode: 'analysis',
      warnings: [String(error)],
      debug: {
        toolsCalled,
        duration: Date.now() - startTime,
      },
    };
  }
}
