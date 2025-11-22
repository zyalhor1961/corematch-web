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
    description: 'List invoices (factures) with optional filters. Use for questions about specific invoices, unpaid bills, or invoice listings.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status. Use "unpaid" for overdue invoices.',
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
    description: 'Calculate total amounts for invoices matching filters. Use for questions like "how much did I spend on X" or "total unpaid".',
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
    description: 'Get invoice totals grouped by supplier. Use for supplier spending analysis.',
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
    description: 'Get monthly invoice totals. Use for time-series analysis and trends.',
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
    description: 'List all documents with filters. Use for general document queries.',
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
    description: 'List CV/resume documents. Use for recruitment and candidate queries.',
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
    description: 'Get overview statistics for the workspace. Use for dashboard summaries.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'search_documents',
    description: 'Full-text search across all documents. Use when user asks about specific content in documents.',
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
  }
];
