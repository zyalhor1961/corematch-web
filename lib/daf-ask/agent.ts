/**
 * Ask DAF - LLM Agent with Tool Calling
 * Orchestrates natural language queries into data queries
 *
 * STRICT DOMAIN: Finance, accounting, documents, business activities only
 */

import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { DAF_TOOLS, DafAskResponse, ColumnDefinition } from './types';
import { executeTool, generateCSV } from './tools';

// =============================================================================
// Out-of-Scope Detection
// =============================================================================

const OUT_OF_SCOPE_KEYWORDS = [
  // Cuisine
  'recette', 'cuisine', 'cuire', 'cuisson', 'ingrédient', 'plat', 'repas',
  'pâtes', 'sauce', 'dessert', 'gâteau', 'pizza', 'salade', 'soupe',
  'recipe', 'cook', 'cooking', 'ingredient', 'dish', 'meal', 'pasta',
  // Météo
  'météo', 'temps', 'pluie', 'soleil', 'température', 'weather', 'rain', 'sunny',
  // Voyages/Loisirs
  'voyage', 'vacances', 'hôtel', 'avion', 'plage', 'tourisme',
  'travel', 'vacation', 'hotel', 'flight', 'beach', 'tourism',
  // Divertissement
  'film', 'série', 'musique', 'chanson', 'jeu', 'sport', 'match',
  'movie', 'series', 'music', 'song', 'game',
  // Personnel
  'amour', 'relation', 'santé', 'médecin', 'maladie', 'enfant', 'bébé',
  'love', 'relationship', 'health', 'doctor', 'illness', 'child', 'baby',
  // Animaux
  'chien', 'chat', 'animal', 'dog', 'cat', 'pet',
];

const BUSINESS_KEYWORDS = [
  // Finance FR
  'facture', 'fournisseur', 'client', 'montant', 'paiement', 'dépense',
  'budget', 'comptabilité', 'trésorerie', 'devis', 'contrat', 'impayé',
  'échéance', 'règlement', 'virement', 'tva', 'ht', 'ttc', 'euros', '€',
  // Finance EN
  'invoice', 'supplier', 'customer', 'amount', 'payment', 'expense',
  'budget', 'accounting', 'treasury', 'quote', 'contract', 'unpaid',
  'due', 'settlement', 'transfer', 'vat',
  // Documents
  'document', 'fichier', 'pdf', 'cv', 'candidat', 'candidature',
  'file', 'candidate', 'resume', 'application',
  // Business
  'entreprise', 'société', 'activité', 'chiffre', 'affaires', 'commerce',
  'company', 'business', 'activity', 'revenue', 'sales',
];

function isOutOfScope(question: string): boolean {
  const lowerQuestion = question.toLowerCase();

  // Count business vs out-of-scope keywords
  let outOfScopeScore = 0;
  let businessScore = 0;

  for (const keyword of OUT_OF_SCOPE_KEYWORDS) {
    if (lowerQuestion.includes(keyword)) {
      outOfScopeScore++;
    }
  }

  for (const keyword of BUSINESS_KEYWORDS) {
    if (lowerQuestion.includes(keyword)) {
      businessScore++;
    }
  }

  // If more out-of-scope than business keywords, reject
  return outOfScopeScore > 0 && outOfScopeScore > businessScore;
}

// =============================================================================
// Reinforced System Prompt - FRENCH
// =============================================================================

function getSystemPromptFR(currentDate: string): string {
  return `Tu es l'assistant financier Corematch, spécialisé dans l'analyse des documents comptables et RH de l'entreprise.

Date du jour : ${currentDate}

DOMAINE DE COMPETENCE
Tu réponds uniquement aux questions sur :
- Les factures, paiements, dépenses et budgets
- Les documents de l'entreprise (contrats, devis, relevés)
- Les candidatures et CV reçus
- Les statistiques d'activité

Pour toute question hors de ce périmètre, réponds simplement :
"Cette question sort du cadre de l'analyse documentaire. Je peux vous aider sur vos factures, dépenses, documents ou candidatures."

REGLES DE FONCTIONNEMENT
- Consulte toujours les données via les outils disponibles avant de répondre
- Ne donne jamais de chiffres sans les avoir récupérés des outils
- Si aucune donnée n'est trouvée, indique-le clairement
- Reste factuel et concis

OUTILS DISPONIBLES
- list_invoices : liste des factures (status='unpaid' pour les impayés)
- sum_invoices : calcul des totaux
- invoices_by_supplier : répartition par fournisseur
- invoices_by_month : évolution mensuelle
- list_documents : tous les documents
- list_cvs : candidatures reçues
- get_overview_stats : statistiques générales
- search_documents : recherche par mots-clés
- semantic_search : recherche par thématique

FORMAT DE REPONSE
- Commence par le résultat principal (nombre de documents, montant total)
- Donne le détail si pertinent
- Reste direct et professionnel
- Si des documents sont trouvés, mentionne qu'ils sont consultables via les liens

Exemple avec données :
"5 factures non réglées pour un total de 3 450 euros.
Détail :
- EDF : 1 200 euros, échéance dépassée de 15 jours
- Orange : 850 euros, échéance dans 5 jours
Les documents sont accessibles via les liens ci-dessous."

Exemple sans données :
"Aucune facture non réglée trouvée dans vos documents."`;
}

