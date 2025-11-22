/**
 * Ask DAF - Intent Classifier
 * Classifie les questions utilisateur pour optimiser l'orchestration des tools
 *
 * Architecture:
 * 1. Classification par règles (rapide, patterns connus)
 * 2. Classification LLM (questions complexes/ambiguës)
 * 3. Extraction des filtres contextuels (dates, montants, fournisseurs)
 */

// =============================================================================
// Intent Definitions
// =============================================================================

export type DafIntent =
  | 'sum_expenses_period'      // "combien j'ai dépensé en 2024"
  | 'list_invoices_filters'    // "mes factures de janvier"
  | 'list_unpaid_invoices'     // "factures non réglées"
  | 'supplier_analysis'        // "mes principaux fournisseurs"
  | 'monthly_trend'            // "évolution par mois"
  | 'document_activity'        // "documents reçus cette semaine"
  | 'cv_listing'               // "CV reçus", "candidats"
  | 'overview_stats'           // "résumé", "statistiques générales"
  | 'semantic_search'          // recherche conceptuelle
  | 'keyword_search'           // recherche mot-clé spécifique
  | 'out_of_scope';            // hors domaine

export interface ExtractedFilters {
  // Temporels
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  month?: number;

  // Financiers
  minAmount?: number;
  maxAmount?: number;

  // Entités
  supplier?: string;
  status?: string;
  skills?: string[];

  // Recherche
  searchQuery?: string;

  // Type de document
  docType?: 'invoice' | 'cv' | 'contract' | 'report' | 'other';
}

export interface IntentClassification {
  intent: DafIntent;
  confidence: number;       // 0-1
  filters: ExtractedFilters;
  language: 'fr' | 'en';
  suggestedTools: string[]; // outils recommandés
  requiresRAG: boolean;     // nécessite contexte RAG
  reasoning?: string;       // explication (debug)
}

// =============================================================================
// Pattern Definitions (Classification par règles)
// =============================================================================

interface IntentPattern {
  intent: DafIntent;
  patterns: RegExp[];
  keywords: string[];
  suggestedTools: string[];
  requiresRAG: boolean;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Factures impayées
  {
    intent: 'list_unpaid_invoices',
    patterns: [
      /factures?\s*(non\s*)?(réglée?s?|payée?s?|impayée?s?)/i,
      /factures?\s*en\s*(retard|attente)/i,
      /impayés?/i,
      /unpaid\s*invoices?/i,
      /overdue\s*(invoices?|payments?)/i,
    ],
    keywords: ['impayé', 'non réglé', 'non payé', 'retard', 'unpaid', 'overdue'],
    suggestedTools: ['list_invoices'],
    requiresRAG: false,
  },

