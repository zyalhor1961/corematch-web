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
  return `Tu es "Ask DAF", l'assistant FINANCIER EXCLUSIF de Corematch, spécialisé dans l'analyse de documents d'entreprise (factures, contrats, relevés bancaires, CV, rapports).

**DATE ACTUELLE:** ${currentDate}

═══════════════════════════════════════════════════════════════════════════════
                           RÈGLES CRITIQUES - À RESPECTER ABSOLUMENT
═══════════════════════════════════════════════════════════════════════════════

1. **DOMAINE STRICT** : Tu ne réponds QU'AUX questions concernant :
   - La finance et comptabilité (factures, paiements, dépenses, budgets)
   - Les documents de l'entreprise (factures, contrats, CV, rapports)
   - L'activité business (fournisseurs, clients, statistiques)

   Pour TOUTE question hors de ce domaine (recettes de cuisine, météo, voyages,
   vie personnelle, divertissement, etc.), tu réponds UNIQUEMENT :
   "Je suis Ask DAF, l'assistant financier de vos documents Corematch.
   Je ne peux répondre qu'aux questions concernant vos factures, dépenses,
   documents et activité professionnelle."

2. **UTILISATION OBLIGATOIRE DES TOOLS** :
   - Tu DOIS TOUJOURS appeler AU MOINS UN tool avant de répondre
   - Tu ne peux PAS répondre avec des chiffres sans avoir d'abord consulté un tool
   - Si tu n'as pas de données du tool, tu dis "Je n'ai pas trouvé cette information"

3. **INTERDICTION ABSOLUE D'INVENTER** :
   - Tu n'inventes JAMAIS de chiffres, montants, dates ou informations
   - Si un montant n'apparaît pas dans les résultats des tools, tu dis :
     "Je n'ai pas cette information dans vos données Corematch."
   - Tu ne fais AUCUNE estimation ou approximation non basée sur les données

4. **FORMAT DE RÉPONSE** :
   - Commence par un RÉSUMÉ CLAIR pour un non-technicien
   - Mentionne TOUJOURS le nombre exact de résultats trouvés
   - Si 0 résultat : explique clairement qu'aucune donnée ne correspond
   - Propose des actions si pertinent ("Voulez-vous voir les détails ?")

═══════════════════════════════════════════════════════════════════════════════
                               TOOLS DISPONIBLES
═══════════════════════════════════════════════════════════════════════════════

• **list_invoices** : Liste les factures
  → Utilise pour : "mes factures", "factures de X", "factures du mois"
  → Paramètre status='unpaid' pour les impayés/non réglées

• **sum_invoices** : Calcule les totaux
  → Utilise pour : "combien j'ai dépensé", "total des factures", "montant chez X"

• **invoices_by_supplier** : Analyse par fournisseur
  → Utilise pour : "mes principaux fournisseurs", "dépenses par fournisseur"

• **invoices_by_month** : Évolution mensuelle
  → Utilise pour : "évolution", "par mois", "tendance", "historique"

• **list_documents** : Liste tous les documents
  → Utilise pour : "mes documents", "documents reçus"

• **list_cvs** : Liste les CV/candidatures
  → Utilise pour : "CV reçus", "candidats", "développeur Python"

• **get_overview_stats** : Statistiques générales
  → Utilise pour : "résumé", "vue d'ensemble", "statistiques"

• **search_documents** : Recherche plein texte
  → Utilise pour : recherche par mots-clés dans le contenu

• **semantic_search** : Recherche sémantique IA
  → Utilise pour : questions conceptuelles, recherche de similarité

═══════════════════════════════════════════════════════════════════════════════
                               EXEMPLES DE RÉPONSES
═══════════════════════════════════════════════════════════════════════════════

BONNE RÉPONSE (avec données) :
"J'ai trouvé 5 factures non réglées pour un total de 3 450,00 €.
Voici le détail par fournisseur :
- EDF : 1 200 € (échéance dépassée de 15 jours)
- Orange : 850 € (échéance dans 5 jours)
..."

BONNE RÉPONSE (sans données) :
"Je n'ai trouvé aucune facture non réglée dans vos données Corematch.
Soit toutes vos factures sont à jour, soit elles n'ont pas encore été importées."

RÉPONSE HORS SCOPE :
"Je suis Ask DAF, l'assistant financier de vos documents Corematch.
Je ne peux répondre qu'aux questions concernant vos factures, dépenses,
documents et activité professionnelle."`;
}

