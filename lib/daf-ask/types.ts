/**
 * Ask DAF - Types and Interfaces
 * Chat-based analytics for DAF (Finance Assistant)
 */

// =============================================================================
// API Response Types
// =============================================================================

export type AskMode = 'analysis' | 'listing' | 'kpi' | 'mixed';

export interface ColumnDefinition {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'currency' | 'percentage';
}

export interface SourceDocument {
  id: string;
  title: string;
  type: string;
  url?: string;
}

export interface DafAskResponse {
  answer: string;
  mode: AskMode;
  rows?: Array<Record<string, any>>;
  columns?: ColumnDefinition[];
  exports?: {
    csv?: string;
    sql?: string;
  };
  sourceDocuments?: SourceDocument[];
  warnings?: string[];
  debug?: {
    toolsCalled: string[];
    duration: number;
    tokensUsed?: number;
  };
}

export interface DafAskRequest {
  question: string;
  language?: 'fr' | 'en' | 'auto';
  context?: {
    filters?: Record<string, any>;
    dateRange?: { from?: string; to?: string };
  };
}

// =============================================================================
// Tool Types
// =============================================================================

export interface InvoiceFilter {
  status?: 'uploaded' | 'extracted' | 'validated' | 'exported' | 'archived' | 'unpaid';
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  dueDateBefore?: string;
  dueDateAfter?: string;
}

