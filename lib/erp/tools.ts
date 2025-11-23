/**
 * ERP Tools for Ask DAF
 * Database tools for querying ERP data through the AI assistant
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ColumnDefinition } from '@/lib/daf-ask/types';

// =============================================================================
// Tool Definitions for LLM
// =============================================================================

export interface ERPToolDefinition {
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

export const ERP_TOOLS: ERPToolDefinition[] = [
  {
    name: 'erp_list_clients',
    description: 'LISTE LES CLIENTS de l\'entreprise. Utilise pour: "mes clients", "liste des clients", "qui sont mes clients", "clients par chiffre d\'affaires".',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Recherche par nom ou email',
        },
        category: {
          type: 'string',
          description: 'Catégorie de client',
        },
        orderBy: {
          type: 'string',
          description: 'Trier par: name, total_invoiced, created_at',
          enum: ['name', 'total_invoiced', 'created_at'],
        },
        limit: {
          type: 'number',
          description: 'Nombre max de résultats',
        },
      },
    },
  },
  {
    name: 'erp_list_client_invoices',
    description: 'LISTE LES FACTURES CLIENTS (ventes). Utilise pour: "factures émises", "factures clients", "mes ventes", "qui me doit de l\'argent".',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Statut de la facture',
          enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
        },
        client_id: {
          type: 'string',
          description: 'ID du client',
        },
        dateFrom: {
          type: 'string',
          description: 'Date de début (YYYY-MM-DD)',
        },
        dateTo: {
          type: 'string',
          description: 'Date de fin (YYYY-MM-DD)',
        },
        limit: {
          type: 'number',
          description: 'Nombre max de résultats',
        },
      },
    },
  },
  {
    name: 'erp_sum_client_invoices',
    description: 'CALCULE LE TOTAL des factures clients. Utilise pour: "chiffre d\'affaires", "total facturé", "revenus du mois/année".',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Statut des factures',
          enum: ['all', 'paid', 'unpaid', 'overdue'],
        },
        dateFrom: {
          type: 'string',
          description: 'Date de début (YYYY-MM-DD)',
        },
        dateTo: {
          type: 'string',
          description: 'Date de fin (YYYY-MM-DD)',
        },
        groupBy: {
          type: 'string',
          description: 'Grouper par',
          enum: ['client', 'month', 'status'],
        },
      },
    },
  },
  {
    name: 'erp_list_suppliers',
    description: 'LISTE LES FOURNISSEURS. Utilise pour: "mes fournisseurs", "liste des fournisseurs", "à qui j\'achète".',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Recherche par nom',
        },
        category: {
          type: 'string',
          description: 'Catégorie',
        },
        orderBy: {
          type: 'string',
          description: 'Trier par',
          enum: ['name', 'total_purchased', 'created_at'],
        },
        limit: {
          type: 'number',
          description: 'Nombre max',
        },
      },
    },
  },
  {
    name: 'erp_list_supplier_invoices',
    description: 'LISTE LES FACTURES FOURNISSEURS (achats). Utilise pour: "factures à payer", "factures fournisseurs", "mes achats", "ce que je dois".',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Statut',
          enum: ['unpaid', 'partial', 'paid', 'overdue'],
        },
        supplier_id: {
          type: 'string',
          description: 'ID du fournisseur',
        },
        dateFrom: {
          type: 'string',
          description: 'Date de début',
        },
        dateTo: {
          type: 'string',
          description: 'Date de fin',
        },
        limit: {
          type: 'number',
          description: 'Nombre max',
        },
      },
    },
  },
  {
    name: 'erp_list_expenses',
    description: 'LISTE LES DÉPENSES. Utilise pour: "dépenses", "notes de frais", "dépenses par catégorie", "où part mon argent".',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Catégorie de dépense',
        },
        dateFrom: {
          type: 'string',
          description: 'Date de début',
        },
        dateTo: {
          type: 'string',
          description: 'Date de fin',
        },
        status: {
          type: 'string',
          description: 'Statut',
          enum: ['pending', 'validated', 'rejected'],
        },
        limit: {
          type: 'number',
          description: 'Nombre max',
        },
      },
    },
  },
  {
    name: 'erp_sum_expenses',
    description: 'CALCULE LE TOTAL des dépenses. Utilise pour: "total dépenses", "budget utilisé", "dépenses du mois".',
    parameters: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'Date de début',
        },
        dateTo: {
          type: 'string',
          description: 'Date de fin',
        },
        groupBy: {
          type: 'string',
          description: 'Grouper par',
          enum: ['category', 'month', 'supplier'],
        },
      },
    },
  },
  {
    name: 'erp_get_kpis',
    description: 'OBTIENT LES KPIs FINANCIERS. Utilise pour: "tableau de bord", "KPIs", "situation financière", "cashflow", "résumé financier".',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'erp_get_receivables',
    description: 'OBTIENT LES CRÉANCES CLIENTS. Utilise pour: "créances", "qui me doit", "impayés clients", "sommes à recevoir".',
    parameters: {
      type: 'object',
      properties: {
        includeOverdue: {
          type: 'boolean',
          description: 'Inclure seulement les retards',
        },
      },
    },
  },
  {
    name: 'erp_get_payables',
    description: 'OBTIENT LES DETTES FOURNISSEURS. Utilise pour: "dettes", "à payer", "factures en retard", "sommes à payer".',
    parameters: {
      type: 'object',
      properties: {
        includeOverdue: {
          type: 'boolean',
          description: 'Inclure seulement les retards',
        },
      },
    },
  },
  {
    name: 'erp_get_cashflow',
    description: 'PRÉVISION DE TRÉSORERIE. Utilise pour: "cashflow", "trésorerie", "prévision", "flux de trésorerie 30 jours".',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Nombre de jours de prévision (default 30)',
        },
      },
    },
  },
  {
    name: 'erp_top_clients',
    description: 'TOP CLIENTS par chiffre d\'affaires. Utilise pour: "meilleurs clients", "top clients", "plus gros clients".',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Nombre de clients (default 10)',
        },
        dateFrom: {
          type: 'string',
          description: 'Période début',
        },
        dateTo: {
          type: 'string',
          description: 'Période fin',
        },
      },
    },
  },
  {
    name: 'erp_top_suppliers',
    description: 'TOP FOURNISSEURS par volume d\'achats. Utilise pour: "principaux fournisseurs", "top fournisseurs", "plus gros fournisseurs".',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Nombre de fournisseurs (default 10)',
        },
        dateFrom: {
          type: 'string',
          description: 'Période début',
        },
        dateTo: {
          type: 'string',
          description: 'Période fin',
        },
      },
    },
  },
  // Bank Reconciliation Tools
  {
    name: 'erp_list_bank_transactions',
    description: 'LISTE LES TRANSACTIONS BANCAIRES. Utilise pour: "transactions banque", "mouvements bancaires", "relevé bancaire", "opérations bancaires".',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Statut de réconciliation',
          enum: ['unmatched', 'suggested', 'matched', 'ignored', 'all'],
        },
        direction: {
          type: 'string',
          description: 'Type de mouvement',
          enum: ['credit', 'debit', 'all'],
        },
        dateFrom: {
          type: 'string',
          description: 'Date de début',
        },
        dateTo: {
          type: 'string',
          description: 'Date de fin',
        },
        limit: {
          type: 'number',
          description: 'Nombre max',
        },
      },
    },
  },
  {
    name: 'erp_get_reconciliation_stats',
    description: 'STATISTIQUES DE RAPPROCHEMENT BANCAIRE. Utilise pour: "état rapprochement", "transactions non rapprochées", "stats banque".',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'erp_unmatched_transactions',
    description: 'TRANSACTIONS BANCAIRES NON RAPPROCHÉES. Utilise pour: "transactions à rapprocher", "non rapprochées", "rapprochement en attente".',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Nombre max',
        },
      },
    },
  },
  // Lettrage Tools
  {
    name: 'erp_get_lettrage_stats',
    description: 'STATISTIQUES DE LETTRAGE COMPTABLE. Utilise pour: "état lettrage", "écritures non lettrées", "solde clients/fournisseurs 411/401".',
    parameters: {
      type: 'object',
      properties: {
        account_type: {
          type: 'string',
          description: 'Type de compte',
          enum: ['client', 'supplier'],
        },
      },
    },
  },
  {
    name: 'erp_unlettred_entries',
    description: 'ÉCRITURES COMPTABLES NON LETTRÉES. Utilise pour: "écritures à lettrer", "soldes ouverts", "compte 411 ou 401 non soldé".',
    parameters: {
      type: 'object',
      properties: {
        account_type: {
          type: 'string',
          description: 'client (411) ou supplier (401)',
          enum: ['client', 'supplier'],
        },
        limit: {
          type: 'number',
          description: 'Nombre max',
        },
      },
    },
  },
];

// =============================================================================
// Tool Execution
// =============================================================================

export async function executeERPTool(
  toolName: string,
  params: Record<string, any>,
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  rows?: Record<string, any>[];
  columns?: ColumnDefinition[];
  stats?: Record<string, any>;
  summary?: string;
}> {
  switch (toolName) {
    case 'erp_list_clients':
      return listClients(supabase, orgId, params);

    case 'erp_list_client_invoices':
      return listClientInvoices(supabase, orgId, params);

    case 'erp_sum_client_invoices':
      return sumClientInvoices(supabase, orgId, params);

    case 'erp_list_suppliers':
      return listSuppliers(supabase, orgId, params);

    case 'erp_list_supplier_invoices':
      return listSupplierInvoices(supabase, orgId, params);

    case 'erp_list_expenses':
      return listExpenses(supabase, orgId, params);

    case 'erp_sum_expenses':
      return sumExpenses(supabase, orgId, params);

    case 'erp_get_kpis':
      return getKPIs(supabase, orgId);

    case 'erp_get_receivables':
      return getReceivables(supabase, orgId, params);

    case 'erp_get_payables':
      return getPayables(supabase, orgId, params);

    case 'erp_get_cashflow':
      return getCashflow(supabase, orgId, params);

    case 'erp_top_clients':
      return topClients(supabase, orgId, params);

    case 'erp_top_suppliers':
      return topSuppliers(supabase, orgId, params);

    // Bank Reconciliation Tools
    case 'erp_list_bank_transactions':
      return listBankTransactions(supabase, orgId, params);

    case 'erp_get_reconciliation_stats':
      return getReconciliationStats(supabase, orgId);

    case 'erp_unmatched_transactions':
      return unmatchedTransactions(supabase, orgId, params);

    // Lettrage Tools
    case 'erp_get_lettrage_stats':
      return getLettrageStats(supabase, orgId, params);

    case 'erp_unlettred_entries':
      return unlettredEntries(supabase, orgId, params);

    default:
      throw new Error(`Unknown ERP tool: ${toolName}`);
  }
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function listClients(
  supabase: SupabaseClient,
  orgId: string,
  params: { search?: string; category?: string; orderBy?: string; limit?: number }
) {
  let query = supabase
    .from('erp_clients')
    .select('id, name, email, company_name, total_invoiced, total_outstanding, invoice_count, created_at')
    .eq('org_id', orgId)
    .limit(params.limit || 20);

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,company_name.ilike.%${params.search}%`);
  }

  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.orderBy === 'total_invoiced') {
    query = query.order('total_invoiced', { ascending: false });
  } else if (params.orderBy === 'name') {
    query = query.order('name');
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) throw error;

  return {
    rows: data || [],
    columns: [
      { key: 'name', label: 'Client', type: 'string' },
      { key: 'company_name', label: 'Entreprise', type: 'string' },
      { key: 'email', label: 'Email', type: 'string' },
      { key: 'total_invoiced', label: 'Total facturé', type: 'currency' },
      { key: 'total_outstanding', label: 'Impayés', type: 'currency' },
      { key: 'invoice_count', label: 'Factures', type: 'number' },
    ] as ColumnDefinition[],
  };
}

async function listClientInvoices(
  supabase: SupabaseClient,
  orgId: string,
  params: { status?: string; client_id?: string; dateFrom?: string; dateTo?: string; limit?: number }
) {
  let query = supabase
    .from('erp_invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, status,
      total_ttc, paid_amount, balance_due,
      client:erp_clients(name, company_name)
    `)
    .eq('org_id', orgId)
    .order('invoice_date', { ascending: false })
    .limit(params.limit || 50);

  if (params.status) {
    if (params.status === 'unpaid') {
      query = query.in('status', ['sent', 'partial', 'overdue']);
    } else {
      query = query.eq('status', params.status);
    }
  }

  if (params.client_id) {
    query = query.eq('client_id', params.client_id);
  }

  if (params.dateFrom) {
    query = query.gte('invoice_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('invoice_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data || []).map(inv => ({
    ...inv,
    client_name: (inv.client as any)?.name || (inv.client as any)?.company_name || 'N/A',
  }));

  return {
    rows,
    columns: [
      { key: 'invoice_number', label: 'N° Facture', type: 'string' },
      { key: 'client_name', label: 'Client', type: 'string' },
      { key: 'invoice_date', label: 'Date', type: 'date' },
      { key: 'due_date', label: 'Échéance', type: 'date' },
      { key: 'total_ttc', label: 'Montant TTC', type: 'currency' },
      { key: 'paid_amount', label: 'Payé', type: 'currency' },
      { key: 'balance_due', label: 'Reste dû', type: 'currency' },
      { key: 'status', label: 'Statut', type: 'string' },
    ] as ColumnDefinition[],
  };
}

async function sumClientInvoices(
  supabase: SupabaseClient,
  orgId: string,
  params: { status?: string; dateFrom?: string; dateTo?: string; groupBy?: string }
) {
  let query = supabase
    .from('erp_invoices')
    .select('total_ht, total_vat, total_ttc, paid_amount, balance_due, invoice_date, status, client_id')
    .eq('org_id', orgId)
    .neq('status', 'cancelled');

  if (params.status === 'paid') {
    query = query.eq('status', 'paid');
  } else if (params.status === 'unpaid') {
    query = query.in('status', ['sent', 'partial', 'overdue']);
  } else if (params.status === 'overdue') {
    query = query.eq('status', 'overdue');
  }

  if (params.dateFrom) {
    query = query.gte('invoice_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('invoice_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  const invoices = data || [];

  const stats = {
    total_ht: invoices.reduce((sum, inv) => sum + (inv.total_ht || 0), 0),
    total_vat: invoices.reduce((sum, inv) => sum + (inv.total_vat || 0), 0),
    total_ttc: invoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0),
    total_paid: invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0),
    total_outstanding: invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0),
    invoice_count: invoices.length,
  };

  return {
    stats,
    columns: [
      { key: 'total_ht', label: 'Total HT', type: 'currency' },
      { key: 'total_vat', label: 'Total TVA', type: 'currency' },
      { key: 'total_ttc', label: 'Total TTC', type: 'currency' },
      { key: 'total_paid', label: 'Total encaissé', type: 'currency' },
      { key: 'total_outstanding', label: 'Reste à encaisser', type: 'currency' },
      { key: 'invoice_count', label: 'Nombre de factures', type: 'number' },
    ] as ColumnDefinition[],
  };
}

async function listSuppliers(
  supabase: SupabaseClient,
  orgId: string,
  params: { search?: string; category?: string; orderBy?: string; limit?: number }
) {
  let query = supabase
    .from('erp_suppliers')
    .select('id, name, email, total_purchased, total_outstanding, invoice_count, created_at')
    .eq('org_id', orgId)
    .limit(params.limit || 20);

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`);
  }

  if (params.orderBy === 'total_purchased') {
    query = query.order('total_purchased', { ascending: false });
  } else {
    query = query.order('name');
  }

  const { data, error } = await query;

  if (error) throw error;

  return {
    rows: data || [],
    columns: [
      { key: 'name', label: 'Fournisseur', type: 'string' },
      { key: 'email', label: 'Email', type: 'string' },
      { key: 'total_purchased', label: 'Total acheté', type: 'currency' },
      { key: 'total_outstanding', label: 'À payer', type: 'currency' },
      { key: 'invoice_count', label: 'Factures', type: 'number' },
    ] as ColumnDefinition[],
  };
}

async function listSupplierInvoices(
  supabase: SupabaseClient,
  orgId: string,
  params: { status?: string; supplier_id?: string; dateFrom?: string; dateTo?: string; limit?: number }
) {
  let query = supabase
    .from('erp_supplier_invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, status,
      total_ttc, paid_amount, balance_due,
      supplier:erp_suppliers(name)
    `)
    .eq('org_id', orgId)
    .order('invoice_date', { ascending: false })
    .limit(params.limit || 50);

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.supplier_id) {
    query = query.eq('supplier_id', params.supplier_id);
  }

  if (params.dateFrom) {
    query = query.gte('invoice_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('invoice_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data || []).map(inv => ({
    ...inv,
    supplier_name: (inv.supplier as any)?.name || 'N/A',
  }));

  return {
    rows,
    columns: [
      { key: 'invoice_number', label: 'N° Facture', type: 'string' },
      { key: 'supplier_name', label: 'Fournisseur', type: 'string' },
      { key: 'invoice_date', label: 'Date', type: 'date' },
      { key: 'due_date', label: 'Échéance', type: 'date' },
      { key: 'total_ttc', label: 'Montant TTC', type: 'currency' },
      { key: 'balance_due', label: 'Reste dû', type: 'currency' },
      { key: 'status', label: 'Statut', type: 'string' },
    ] as ColumnDefinition[],
  };
}

async function listExpenses(
  supabase: SupabaseClient,
  orgId: string,
  params: { category?: string; dateFrom?: string; dateTo?: string; status?: string; limit?: number }
) {
  let query = supabase
    .from('erp_expenses')
    .select('id, description, amount, expense_date, category, payment_method, status')
    .eq('org_id', orgId)
    .order('expense_date', { ascending: false })
    .limit(params.limit || 50);

  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.dateFrom) {
    query = query.gte('expense_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('expense_date', params.dateTo);
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;

  if (error) throw error;

  return {
    rows: data || [],
    columns: [
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'amount', label: 'Montant', type: 'currency' },
      { key: 'expense_date', label: 'Date', type: 'date' },
      { key: 'category', label: 'Catégorie', type: 'string' },
      { key: 'payment_method', label: 'Paiement', type: 'string' },
      { key: 'status', label: 'Statut', type: 'string' },
    ] as ColumnDefinition[],
  };
}

async function sumExpenses(
  supabase: SupabaseClient,
  orgId: string,
  params: { dateFrom?: string; dateTo?: string; groupBy?: string }
) {
  let query = supabase
    .from('erp_expenses')
    .select('amount, category, expense_date')
    .eq('org_id', orgId)
    .eq('status', 'validated');

  if (params.dateFrom) {
    query = query.gte('expense_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('expense_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  const expenses = data || [];
  const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Group by category if requested
  if (params.groupBy === 'category') {
    const byCategory: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Autre';
      byCategory[cat] = (byCategory[cat] || 0) + (exp.amount || 0);
    });

    const rows = Object.entries(byCategory).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    return {
      rows,
      stats: { total: totalAmount, count: expenses.length },
      columns: [
        { key: 'category', label: 'Catégorie', type: 'string' },
        { key: 'amount', label: 'Montant', type: 'currency' },
        { key: 'percentage', label: '%', type: 'percentage' },
      ] as ColumnDefinition[],
    };
  }

  return {
    stats: {
      total: totalAmount,
      count: expenses.length,
      average: expenses.length > 0 ? totalAmount / expenses.length : 0,
    },
    columns: [
      { key: 'total', label: 'Total dépenses', type: 'currency' },
      { key: 'count', label: 'Nombre', type: 'number' },
      { key: 'average', label: 'Moyenne', type: 'currency' },
    ] as ColumnDefinition[],
  };
}

async function getKPIs(supabase: SupabaseClient, orgId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

  // Revenue
  const { data: invoices } = await supabase
    .from('erp_invoices')
    .select('total_ttc, balance_due, status')
    .eq('org_id', orgId)
    .gte('invoice_date', startOfYear)
    .neq('status', 'cancelled');

  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;
  const totalReceivables = invoices?.filter(inv => ['sent', 'partial', 'overdue'].includes(inv.status))
    .reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

  // Expenses
  const { data: expenses } = await supabase
    .from('erp_expenses')
    .select('amount')
    .eq('org_id', orgId)
    .gte('expense_date', startOfYear)
    .eq('status', 'validated');

  const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

  // Payables
  const { data: supplierInvoices } = await supabase
    .from('erp_supplier_invoices')
    .select('total_ttc, balance_due, status')
    .eq('org_id', orgId)
    .in('status', ['unpaid', 'partial', 'overdue']);

  const totalPayables = supplierInvoices?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

  return {
    stats: {
      revenue_ytd: totalRevenue,
      expenses_ytd: totalExpenses,
      profit_ytd: totalRevenue - totalExpenses,
      receivables: totalReceivables,
      payables: totalPayables,
      cashflow_estimate: totalReceivables - totalPayables,
    },
    columns: [
      { key: 'revenue_ytd', label: 'CA Année', type: 'currency' },
      { key: 'expenses_ytd', label: 'Dépenses Année', type: 'currency' },
      { key: 'profit_ytd', label: 'Résultat Année', type: 'currency' },
      { key: 'receivables', label: 'Créances clients', type: 'currency' },
      { key: 'payables', label: 'Dettes fournisseurs', type: 'currency' },
      { key: 'cashflow_estimate', label: 'Trésorerie estimée', type: 'currency' },
    ] as ColumnDefinition[],
  };
}

async function getReceivables(
  supabase: SupabaseClient,
  orgId: string,
  params: { includeOverdue?: boolean }
) {
  let query = supabase
    .from('erp_invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, balance_due, status,
      client:erp_clients(name, company_name)
    `)
    .eq('org_id', orgId)
    .in('status', ['sent', 'partial', 'overdue'])
    .gt('balance_due', 0)
    .order('due_date');

  if (params.includeOverdue) {
    query = query.eq('status', 'overdue');
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data || []).map(inv => ({
    ...inv,
    client_name: (inv.client as any)?.name || (inv.client as any)?.company_name || 'N/A',
    days_overdue: inv.status === 'overdue'
      ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));

  const total = rows.reduce((sum, r) => sum + (r.balance_due || 0), 0);

  return {
    rows,
    stats: { total, count: rows.length },
    columns: [
      { key: 'invoice_number', label: 'Facture', type: 'string' },
      { key: 'client_name', label: 'Client', type: 'string' },
      { key: 'due_date', label: 'Échéance', type: 'date' },
      { key: 'balance_due', label: 'Montant dû', type: 'currency' },
      { key: 'days_overdue', label: 'Jours retard', type: 'number' },
    ] as ColumnDefinition[],
  };
}

async function getPayables(
  supabase: SupabaseClient,
  orgId: string,
  params: { includeOverdue?: boolean }
) {
  let query = supabase
    .from('erp_supplier_invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, balance_due, status,
      supplier:erp_suppliers(name)
    `)
    .eq('org_id', orgId)
    .in('status', ['unpaid', 'partial', 'overdue'])
    .gt('balance_due', 0)
    .order('due_date');

  if (params.includeOverdue) {
    query = query.eq('status', 'overdue');
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data || []).map(inv => ({
    ...inv,
    supplier_name: (inv.supplier as any)?.name || 'N/A',
  }));

  const total = rows.reduce((sum, r) => sum + (r.balance_due || 0), 0);

  return {
    rows,
    stats: { total, count: rows.length },
    columns: [
      { key: 'invoice_number', label: 'Facture', type: 'string' },
      { key: 'supplier_name', label: 'Fournisseur', type: 'string' },
      { key: 'due_date', label: 'Échéance', type: 'date' },
      { key: 'balance_due', label: 'Montant dû', type: 'currency' },
    ] as ColumnDefinition[],
  };
}

async function getCashflow(
  supabase: SupabaseClient,
  orgId: string,
  params: { days?: number }
) {
  const days = params.days || 30;
  const today = new Date();
  const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  // Expected inflows (receivables due within period)
  const { data: inflows } = await supabase
    .from('erp_invoices')
    .select('due_date, balance_due')
    .eq('org_id', orgId)
    .in('status', ['sent', 'partial', 'overdue'])
    .gt('balance_due', 0)
    .lte('due_date', endDate.toISOString().split('T')[0]);

  // Expected outflows (payables due within period)
  const { data: outflows } = await supabase
    .from('erp_supplier_invoices')
    .select('due_date, balance_due')
    .eq('org_id', orgId)
    .in('status', ['unpaid', 'partial', 'overdue'])
    .gt('balance_due', 0)
    .lte('due_date', endDate.toISOString().split('T')[0]);

  const totalInflows = inflows?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
  const totalOutflows = outflows?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

  return {
    stats: {
      period_days: days,
      expected_inflows: totalInflows,
      expected_outflows: totalOutflows,
      net_cashflow: totalInflows - totalOutflows,
      inflow_count: inflows?.length || 0,
      outflow_count: outflows?.length || 0,
    },
    columns: [
      { key: 'expected_inflows', label: 'Encaissements prévus', type: 'currency' },
      { key: 'expected_outflows', label: 'Décaissements prévus', type: 'currency' },
      { key: 'net_cashflow', label: 'Flux net', type: 'currency' },
    ] as ColumnDefinition[],
  };
}

async function topClients(
  supabase: SupabaseClient,
  orgId: string,
  params: { limit?: number; dateFrom?: string; dateTo?: string }
) {
  const { data, error } = await supabase
    .from('erp_clients')
    .select('id, name, company_name, total_invoiced, invoice_count')
    .eq('org_id', orgId)
    .gt('total_invoiced', 0)
    .order('total_invoiced', { ascending: false })
    .limit(params.limit || 10);

  if (error) throw error;

  const rows = (data || []).map(c => ({
    name: c.name,
    company_name: c.company_name,
    total_invoiced: c.total_invoiced,
    invoice_count: c.invoice_count,
  }));

  const total = rows.reduce((sum, r) => sum + (r.total_invoiced || 0), 0);

  return {
    rows: rows.map(r => ({
      ...r,
      percentage: total > 0 ? Math.round((r.total_invoiced / total) * 100) : 0,
    })),
    stats: { total },
    columns: [
      { key: 'name', label: 'Client', type: 'string' },
      { key: 'company_name', label: 'Entreprise', type: 'string' },
      { key: 'total_invoiced', label: 'CA', type: 'currency' },
      { key: 'percentage', label: '%', type: 'percentage' },
      { key: 'invoice_count', label: 'Factures', type: 'number' },
    ] as ColumnDefinition[],
  };
}

async function topSuppliers(
  supabase: SupabaseClient,
  orgId: string,
  params: { limit?: number; dateFrom?: string; dateTo?: string }
) {
  const { data, error } = await supabase
    .from('erp_suppliers')
    .select('id, name, total_purchased, invoice_count')
    .eq('org_id', orgId)
    .gt('total_purchased', 0)
    .order('total_purchased', { ascending: false })
    .limit(params.limit || 10);

  if (error) throw error;

  const rows = (data || []).map(s => ({
    name: s.name,
    total_purchased: s.total_purchased,
    invoice_count: s.invoice_count,
  }));

  const total = rows.reduce((sum, r) => sum + (r.total_purchased || 0), 0);

  return {
    rows: rows.map(r => ({
      ...r,
      percentage: total > 0 ? Math.round((r.total_purchased / total) * 100) : 0,
    })),
    stats: { total },
    columns: [
      { key: 'name', label: 'Fournisseur', type: 'string' },
      { key: 'total_purchased', label: 'Total achats', type: 'currency' },
      { key: 'percentage', label: '%', type: 'percentage' },
      { key: 'invoice_count', label: 'Factures', type: 'number' },
    ] as ColumnDefinition[],
  };
}

// =============================================================================
// Bank Reconciliation Tools
// =============================================================================

async function listBankTransactions(
  supabase: SupabaseClient,
  orgId: string,
  params: { status?: string; direction?: string; dateFrom?: string; dateTo?: string; limit?: number }
) {
  let query = supabase
    .from('erp_bank_transactions')
    .select(`
      id, operation_date, amount, direction, label_raw, counterparty_name,
      reconciliation_status, reconciliation_score,
      bank_account:erp_bank_accounts(label, bank_name)
    `)
    .eq('org_id', orgId)
    .order('operation_date', { ascending: false })
    .limit(params.limit || 50);

  if (params.status && params.status !== 'all') {
    query = query.eq('reconciliation_status', params.status);
  }

  if (params.direction && params.direction !== 'all') {
    query = query.eq('direction', params.direction);
  }

  if (params.dateFrom) {
    query = query.gte('operation_date', params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte('operation_date', params.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data || []).map(tx => ({
    ...tx,
    bank_account_label: (tx.bank_account as any)?.label || 'N/A',
    amount_signed: tx.direction === 'debit' ? -tx.amount : tx.amount,
  }));

  return {
    rows,
    columns: [
      { key: 'operation_date', label: 'Date', type: 'date' },
      { key: 'label_raw', label: 'Libellé', type: 'string' },
      { key: 'counterparty_name', label: 'Tiers', type: 'string' },
      { key: 'amount_signed', label: 'Montant', type: 'currency' },
      { key: 'direction', label: 'Sens', type: 'string' },
      { key: 'reconciliation_status', label: 'Rapprochement', type: 'string' },
      { key: 'bank_account_label', label: 'Compte', type: 'string' },
    ] as ColumnDefinition[],
  };
}

async function getReconciliationStats(supabase: SupabaseClient, orgId: string) {
  // Get counts by status
  const { data: transactions } = await supabase
    .from('erp_bank_transactions')
    .select('reconciliation_status, amount, direction')
    .eq('org_id', orgId);

  const txs = transactions || [];

  const stats = {
    total_transactions: txs.length,
    unmatched: txs.filter(tx => tx.reconciliation_status === 'unmatched').length,
    suggested: txs.filter(tx => tx.reconciliation_status === 'suggested').length,
    matched: txs.filter(tx => tx.reconciliation_status === 'matched').length,
    ignored: txs.filter(tx => tx.reconciliation_status === 'ignored').length,
    total_credits: txs.filter(tx => tx.direction === 'credit').reduce((sum, tx) => sum + tx.amount, 0),
    total_debits: txs.filter(tx => tx.direction === 'debit').reduce((sum, tx) => sum + tx.amount, 0),
    unmatched_credits: txs.filter(tx => tx.direction === 'credit' && tx.reconciliation_status === 'unmatched')
      .reduce((sum, tx) => sum + tx.amount, 0),
    unmatched_debits: txs.filter(tx => tx.direction === 'debit' && tx.reconciliation_status === 'unmatched')
      .reduce((sum, tx) => sum + tx.amount, 0),
  };

  const matchRate = txs.length > 0
    ? Math.round((stats.matched / txs.length) * 100)
    : 0;

  return {
    stats: {
      ...stats,
      match_rate: matchRate,
    },
    summary: `${stats.unmatched} transactions non rapprochées sur ${stats.total_transactions} (taux: ${matchRate}%)`,
    columns: [
      { key: 'total_transactions', label: 'Total transactions', type: 'number' },
      { key: 'matched', label: 'Rapprochées', type: 'number' },
      { key: 'unmatched', label: 'Non rapprochées', type: 'number' },
      { key: 'match_rate', label: 'Taux rapprochement', type: 'percentage' },
      { key: 'unmatched_credits', label: 'Crédits non rapprochés', type: 'currency' },
      { key: 'unmatched_debits', label: 'Débits non rapprochés', type: 'currency' },
    ] as ColumnDefinition[],
  };
}

async function unmatchedTransactions(
  supabase: SupabaseClient,
  orgId: string,
  params: { limit?: number }
) {
  const { data, error } = await supabase
    .from('erp_bank_transactions')
    .select(`
      id, operation_date, amount, direction, label_raw, counterparty_name,
      bank_account:erp_bank_accounts(label)
    `)
    .eq('org_id', orgId)
    .eq('reconciliation_status', 'unmatched')
    .order('operation_date', { ascending: false })
    .limit(params.limit || 30);

  if (error) throw error;

  const rows = (data || []).map(tx => ({
    ...tx,
    bank_account_label: (tx.bank_account as any)?.label || 'N/A',
    amount_signed: tx.direction === 'debit' ? -tx.amount : tx.amount,
  }));

  const totalCredits = rows.filter(r => r.direction === 'credit').reduce((sum, r) => sum + r.amount, 0);
  const totalDebits = rows.filter(r => r.direction === 'debit').reduce((sum, r) => sum + r.amount, 0);

  return {
    rows,
    stats: {
      count: rows.length,
      total_credits: totalCredits,
      total_debits: totalDebits,
      net: totalCredits - totalDebits,
    },
    columns: [
      { key: 'operation_date', label: 'Date', type: 'date' },
      { key: 'label_raw', label: 'Libellé', type: 'string' },
      { key: 'counterparty_name', label: 'Tiers', type: 'string' },
      { key: 'amount_signed', label: 'Montant', type: 'currency' },
      { key: 'direction', label: 'Sens', type: 'string' },
      { key: 'bank_account_label', label: 'Compte', type: 'string' },
    ] as ColumnDefinition[],
  };
}

// =============================================================================
// Lettrage Tools
// =============================================================================

async function getLettrageStats(
  supabase: SupabaseClient,
  orgId: string,
  params: { account_type?: string }
) {
  const accountType = params.account_type || 'client';
  const accountPrefix = accountType === 'supplier' ? '401' : '411';

  // Get entries
  const { data: entries } = await supabase
    .from('erp_journal_entries')
    .select('debit, credit, is_lettred')
    .eq('org_id', orgId)
    .like('account_code', `${accountPrefix}%`);

  const allEntries = entries || [];

  const unlettred = allEntries.filter(e => !e.is_lettred);
  const lettred = allEntries.filter(e => e.is_lettred);

  const stats = {
    total_entries: allEntries.length,
    lettred_entries: lettred.length,
    unlettred_entries: unlettred.length,
    lettrage_rate: allEntries.length > 0
      ? Math.round((lettred.length / allEntries.length) * 100)
      : 0,
    unlettred_debit: unlettred.reduce((sum, e) => sum + (e.debit || 0), 0),
    unlettred_credit: unlettred.reduce((sum, e) => sum + (e.credit || 0), 0),
    unlettred_balance: unlettred.reduce((sum, e) => sum + (e.debit || 0) - (e.credit || 0), 0),
    account_type: accountType,
    account_prefix: accountPrefix,
  };

  return {
    stats,
    summary: `${stats.unlettred_entries} écritures non lettrées sur ${stats.total_entries} (compte ${accountPrefix})`,
    columns: [
      { key: 'total_entries', label: 'Total écritures', type: 'number' },
      { key: 'lettred_entries', label: 'Lettrées', type: 'number' },
      { key: 'unlettred_entries', label: 'Non lettrées', type: 'number' },
      { key: 'lettrage_rate', label: 'Taux lettrage', type: 'percentage' },
      { key: 'unlettred_balance', label: 'Solde non lettré', type: 'currency' },
    ] as ColumnDefinition[],
  };
}

async function unlettredEntries(
  supabase: SupabaseClient,
  orgId: string,
  params: { account_type?: string; limit?: number }
) {
  const accountType = params.account_type || 'client';
  const accountPrefix = accountType === 'supplier' ? '401' : '411';

  const { data, error } = await supabase
    .from('erp_journal_entries')
    .select('id, entry_date, piece_number, account_code, account_label, label, debit, credit')
    .eq('org_id', orgId)
    .like('account_code', `${accountPrefix}%`)
    .eq('is_lettred', false)
    .order('entry_date', { ascending: false })
    .limit(params.limit || 50);

  if (error) throw error;

  const rows = data || [];
  const totalDebit = rows.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = rows.reduce((sum, e) => sum + (e.credit || 0), 0);

  return {
    rows,
    stats: {
      count: rows.length,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance: totalDebit - totalCredit,
    },
    columns: [
      { key: 'entry_date', label: 'Date', type: 'date' },
      { key: 'piece_number', label: 'Pièce', type: 'string' },
      { key: 'account_code', label: 'Compte', type: 'string' },
      { key: 'account_label', label: 'Tiers', type: 'string' },
      { key: 'label', label: 'Libellé', type: 'string' },
      { key: 'debit', label: 'Débit', type: 'currency' },
      { key: 'credit', label: 'Crédit', type: 'currency' },
    ] as ColumnDefinition[],
  };
}