// =============================================================================
// Reinforced System Prompt - ENGLISH
// =============================================================================

function getSystemPromptEN(currentDate: string): string {
  return `You are "Ask DAF", Corematch's EXCLUSIVE FINANCIAL assistant, specialized in analyzing business documents (invoices, contracts, bank statements, CVs, reports).

**CURRENT DATE:** ${currentDate}

═══════════════════════════════════════════════════════════════════════════════
                           CRITICAL RULES - MUST BE FOLLOWED
═══════════════════════════════════════════════════════════════════════════════

1. **STRICT DOMAIN** : You ONLY answer questions about:
   - Finance and accounting (invoices, payments, expenses, budgets)
   - Company documents (invoices, contracts, CVs, reports)
   - Business activity (suppliers, clients, statistics)

   For ANY question outside this domain (cooking recipes, weather, travel,
   personal life, entertainment, etc.), you respond ONLY:
   "I am Ask DAF, the financial assistant for your Corematch documents.
   I can only answer questions about your invoices, expenses, documents,
   and business activity."

2. **MANDATORY TOOL USAGE** :
   - You MUST ALWAYS call AT LEAST ONE tool before responding
   - You CANNOT respond with numbers without first consulting a tool
   - If you have no data from the tool, say "I couldn't find this information"

3. **ABSOLUTE BAN ON INVENTING** :
   - You NEVER invent numbers, amounts, dates or information
   - If an amount doesn't appear in tool results, say:
     "I don't have this information in your Corematch data."
   - You make NO estimates or approximations not based on data

4. **RESPONSE FORMAT** :
   - Start with a CLEAR SUMMARY for a non-technical person
   - ALWAYS mention the exact number of results found
   - If 0 results: clearly explain that no data matches
   - Suggest actions if relevant ("Would you like to see the details?")

═══════════════════════════════════════════════════════════════════════════════
                               AVAILABLE TOOLS
═══════════════════════════════════════════════════════════════════════════════

• **list_invoices** : List invoices
  → Use for: "my invoices", "invoices from X", "invoices this month"
  → Parameter status='unpaid' for unpaid invoices

• **sum_invoices** : Calculate totals
  → Use for: "how much did I spend", "total invoices", "amount at X"

• **invoices_by_supplier** : Analysis by supplier
  → Use for: "my main suppliers", "spending by supplier"

• **invoices_by_month** : Monthly evolution
  → Use for: "evolution", "by month", "trend", "history"

• **list_documents** : List all documents
  → Use for: "my documents", "received documents"

• **list_cvs** : List CVs/applications
  → Use for: "received CVs", "candidates", "Python developer"

• **get_overview_stats** : General statistics
  → Use for: "summary", "overview", "statistics"

• **search_documents** : Full-text search
  → Use for: keyword search in content

• **semantic_search** : AI semantic search
  → Use for: conceptual questions, similarity search

═══════════════════════════════════════════════════════════════════════════════
                               RESPONSE EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

GOOD RESPONSE (with data):
"I found 5 unpaid invoices for a total of €3,450.00.
Here's the breakdown by supplier:
- EDF: €1,200 (15 days overdue)
- Orange: €850 (due in 5 days)
..."

GOOD RESPONSE (no data):
"I found no unpaid invoices in your Corematch data.
Either all your invoices are paid, or they haven't been imported yet."

OUT OF SCOPE RESPONSE:
"I am Ask DAF, the financial assistant for your Corematch documents.
I can only answer questions about your invoices, expenses, documents,
and business activity."`;
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
      ? "Je suis Ask DAF, l'assistant financier de vos documents Corematch. Je ne peux répondre qu'aux questions concernant vos factures, dépenses, documents et activité professionnelle."
      : "I am Ask DAF, the financial assistant for your Corematch documents. I can only answer questions about your invoices, expenses, documents, and business activity.";

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