export interface DocumentFilter {
  type?: string | string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface CVFilter {
  skills?: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// =============================================================================
// Tool Results
// =============================================================================

export interface InvoiceRow {
  id: string;
  file_name: string;
  fournisseur: string | null;
  montant_ht: number | null;
  montant_ttc: number | null;
  taux_tva: number | null;
  date_document: string | null;
  date_echeance: string | null;
  numero_facture: string | null;
  status: string;
  created_at: string;
}

export interface SupplierSummary {
  supplier: string;
  total_ttc: number;
  total_ht: number;
  invoice_count: number;
  avg_amount: number;
  last_invoice_date: string | null;
}

export interface MonthlySummary {
  month: string;
  year: number;
  total_ttc: number;
  total_ht: number;
  invoice_count: number;
}

export interface DocumentRow {
  id: string;
  file_name: string;
  ai_detected_type: string | null;
  doc_type: string | null;
  status: string;
  page_count: number | null;
  created_at: string;
  key_info: Record<string, any> | null;
}

export interface OverviewStats {
  total_documents: number;
  total_invoices: number;
  total_cvs: number;
  total_contracts: number;
  total_other: number;
  unpaid_invoices: number;
  unpaid_amount: number;
  total_amount_ttc: number;
  suppliers_count: number;
}

// =============================================================================
// Tool Definitions for LLM
// =============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export const DAF_TOOLS: ToolDefinition[] = [
  {
    name: 'list_invoices',
    description: 'LISTE LES FACTURES avec filtres optionnels. UTILISE CE TOOL POUR: "mes factures", "factures non réglées/impayées", "factures de [fournisseur]", "factures du mois/année". Le paramètre status="unpaid" filtre les factures en retard de paiement.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtre par statut. IMPORTANT: Utilise "unpaid" pour les factures non réglées, impayées ou en retard.',
          enum: ['uploaded', 'extracted', 'validated', 'exported', 'archived', 'unpaid']
        },
        supplier: {
          type: 'string',
          description: 'Filter by supplier/vendor name (partial match)'
        },
        dateFrom: {
          type: 'string',
          description: 'Start date for invoice date filter (YYYY-MM-DD)'
        },
        dateTo: {
          type: 'string',
          description: 'End date for invoice date filter (YYYY-MM-DD)'
        },
        minAmount: {
          type: 'number',
          description: 'Minimum amount TTC in euros'
        },
        maxAmount: {
          type: 'number',
          description: 'Maximum amount TTC in euros'
        },
        limit: {
          type: 'number',
          description: 'Max number of results (default 50)'
        }
      }
    }
  },
  {
    name: 'sum_invoices',
    description: 'CALCULE LES TOTAUX des factures. UTILISE CE TOOL POUR: "combien j\'ai dépensé", "total chez [fournisseur]", "montant total en [année]", "total des impayés". Retourne total_ttc, total_ht et nombre de factures.',
    parameters: {
      type: 'object',
      properties: {
        supplier: {
          type: 'string',
          description: 'Filter by supplier name'
        },
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)'
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)'
        },
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['uploaded', 'extracted', 'validated', 'exported', 'archived', 'unpaid']
        },
        groupBy: {
          type: 'string',
          description: 'Group results by field',
          enum: ['supplier', 'month', 'status']
        }
      }
    }
  },
  {
    name: 'invoices_by_supplier',
    description: 'ANALYSE PAR FOURNISSEUR - Totaux groupés par fournisseur. UTILISE CE TOOL POUR: "mes principaux fournisseurs", "dépenses par fournisseur", "top fournisseurs", "qui sont mes plus gros fournisseurs".',
    parameters: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)'
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)'
        },
        minTotal: {
          type: 'number',
          description: 'Minimum total amount to include'
        },
        limit: {
          type: 'number',
          description: 'Max suppliers to return'
        }
      }
    }
  },
  {
    name: 'invoices_by_month',
    description: 'ÉVOLUTION MENSUELLE des factures. UTILISE CE TOOL POUR: "évolution des dépenses", "par mois", "tendance", "historique mensuel", "graphique des dépenses".',
    parameters: {
      type: 'object',
      properties: {
        year: {
          type: 'number',
          description: 'Filter by year (e.g., 2024)'
        },
        supplier: {
          type: 'string',
          description: 'Filter by supplier name'
        },
        months: {
          type: 'number',
          description: 'Number of months to look back (default 12)'
        }
      }
    }
  },
  {
    name: 'list_documents',
    description: 'LISTE TOUS LES DOCUMENTS avec filtres. UTILISE CE TOOL POUR: "mes documents", "documents reçus aujourd\'hui/hier/cette semaine", "tous les documents". Pour les factures spécifiquement, préfère list_invoices.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Document type: invoice, cv, contract, report, other',
          enum: ['invoice', 'cv', 'contract', 'report', 'other']
        },
        status: {
          type: 'string',
          description: 'Document status'
        },
        dateFrom: {
          type: 'string',
          description: 'Start date'
        },
        dateTo: {
          type: 'string',
          description: 'End date'
        },
        search: {
          type: 'string',
          description: 'Text search in document content'
        },
        limit: {
          type: 'number',
          description: 'Max results'
        }
      }
    }
  },
  {
    name: 'list_cvs',
    description: 'LISTE LES CV/CANDIDATURES. UTILISE CE TOOL POUR: "CV reçus", "candidats", "développeur Python", "CV ce mois-ci", "candidatures récentes". Permet de filtrer par compétences et date.',
    parameters: {
      type: 'object',
      properties: {
        skills: {
          type: 'string',
          description: 'Skills to search for (comma-separated)'
        },
        dateFrom: {
          type: 'string',
          description: 'Start date for upload'
        },
        dateTo: {
          type: 'string',
          description: 'End date for upload'
        },
        search: {
          type: 'string',
          description: 'Text search in CV content'
        },
        limit: {
          type: 'number',
          description: 'Max results'
        }
      }
    }
  },
  {
    name: 'get_overview_stats',
    description: 'STATISTIQUES GÉNÉRALES du workspace. UTILISE CE TOOL POUR: "résumé", "vue d\'ensemble", "statistiques", "combien de documents", "overview". Retourne le nombre total de documents, factures, CV, contrats, montants.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'search_documents',
    description: 'RECHERCHE PLEIN TEXTE dans le contenu des documents. UTILISE CE TOOL POUR: recherche par mots-clés spécifiques, "documents contenant X", "cherche Y dans les factures". Pour des questions conceptuelles, préfère semantic_search.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        type: {
          type: 'string',
          description: 'Filter by document type'
        },
        limit: {
          type: 'number',
          description: 'Max results'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'semantic_search',
    description: 'RECHERCHE SÉMANTIQUE IA avec embeddings. UTILISE CE TOOL POUR: questions conceptuelles, "documents concernant les problèmes de paiement", "factures liées à la maintenance", recherche de similarité. Plus efficace que search_documents pour des questions en langage naturel.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query describing what to find'
        },
        type: {
          type: 'string',
          description: 'Filter by document type (invoice, cv, contract, etc.)',
          enum: ['invoice', 'cv', 'contract', 'report', 'other']
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10)'
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity threshold 0-1 (default 0.6)'
        }
      },
      required: ['query']
    }
  },
  // =============================================================================
  // ERP Tools (Core ERP Integration)
  // =============================================================================
  {
    name: 'erp_list_clients',
    description: 'LISTE LES CLIENTS de l\'entreprise. UTILISE CE TOOL POUR: "mes clients", "liste des clients", "qui sont mes clients", "clients par CA". Retourne nom, email, total facturé, impayés.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Recherche par nom ou email' },
        category: { type: 'string', description: 'Catégorie de client' },
        orderBy: { type: 'string', description: 'Trier par', enum: ['name', 'total_invoiced', 'created_at'] },
        limit: { type: 'number', description: 'Nombre max de résultats' }
      }
    }
  },
  {
    name: 'erp_list_client_invoices',
    description: 'LISTE LES FACTURES CLIENTS (ventes). UTILISE CE TOOL POUR: "factures émises", "mes ventes", "qui me doit de l\'argent", "factures en retard".',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Statut', enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'] },
        client_id: { type: 'string', description: 'ID du client' },
        dateFrom: { type: 'string', description: 'Date début (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'Date fin (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  },
  {
    name: 'erp_sum_client_invoices',
    description: 'CALCULE LE TOTAL des factures clients. UTILISE CE TOOL POUR: "chiffre d\'affaires", "CA du mois", "total facturé", "revenus année".',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Statut', enum: ['all', 'paid', 'unpaid', 'overdue'] },
        dateFrom: { type: 'string', description: 'Date début' },
        dateTo: { type: 'string', description: 'Date fin' },
        groupBy: { type: 'string', description: 'Grouper par', enum: ['client', 'month', 'status'] }
      }
    }
  },
  {
    name: 'erp_list_suppliers',
    description: 'LISTE LES FOURNISSEURS. UTILISE CE TOOL POUR: "mes fournisseurs", "à qui j\'achète".',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Recherche par nom' },
        orderBy: { type: 'string', description: 'Trier par', enum: ['name', 'total_purchased', 'created_at'] },
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  },
  {
    name: 'erp_list_supplier_invoices',
    description: 'LISTE LES FACTURES FOURNISSEURS (achats). UTILISE CE TOOL POUR: "factures à payer", "mes achats", "ce que je dois".',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Statut', enum: ['unpaid', 'partial', 'paid', 'overdue'] },
        supplier_id: { type: 'string', description: 'ID fournisseur' },
        dateFrom: { type: 'string', description: 'Date début' },
        dateTo: { type: 'string', description: 'Date fin' },
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  },
  {
    name: 'erp_list_expenses',
    description: 'LISTE LES DÉPENSES. UTILISE CE TOOL POUR: "dépenses", "notes de frais", "où part mon argent".',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Catégorie' },
        dateFrom: { type: 'string', description: 'Date début' },
        dateTo: { type: 'string', description: 'Date fin' },
        status: { type: 'string', description: 'Statut', enum: ['pending', 'validated', 'rejected'] },
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  },
  {
    name: 'erp_sum_expenses',
    description: 'CALCULE LE TOTAL des dépenses. UTILISE CE TOOL POUR: "total dépenses", "budget utilisé".',
    parameters: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Date début' },
        dateTo: { type: 'string', description: 'Date fin' },
        groupBy: { type: 'string', description: 'Grouper par', enum: ['category', 'month', 'supplier'] }
      }
    }
  },
  {
    name: 'erp_get_kpis',
    description: 'OBTIENT LES KPIs FINANCIERS. UTILISE CE TOOL POUR: "tableau de bord", "KPIs", "situation financière", "résumé ERP".',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'erp_get_receivables',
    description: 'OBTIENT LES CRÉANCES CLIENTS. UTILISE CE TOOL POUR: "créances", "qui me doit", "impayés clients".',
    parameters: {
      type: 'object',
      properties: {
        includeOverdue: { type: 'boolean', description: 'Seulement les retards' }
      }
    }
  },
  {
    name: 'erp_get_payables',
    description: 'OBTIENT LES DETTES FOURNISSEURS. UTILISE CE TOOL POUR: "dettes", "à payer", "factures en retard fournisseurs".',
    parameters: {
      type: 'object',
      properties: {
        includeOverdue: { type: 'boolean', description: 'Seulement les retards' }
      }
    }
  },
  {
    name: 'erp_get_cashflow',
    description: 'PRÉVISION DE TRÉSORERIE. UTILISE CE TOOL POUR: "cashflow", "trésorerie", "prévision 30 jours".',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Nombre de jours (default 30)' }
      }
    }
  },
  {
    name: 'erp_top_clients',
    description: 'TOP CLIENTS par CA. UTILISE CE TOOL POUR: "meilleurs clients", "top clients".',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre (default 10)' },
        dateFrom: { type: 'string', description: 'Période début' },
        dateTo: { type: 'string', description: 'Période fin' }
      }
    }
  },
  {
    name: 'erp_top_suppliers',
    description: 'TOP FOURNISSEURS par volume d\'achats. UTILISE CE TOOL POUR: "principaux fournisseurs", "top fournisseurs".',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre (default 10)' },
        dateFrom: { type: 'string', description: 'Période début' },
        dateTo: { type: 'string', description: 'Période fin' }
      }
    }
  },
  // =============================================================================
  // Bank Reconciliation & Lettrage Tools
  // =============================================================================
  {
    name: 'erp_list_bank_transactions',
    description: 'LISTE LES TRANSACTIONS BANCAIRES. UTILISE CE TOOL POUR: "transactions banque", "relevé bancaire", "mouvements bancaires", "opérations bancaires".',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Statut de réconciliation', enum: ['unmatched', 'suggested', 'matched', 'ignored', 'all'] },
        direction: { type: 'string', description: 'Sens du mouvement', enum: ['credit', 'debit', 'all'] },
        dateFrom: { type: 'string', description: 'Date début' },
        dateTo: { type: 'string', description: 'Date fin' },
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  },
  {
    name: 'erp_get_reconciliation_stats',
    description: 'STATISTIQUES DE RAPPROCHEMENT BANCAIRE. UTILISE CE TOOL POUR: "état du rapprochement", "combien de transactions à rapprocher", "taux de réconciliation".',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'erp_unmatched_transactions',
    description: 'TRANSACTIONS BANCAIRES NON RAPPROCHÉES. UTILISE CE TOOL POUR: "transactions à rapprocher", "non rapprochées", "rapprochement en attente".',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  },
  {
    name: 'erp_get_lettrage_stats',
    description: 'STATISTIQUES DE LETTRAGE COMPTABLE (411/401). UTILISE CE TOOL POUR: "état du lettrage", "écritures non lettrées", "soldes clients/fournisseurs ouverts".',
    parameters: {
      type: 'object',
      properties: {
        account_type: { type: 'string', description: 'client (411) ou supplier (401)', enum: ['client', 'supplier'] }
      }
    }
  },
  {
    name: 'erp_unlettred_entries',
    description: 'ÉCRITURES COMPTABLES NON LETTRÉES. UTILISE CE TOOL POUR: "écritures à lettrer", "soldes ouverts 411/401", "compte client/fournisseur non soldé".',
    parameters: {
      type: 'object',
      properties: {
        account_type: { type: 'string', description: 'client (411) ou supplier (401)', enum: ['client', 'supplier'] },
        limit: { type: 'number', description: 'Nombre max' }
      }
    }
  }
];