  // Somme des dépenses
  {
    intent: 'sum_expenses_period',
    patterns: [
      /combien\s*(ai[-\s]?je|j'ai|avons[-\s]?nous)\s*dépensé/i,
      /total\s*(des\s*)?(dépenses|factures|montant)/i,
      /montant\s*total/i,
      /somme\s*(des\s*)?(factures|dépenses)/i,
      /how\s*much\s*(did|have)\s*(i|we)\s*spent?/i,
      /total\s*(amount|expenses?|invoices?)/i,
    ],
    keywords: ['combien', 'total', 'somme', 'dépensé', 'spent', 'how much'],
    suggestedTools: ['sum_invoices'],
    requiresRAG: false,
  },

  // Analyse fournisseurs
  {
    intent: 'supplier_analysis',
    patterns: [
      /principaux?\s*fournisseurs?/i,
      /top\s*fournisseurs?/i,
      /fournisseurs?\s*(principaux?|importants?)/i,
      /(dépenses?|factures?)\s*par\s*fournisseur/i,
      /répartition\s*(par\s*)?fournisseur/i,
      /main\s*suppliers?/i,
      /top\s*suppliers?/i,
      /(expenses?|invoices?)\s*by\s*supplier/i,
    ],
    keywords: ['fournisseur', 'supplier', 'principal', 'top', 'répartition'],
    suggestedTools: ['invoices_by_supplier'],
    requiresRAG: false,
  },

  // Évolution mensuelle
  {
    intent: 'monthly_trend',
    patterns: [
      /évolution\s*(des\s*)?(dépenses|factures)/i,
      /(dépenses|factures)\s*par\s*mois/i,
      /tendance\s*(mensuelle)?/i,
      /historique\s*(mensuel|des\s*dépenses)/i,
      /graphique\s*(des\s*)?(dépenses|factures)/i,
      /monthly\s*(trend|expenses?|invoices?)/i,
      /(expenses?|invoices?)\s*by\s*month/i,
      /evolution\s*of\s*(expenses?|spending)/i,
    ],
    keywords: ['évolution', 'mois', 'mensuel', 'tendance', 'trend', 'monthly', 'historique'],
    suggestedTools: ['invoices_by_month'],
    requiresRAG: false,
  },

  // Liste de factures avec filtres
  {
    intent: 'list_invoices_filters',
    patterns: [
      /liste\s*(des\s*)?factures/i,
      /mes\s*factures/i,
      /factures\s*(de|du|chez|pour)\s/i,
      /show\s*(me\s*)?(my\s*)?invoices?/i,
      /list\s*(of\s*)?(my\s*)?invoices?/i,
    ],
    keywords: ['facture', 'invoice', 'liste', 'list'],
    suggestedTools: ['list_invoices'],
    requiresRAG: false,
  },

  // Activité documentaire
  {
    intent: 'document_activity',
    patterns: [
      /documents?\s*(reçus?|uploadés?|ajoutés?)/i,
      /documents?\s*(cette|la)\s*(semaine|journée)/i,
      /documents?\s*(d')?(aujourd'hui|hier)/i,
      /récents?\s*documents?/i,
      /documents?\s*received/i,
      /recent\s*documents?/i,
    ],
    keywords: ['document', 'reçu', 'recent', 'uploaded', 'ajouté'],
    suggestedTools: ['list_documents'],
    requiresRAG: false,
  },

  // CV et candidatures
  {
    intent: 'cv_listing',
    patterns: [
      /cv\s*(reçus?|uploadés?)?/i,
      /candidats?\s*(reçus?)?/i,
      /candidatures?/i,
      /profils?\s*(reçus?)?/i,
      /resume[s]?\s*(received)?/i,
      /candidates?/i,
      /applications?\s*(received)?/i,
    ],
    keywords: ['cv', 'candidat', 'candidature', 'profil', 'resume', 'candidate'],
    suggestedTools: ['list_cvs'],
    requiresRAG: false,
  },

  // Statistiques générales
  {
    intent: 'overview_stats',
    patterns: [
      /résumé\s*(du\s*)?(workspace|activité)?/i,
      /statistiques?\s*(générales?)?/i,
      /vue\s*d'ensemble/i,
      /overview/i,
      /dashboard/i,
      /combien\s*(de\s*)?(documents?|factures?|cv)/i,
    ],
    keywords: ['résumé', 'statistique', 'overview', 'dashboard', 'ensemble'],
    suggestedTools: ['get_overview_stats'],
    requiresRAG: false,
  },

  // Recherche sémantique
  {
    intent: 'semantic_search',
    patterns: [
      /documents?\s*(concernant|sur|à\s*propos|liés?\s*à)/i,
      /cherche[r]?\s*(des\s*)?(documents?|factures?)\s*(sur|concernant)/i,
      /find\s*(documents?|invoices?)\s*(about|related\s*to|concerning)/i,
    ],
    keywords: ['concernant', 'propos', 'lié', 'related', 'about'],
    suggestedTools: ['semantic_search'],
    requiresRAG: true,
  },

  // Recherche mot-clé
  {
    intent: 'keyword_search',
    patterns: [
      /cherche[r]?\s*['"]?[\w\s]+['"]?/i,
      /recherche[r]?\s*['"]?[\w\s]+['"]?/i,
      /search\s*for\s*['"]?[\w\s]+['"]?/i,
      /find\s*['"]?[\w\s]+['"]?/i,
    ],
    keywords: ['cherche', 'recherche', 'search', 'find', 'trouver'],
    suggestedTools: ['search_documents'],
    requiresRAG: true,
  },
];

// =============================================================================
// Out-of-Scope Detection
// =============================================================================

const OUT_OF_SCOPE_PATTERNS = [
  // Cuisine
  /recette|cuisine|cuire|cuisson|ingrédient|plat|dessert|gâteau/i,
  /recipe|cook|cooking|ingredient|dish|dessert|cake/i,

  // Météo
  /météo|temps\s*(qu'il\s*fait|dehors)|température|weather|forecast/i,

  // Voyage/Loisirs
  /voyage|vacances|hôtel|avion|plage|travel|vacation|hotel|flight|beach/i,

  // Divertissement
  /film|série|musique|chanson|jeu\s*vidéo|sport|match/i,
  /movie|series|music|song|video\s*game/i,

  // Questions personnelles
  /santé|médecin|maladie|amour|relation/i,
  /health|doctor|illness|love|relationship/i,

  // Blagues et non-sens
  /blague|joke|raconte[-\s]*moi|tell\s*me\s*a/i,
];

// =============================================================================
// Date Extraction
// =============================================================================

interface DateRange {
  from?: string;
  to?: string;
}

function extractDateFilters(question: string): DateRange & { year?: number; month?: number } {
  const result: DateRange & { year?: number; month?: number } = {};
  const now = new Date();
  const lowerQ = question.toLowerCase();

  // Année spécifique (2024, 2023, etc.)
  const yearMatch = question.match(/\b(20[0-9]{2})\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1]);
    result.from = `${result.year}-01-01`;
    result.to = `${result.year}-12-31`;
  }

  // Ce mois-ci
  if (lowerQ.includes('ce mois') || lowerQ.includes('this month')) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    result.from = `${year}-${String(month).padStart(2, '0')}-01`;
    result.to = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    result.month = month;
  }

  // Mois dernier
  if (lowerQ.includes('mois dernier') || lowerQ.includes('last month')) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;
    result.from = `${year}-${String(month).padStart(2, '0')}-01`;
    result.to = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    result.month = month;
  }

  // Cette année
  if (lowerQ.includes('cette année') || lowerQ.includes('this year')) {
    result.year = now.getFullYear();
    result.from = `${result.year}-01-01`;
    result.to = `${result.year}-12-31`;
  }

  // Aujourd'hui
  if (lowerQ.includes("aujourd'hui") || lowerQ.includes('today')) {
    const today = now.toISOString().split('T')[0];
    result.from = today;
    result.to = today;
  }

  // Hier
  if (lowerQ.includes('hier') || lowerQ.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yest = yesterday.toISOString().split('T')[0];
    result.from = yest;
    result.to = yest;
  }

  // Cette semaine
  if (lowerQ.includes('cette semaine') || lowerQ.includes('this week')) {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Lundi
    result.from = startOfWeek.toISOString().split('T')[0];
    result.to = now.toISOString().split('T')[0];
  }

  // Mois spécifique (janvier, février, etc.)
  const months: Record<string, number> = {
    'janvier': 1, 'january': 1, 'jan': 1,
    'février': 2, 'february': 2, 'feb': 2, 'fevrier': 2,
    'mars': 3, 'march': 3, 'mar': 3,
    'avril': 4, 'april': 4, 'apr': 4,
    'mai': 5, 'may': 5,
    'juin': 6, 'june': 6, 'jun': 6,
    'juillet': 7, 'july': 7, 'jul': 7,
    'août': 8, 'august': 8, 'aug': 8, 'aout': 8,
    'septembre': 9, 'september': 9, 'sep': 9, 'sept': 9,
    'octobre': 10, 'october': 10, 'oct': 10,
    'novembre': 11, 'november': 11, 'nov': 11,
    'décembre': 12, 'december': 12, 'dec': 12, 'decembre': 12,
  };

  for (const [name, monthNum] of Object.entries(months)) {
    if (lowerQ.includes(name)) {
      const year = result.year || now.getFullYear();
      result.month = monthNum;
      result.from = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      result.to = `${year}-${String(monthNum).padStart(2, '0')}-${new Date(year, monthNum, 0).getDate()}`;
      break;
    }
  }

  return result;
}

// =============================================================================
// Entity Extraction
// =============================================================================

function extractSupplier(question: string): string | undefined {
  // Patterns: "chez X", "de X", "fournisseur X", "supplier X"
  const patterns = [
    /chez\s+([A-Z][A-Za-zÀ-ÿ\s&-]{2,30})/,
    /de\s+([A-Z][A-Za-zÀ-ÿ\s&-]{2,30})/,
    /fournisseur\s+([A-Za-zÀ-ÿ\s&-]{2,30})/i,
    /supplier\s+([A-Za-zÀ-ÿ\s&-]{2,30})/i,
    /from\s+([A-Z][A-Za-zÀ-ÿ\s&-]{2,30})/,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      const supplier = match[1].trim();
      // Éviter les faux positifs courants
      if (!['le', 'la', 'les', 'un', 'une', 'des', 'the', 'a', 'an'].includes(supplier.toLowerCase())) {
        return supplier;
      }
    }
  }

  return undefined;
}

function extractAmount(question: string): { min?: number; max?: number } {
  const result: { min?: number; max?: number } = {};

  // "plus de X euros"
  const plusMatch = question.match(/plus\s*de\s*(\d+(?:[.,]\d+)?)\s*€?/i);
  if (plusMatch) {
    result.min = parseFloat(plusMatch[1].replace(',', '.'));
  }

  // "moins de X euros"
  const moinsMatch = question.match(/moins\s*de\s*(\d+(?:[.,]\d+)?)\s*€?/i);
  if (moinsMatch) {
    result.max = parseFloat(moinsMatch[1].replace(',', '.'));
  }

  // "entre X et Y euros"
  const entreMatch = question.match(/entre\s*(\d+(?:[.,]\d+)?)\s*et\s*(\d+(?:[.,]\d+)?)\s*€?/i);
  if (entreMatch) {
    result.min = parseFloat(entreMatch[1].replace(',', '.'));
    result.max = parseFloat(entreMatch[2].replace(',', '.'));
  }

  // "more than X"
  const moreMatch = question.match(/more\s*than\s*(\d+(?:[.,]\d+)?)/i);
  if (moreMatch) {
    result.min = parseFloat(moreMatch[1].replace(',', '.'));
  }

  // "less than X"
  const lessMatch = question.match(/less\s*than\s*(\d+(?:[.,]\d+)?)/i);
  if (lessMatch) {
    result.max = parseFloat(lessMatch[1].replace(',', '.'));
  }

  return result;
}

function extractSkills(question: string): string[] | undefined {
  // Patterns pour compétences CV
  const skillPatterns = [
    /développeur\s+([A-Za-z#+]+)/i,
    /developer\s+([A-Za-z#+]+)/i,
    /compétence[s]?\s+([A-Za-z#+,\s]+)/i,
    /skill[s]?\s+([A-Za-z#+,\s]+)/i,
    /profil\s+([A-Za-z#+]+)/i,
  ];

  for (const pattern of skillPatterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      return match[1].split(/[,\s]+/).filter(s => s.length > 1);
    }
  }

  // Technologies courantes mentionnées directement
  const commonSkills = [
    'python', 'javascript', 'typescript', 'java', 'c#', 'c++', 'rust', 'go',
    'react', 'vue', 'angular', 'node', 'django', 'flask', 'spring',
    'sql', 'mongodb', 'postgresql', 'mysql', 'redis',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes',
    'devops', 'frontend', 'backend', 'fullstack',
  ];

  const foundSkills = commonSkills.filter(skill =>
    question.toLowerCase().includes(skill)
  );

  return foundSkills.length > 0 ? foundSkills : undefined;
}

// =============================================================================
// Language Detection
// =============================================================================

function detectLanguage(text: string): 'fr' | 'en' {
  const frenchIndicators = [
    'facture', 'fournisseur', 'montant', 'combien', 'donne', 'liste',
    'dépensé', 'reçu', 'payé', 'échéance', 'moi', 'les', 'des', 'une',
    'qu\'', 'j\'ai', 'ce', 'cette', 'quel', 'euros', 'résumé'
  ];

  const englishIndicators = [
    'invoice', 'supplier', 'amount', 'how much', 'give', 'list',
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
// Main Classifier (Rule-based)
// =============================================================================

export function classifyIntent(question: string): IntentClassification {
  const lowerQuestion = question.toLowerCase();
  const language = detectLanguage(question);

  // 1. Check out-of-scope first
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(lowerQuestion)) {
      return {
        intent: 'out_of_scope',
        confidence: 0.95,
        filters: {},
        language,
        suggestedTools: [],
        requiresRAG: false,
        reasoning: 'Question hors domaine détectée par pattern',
      };
    }
  }

  // 2. Extract all filters
  const dateFilters = extractDateFilters(question);
  const supplier = extractSupplier(question);
  const amounts = extractAmount(question);
  const skills = extractSkills(question);

  const filters: ExtractedFilters = {
    ...dateFilters,
    ...(supplier && { supplier }),
    ...(amounts.min && { minAmount: amounts.min }),
    ...(amounts.max && { maxAmount: amounts.max }),
    ...(skills && { skills }),
  };

  // 3. Match patterns (highest confidence wins)
  let bestMatch: IntentPattern | null = null;
  let bestScore = 0;

  for (const intentPattern of INTENT_PATTERNS) {
    let score = 0;

    // Check regex patterns (high weight)
    for (const pattern of intentPattern.patterns) {
      if (pattern.test(question)) {
        score += 3;
      }
    }

    // Check keywords (lower weight)
    for (const keyword of intentPattern.keywords) {
      if (lowerQuestion.includes(keyword)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = intentPattern;
    }
  }

  // 4. If no strong match, use heuristics
  if (!bestMatch || bestScore < 2) {
    // Default to semantic search for ambiguous queries
    return {
      intent: 'semantic_search',
      confidence: 0.5,
      filters,
      language,
      suggestedTools: ['semantic_search', 'search_documents'],
      requiresRAG: true,
      reasoning: 'Pas de pattern clair - recherche sémantique par défaut',
    };
  }

  // 5. Calculate confidence
  const confidence = Math.min(0.95, 0.5 + (bestScore * 0.1));

  // 6. Adjust tools based on filters
  let suggestedTools = [...bestMatch.suggestedTools];

  // Si supplier mentionné avec sum intent, ajouter le filtre
  if (supplier && bestMatch.intent === 'sum_expenses_period') {
    filters.supplier = supplier;
  }

  // Si status unpaid demandé
  if (lowerQuestion.includes('impayé') ||
      lowerQuestion.includes('non réglé') ||
      lowerQuestion.includes('unpaid')) {
    filters.status = 'unpaid';
  }

  return {
    intent: bestMatch.intent,
    confidence,
    filters,
    language,
    suggestedTools,
    requiresRAG: bestMatch.requiresRAG,
    reasoning: `Pattern matched: ${bestMatch.intent} (score: ${bestScore})`,
  };
}

// =============================================================================
// Tool Recommendation
// =============================================================================

export interface ToolRecommendation {
  name: string;
  params: Record<string, any>;
  priority: number; // 1 = primary, 2 = secondary
}

export function getRecommendedTools(classification: IntentClassification): ToolRecommendation[] {
  const recommendations: ToolRecommendation[] = [];
  const { intent, filters } = classification;

  switch (intent) {
    case 'list_unpaid_invoices':
      recommendations.push({
        name: 'list_invoices',
        params: { status: 'unpaid', limit: 50, ...buildDateParams(filters) },
        priority: 1,
      });
      break;

    case 'sum_expenses_period':
      recommendations.push({
        name: 'sum_invoices',
        params: {
          ...buildDateParams(filters),
          ...(filters.supplier && { supplier: filters.supplier }),
        },
        priority: 1,
      });
      break;

    case 'list_invoices_filters':
      recommendations.push({
        name: 'list_invoices',
        params: {
          ...buildDateParams(filters),
          ...(filters.supplier && { supplier: filters.supplier }),
          ...(filters.status && { status: filters.status }),
          ...(filters.minAmount && { minAmount: filters.minAmount }),
          ...(filters.maxAmount && { maxAmount: filters.maxAmount }),
          limit: 50,
        },
        priority: 1,
      });
      break;

    case 'supplier_analysis':
      recommendations.push({
        name: 'invoices_by_supplier',
        params: { ...buildDateParams(filters), limit: 20 },
        priority: 1,
      });
      break;

    case 'monthly_trend':
      recommendations.push({
        name: 'invoices_by_month',
        params: {
          ...(filters.year && { year: filters.year }),
          ...(filters.supplier && { supplier: filters.supplier }),
          months: 12,
        },
        priority: 1,
      });
      break;

    case 'document_activity':
      recommendations.push({
        name: 'list_documents',
        params: { ...buildDateParams(filters), limit: 50 },
        priority: 1,
      });
      break;

    case 'cv_listing':
      recommendations.push({
        name: 'list_cvs',
        params: {
          ...buildDateParams(filters),
          ...(filters.skills && { skills: filters.skills.join(',') }),
          limit: 50,
        },
        priority: 1,
      });
      break;

    case 'overview_stats':
      recommendations.push({
        name: 'get_overview_stats',
        params: {},
        priority: 1,
      });
      break;

    case 'semantic_search':
      recommendations.push({
        name: 'semantic_search',
        params: {
          query: filters.searchQuery || '',
          ...(filters.docType && { type: filters.docType }),
          limit: 10,
        },
        priority: 1,
      });
      break;

    case 'keyword_search':
      recommendations.push({
        name: 'search_documents',
        params: {
          query: filters.searchQuery || '',
          ...(filters.docType && { type: filters.docType }),
          limit: 20,
        },
        priority: 1,
      });
      break;

    default:
      // Fallback to semantic search
      recommendations.push({
        name: 'semantic_search',
        params: { query: filters.searchQuery || '', limit: 10 },
        priority: 1,
      });
  }

  return recommendations;
}

function buildDateParams(filters: ExtractedFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  return params;
}

// =============================================================================
// Debug / Logging
// =============================================================================

export function logClassification(question: string, classification: IntentClassification): void {
  console.log(`[Intent Classifier] Question: "${question.substring(0, 60)}..."`);
  console.log(`[Intent Classifier] Intent: ${classification.intent} (${Math.round(classification.confidence * 100)}%)`);
  console.log(`[Intent Classifier] Language: ${classification.language}`);
  console.log(`[Intent Classifier] Filters:`, JSON.stringify(classification.filters));
  console.log(`[Intent Classifier] Tools: ${classification.suggestedTools.join(', ')}`);
  if (classification.reasoning) {
    console.log(`[Intent Classifier] Reasoning: ${classification.reasoning}`);
  }
}