// =============================================================================
// Reinforced System Prompt - ENGLISH
// =============================================================================

function getSystemPromptEN(currentDate: string): string {
  return `You are the Corematch financial assistant, specialized in analyzing accounting and HR documents.

Current date: ${currentDate}

SCOPE
You answer questions about:
- Invoices, payments, expenses and budgets
- Company documents (contracts, quotes, statements)
- Applications and CVs received
- Activity statistics

For questions outside this scope, respond:
"This question is outside document analysis. I can help with your invoices, expenses, documents or applications."

OPERATING RULES
- Always query data through available tools before responding
- Never provide numbers without retrieving them from tools
- If no data is found, state it clearly
- Stay factual and concise

AVAILABLE TOOLS
- list_invoices: invoice list (status='unpaid' for overdue)
- sum_invoices: calculate totals
- invoices_by_supplier: breakdown by supplier
- invoices_by_month: monthly trends
- list_documents: all documents
- list_cvs: received applications
- get_overview_stats: general statistics
- search_documents: keyword search
- semantic_search: topic-based search

RESPONSE FORMAT
- Start with the main result (document count, total amount)
- Provide details if relevant
- Stay direct and professional
- When documents are found, mention they can be accessed via the links

Example with data:
"5 unpaid invoices totaling 3,450 euros.
Details:
- EDF: 1,200 euros, 15 days overdue
- Orange: 850 euros, due in 5 days
Documents are accessible via the links below."

Example without data:
"No unpaid invoices found in your documents."`;
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
// Response Validation
// =============================================================================

function validateResponse(
  answer: string,
  toolsCalled: string[],
  rows: any[],
  language: 'fr' | 'en'
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check if tools were called
  if (toolsCalled.length === 0) {
    warnings.push(
      language === 'fr'
        ? 'Aucun outil n\'a été appelé - réponse potentiellement incomplète'
        : 'No tool was called - response may be incomplete'
    );
  }

  // Check for suspicious number patterns (potential hallucination)
  const numberPattern = /\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?\s*€/g;
  const numbersInAnswer = answer.match(numberPattern) || [];

  // If numbers in answer but no rows returned, might be hallucination
  if (numbersInAnswer.length > 0 && rows.length === 0 && toolsCalled.length > 0) {
    warnings.push(
      language === 'fr'
        ? 'Attention: des montants sont mentionnés mais aucune donnée n\'a été trouvée'
        : 'Warning: amounts mentioned but no data was found'
    );
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
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

  // Check for out-of-scope questions BEFORE calling the LLM
  if (isOutOfScope(question)) {
    console.log(`[Ask DAF] Out-of-scope question detected: "${question.substring(0, 50)}..."`);

    const outOfScopeMessage = language === 'fr'
      ? "Cette question sort du cadre de l'analyse documentaire. Je peux vous aider sur vos factures, dépenses, documents ou candidatures."
      : "This question is outside document analysis. I can help with your invoices, expenses, documents or applications.";

    return {
      answer: outOfScopeMessage,
      mode: 'analysis',
      warnings: [language === 'fr' ? 'Question hors domaine détectée' : 'Out-of-scope question detected'],
      debug: {
        toolsCalled: [],
        duration: Date.now() - startTime,
      },
    };
  }

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
                // Build document URL
                let docUrl: string | undefined;
                if (row.file_url) {
                  docUrl = row.file_url;
                } else if (row.storage_path) {
                  // Generate Supabase storage URL
                  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                  if (supabaseUrl) {
                    docUrl = `${supabaseUrl}/storage/v1/object/public/daf-documents/${row.storage_path}`;
                  }
                } else {
                  // Fallback to viewer URL
                  docUrl = `/daf/documents/${row.id}/viewer`;
                }

                sourceDocuments.push({
                  id: row.id,
                  title: row.file_name,
                  type: row.ai_detected_type || row.doc_type || 'document',
                  url: docUrl,
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

    // Validate the response
    const validation = validateResponse(answer, toolsCalled, allRows, language);
    if (!validation.isValid) {
      warnings.push(...validation.warnings);
    }

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

    console.log(`[Ask DAF] Response generated in ${duration}ms, tools: ${toolsCalled.join(', ')}, rows: ${allRows.length}`);

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
