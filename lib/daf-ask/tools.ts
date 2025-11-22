/**
 * Ask DAF - Data Tools Implementation
 * Secure database queries for the LLM agent
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingsGenerator } from '../rag/embeddings';
import type {
  InvoiceFilter,
  InvoiceRow,
  SupplierSummary,
  MonthlySummary,
  DocumentRow,
  OverviewStats,
  ColumnDefinition,
} from './types';

// =============================================================================
// Tool: list_invoices
// =============================================================================

export async function listInvoices(
  supabase: SupabaseClient,
  orgId: string,
  filter: InvoiceFilter & { limit?: number }
): Promise<{ rows: InvoiceRow[]; columns: ColumnDefinition[]; total: number }> {
  let query = supabase
    .from('daf_documents')
    .select('id, file_name, fournisseur, montant_ht, montant_ttc, taux_tva, date_document, date_echeance, numero_facture, status, created_at', { count: 'exact' })
    .eq('org_id', orgId)
    .or('ai_detected_type.eq.invoice,doc_type.eq.facture')
    .order('date_document', { ascending: false, nullsFirst: false });

  // Apply filters
  if (filter.status === 'unpaid') {
    // Unpaid = validated but past due date
    query = query
      .eq('status', 'validated')
      .lt('date_echeance', new Date().toISOString().split('T')[0]);
  } else if (filter.status) {
    query = query.eq('status', filter.status);
  }

  if (filter.supplier) {
    query = query.ilike('fournisseur', `%${filter.supplier}%`);
  }

  if (filter.dateFrom) {
    query = query.gte('date_document', filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte('date_document', filter.dateTo);
  }

  if (filter.minAmount !== undefined) {
    query = query.gte('montant_ttc', filter.minAmount);
  }

  if (filter.maxAmount !== undefined) {
    query = query.lte('montant_ttc', filter.maxAmount);
  }

  const limit = Math.min(filter.limit || 50, 500);
  query = query.limit(limit);

  const { data, error, count } = await query;

  if (error) {
    console.error('[list_invoices] Error:', error);
    throw new Error(`Failed to list invoices: ${error.message}`);
  }

  return {
    rows: (data || []) as InvoiceRow[],
    columns: [
      { key: 'fournisseur', label: 'Fournisseur', type: 'string' },
      { key: 'montant_ttc', label: 'Montant TTC', type: 'currency' },
      { key: 'montant_ht', label: 'Montant HT', type: 'currency' },
      { key: 'date_document', label: 'Date', type: 'date' },
      { key: 'date_echeance', label: 'Échéance', type: 'date' },
      { key: 'numero_facture', label: 'N° Facture', type: 'string' },
      { key: 'status', label: 'Statut', type: 'string' },
    ],
    total: count || 0,
  };
}

// =============================================================================
// Tool: sum_invoices
// =============================================================================

export async function sumInvoices(
  supabase: SupabaseClient,
  orgId: string,
  filter: InvoiceFilter & { groupBy?: 'supplier' | 'month' | 'status' }
): Promise<{
  total_ttc: number;
  total_ht: number;
  count: number;
  grouped?: SupplierSummary[] | MonthlySummary[];
  columns?: ColumnDefinition[];
}> {
  // If groupBy is specified, use appropriate grouping function
  if (filter.groupBy === 'supplier') {
    const result = await invoicesBySupplier(supabase, orgId, filter);
    const total_ttc = result.rows.reduce((sum, r) => sum + r.total_ttc, 0);
    const total_ht = result.rows.reduce((sum, r) => sum + r.total_ht, 0);
    const count = result.rows.reduce((sum, r) => sum + r.invoice_count, 0);
    return { total_ttc, total_ht, count, grouped: result.rows, columns: result.columns };
  }

  if (filter.groupBy === 'month') {
    const result = await invoicesByMonth(supabase, orgId, {});
    const total_ttc = result.rows.reduce((sum, r) => sum + r.total_ttc, 0);
    const total_ht = result.rows.reduce((sum, r) => sum + r.total_ht, 0);
    const count = result.rows.reduce((sum, r) => sum + r.invoice_count, 0);
    return { total_ttc, total_ht, count, grouped: result.rows, columns: result.columns };
  }

  // Simple aggregation
  let query = supabase
    .from('daf_documents')
    .select('montant_ht, montant_ttc')
    .eq('org_id', orgId)
    .or('ai_detected_type.eq.invoice,doc_type.eq.facture');

  if (filter.status === 'unpaid') {
    query = query
      .eq('status', 'validated')
      .lt('date_echeance', new Date().toISOString().split('T')[0]);
  } else if (filter.status) {
    query = query.eq('status', filter.status);
  }

  if (filter.supplier) {
    query = query.ilike('fournisseur', `%${filter.supplier}%`);
  }

  if (filter.dateFrom) {
    query = query.gte('date_document', filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte('date_document', filter.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[sum_invoices] Error:', error);
    throw new Error(`Failed to sum invoices: ${error.message}`);
  }

  const rows = data || [];
  const total_ttc = rows.reduce((sum, r) => sum + (r.montant_ttc || 0), 0);
  const total_ht = rows.reduce((sum, r) => sum + (r.montant_ht || 0), 0);

  return { total_ttc, total_ht, count: rows.length };
}

// =============================================================================
// Tool: invoices_by_supplier
// =============================================================================

export async function invoicesBySupplier(
  supabase: SupabaseClient,
  orgId: string,
  filter: { dateFrom?: string; dateTo?: string; minTotal?: number; limit?: number }
): Promise<{ rows: SupplierSummary[]; columns: ColumnDefinition[] }> {
  let query = supabase
    .from('daf_documents')
    .select('fournisseur, montant_ht, montant_ttc, date_document')
    .eq('org_id', orgId)
    .or('ai_detected_type.eq.invoice,doc_type.eq.facture')
    .not('fournisseur', 'is', null);

  if (filter.dateFrom) {
    query = query.gte('date_document', filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte('date_document', filter.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[invoices_by_supplier] Error:', error);
    throw new Error(`Failed to get invoices by supplier: ${error.message}`);
  }

  // Group by supplier in JS (Supabase doesn't support GROUP BY easily)
  const supplierMap = new Map<string, SupplierSummary>();

  for (const row of data || []) {
    const supplier = row.fournisseur || 'Unknown';
    const existing = supplierMap.get(supplier) || {
      supplier,
      total_ttc: 0,
      total_ht: 0,
      invoice_count: 0,
      avg_amount: 0,
      last_invoice_date: null,
    };

    existing.total_ttc += row.montant_ttc || 0;
    existing.total_ht += row.montant_ht || 0;
    existing.invoice_count += 1;

    if (!existing.last_invoice_date || (row.date_document && row.date_document > existing.last_invoice_date)) {
      existing.last_invoice_date = row.date_document;
    }

    supplierMap.set(supplier, existing);
  }

  let results = Array.from(supplierMap.values());

  // Calculate averages
  results = results.map(r => ({
    ...r,
    avg_amount: r.invoice_count > 0 ? r.total_ttc / r.invoice_count : 0,
  }));

  // Filter by min total
  if (filter.minTotal) {
    results = results.filter(r => r.total_ttc >= filter.minTotal!);
  }

  // Sort by total descending
  results.sort((a, b) => b.total_ttc - a.total_ttc);

  // Limit
  const limit = Math.min(filter.limit || 20, 100);
  results = results.slice(0, limit);

  return {
    rows: results,
    columns: [
      { key: 'supplier', label: 'Fournisseur', type: 'string' },
      { key: 'total_ttc', label: 'Total TTC', type: 'currency' },
      { key: 'total_ht', label: 'Total HT', type: 'currency' },
      { key: 'invoice_count', label: 'Nb Factures', type: 'number' },
      { key: 'avg_amount', label: 'Moyenne', type: 'currency' },
      { key: 'last_invoice_date', label: 'Dernière Facture', type: 'date' },
    ],
  };
}

// =============================================================================
// Tool: invoices_by_month
// =============================================================================

export async function invoicesByMonth(
  supabase: SupabaseClient,
  orgId: string,
  filter: { year?: number; supplier?: string; months?: number }
): Promise<{ rows: MonthlySummary[]; columns: ColumnDefinition[] }> {
  const monthsBack = filter.months || 12;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);

  let query = supabase
    .from('daf_documents')
    .select('montant_ht, montant_ttc, date_document')
    .eq('org_id', orgId)
    .or('ai_detected_type.eq.invoice,doc_type.eq.facture')
    .gte('date_document', startDate.toISOString().split('T')[0])
    .not('date_document', 'is', null);

  if (filter.year) {
    query = query
      .gte('date_document', `${filter.year}-01-01`)
      .lte('date_document', `${filter.year}-12-31`);
  }

  if (filter.supplier) {
    query = query.ilike('fournisseur', `%${filter.supplier}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[invoices_by_month] Error:', error);
    throw new Error(`Failed to get invoices by month: ${error.message}`);
  }

  // Group by month
  const monthMap = new Map<string, MonthlySummary>();

  for (const row of data || []) {
    if (!row.date_document) continue;

    const date = new Date(row.date_document);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;

    const existing = monthMap.get(key) || {
      month: `${year}-${month}`,
      year,
      total_ttc: 0,
      total_ht: 0,
      invoice_count: 0,
    };

    existing.total_ttc += row.montant_ttc || 0;
    existing.total_ht += row.montant_ht || 0;
    existing.invoice_count += 1;

    monthMap.set(key, existing);
  }

  const results = Array.from(monthMap.values());
  results.sort((a, b) => a.month.localeCompare(b.month));

  return {
    rows: results,
    columns: [
      { key: 'month', label: 'Mois', type: 'string' },
      { key: 'total_ttc', label: 'Total TTC', type: 'currency' },
      { key: 'total_ht', label: 'Total HT', type: 'currency' },
      { key: 'invoice_count', label: 'Nb Factures', type: 'number' },
    ],
  };
}

// =============================================================================
// Tool: list_documents
// =============================================================================

export async function listDocuments(
  supabase: SupabaseClient,
  orgId: string,
  filter: { type?: string; status?: string; dateFrom?: string; dateTo?: string; search?: string; limit?: number }
): Promise<{ rows: DocumentRow[]; columns: ColumnDefinition[]; total: number }> {
  let query = supabase
    .from('daf_documents')
    .select('id, file_name, ai_detected_type, doc_type, status, page_count, created_at, key_info', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filter.type) {
    query = query.eq('ai_detected_type', filter.type);
  }

  if (filter.status) {
    query = query.eq('status', filter.status);
  }

  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  if (filter.search) {
    query = query.or(`file_name.ilike.%${filter.search}%,full_text.ilike.%${filter.search}%`);
  }

  const limit = Math.min(filter.limit || 50, 500);
  query = query.limit(limit);

  const { data, error, count } = await query;

  if (error) {
    console.error('[list_documents] Error:', error);
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return {
    rows: (data || []) as DocumentRow[],
    columns: [
      { key: 'file_name', label: 'Document', type: 'string' },
      { key: 'ai_detected_type', label: 'Type', type: 'string' },
      { key: 'status', label: 'Statut', type: 'string' },
      { key: 'page_count', label: 'Pages', type: 'number' },
      { key: 'created_at', label: 'Date', type: 'date' },
    ],
    total: count || 0,
  };
}

// =============================================================================
// Tool: list_cvs
// =============================================================================

export async function listCVs(
  supabase: SupabaseClient,
  orgId: string,
  filter: { skills?: string; dateFrom?: string; dateTo?: string; search?: string; limit?: number }
): Promise<{ rows: DocumentRow[]; columns: ColumnDefinition[]; total: number }> {
  let query = supabase
    .from('daf_documents')
    .select('id, file_name, ai_detected_type, status, page_count, created_at, key_info, full_text', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('ai_detected_type', 'cv')
    .order('created_at', { ascending: false });

  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  // Search in skills or full text
  if (filter.skills || filter.search) {
    const searchTerm = filter.skills || filter.search;
    query = query.or(`full_text.ilike.%${searchTerm}%,file_name.ilike.%${searchTerm}%`);
  }

  const limit = Math.min(filter.limit || 50, 500);
  query = query.limit(limit);

  const { data, error, count } = await query;

  if (error) {
    console.error('[list_cvs] Error:', error);
    throw new Error(`Failed to list CVs: ${error.message}`);
  }

  // Extract name from key_info if available
  const rows = (data || []).map(row => ({
    ...row,
    candidate_name: (row.key_info as any)?.name || row.file_name,
    candidate_title: (row.key_info as any)?.title || null,
  }));

  return {
    rows: rows as any,
    columns: [
      { key: 'candidate_name', label: 'Candidat', type: 'string' },
      { key: 'candidate_title', label: 'Poste', type: 'string' },
      { key: 'file_name', label: 'Fichier', type: 'string' },
      { key: 'page_count', label: 'Pages', type: 'number' },
      { key: 'created_at', label: 'Reçu le', type: 'date' },
    ],
    total: count || 0,
  };
}

// =============================================================================
// Tool: get_overview_stats
// =============================================================================

export async function getOverviewStats(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ stats: OverviewStats; columns: ColumnDefinition[] }> {
  // Get all documents for counting
  const { data: allDocs, error } = await supabase
    .from('daf_documents')
    .select('ai_detected_type, doc_type, status, montant_ttc, fournisseur, date_echeance')
    .eq('org_id', orgId);

  if (error) {
    console.error('[get_overview_stats] Error:', error);
    throw new Error(`Failed to get stats: ${error.message}`);
  }

  const docs = allDocs || [];
  const today = new Date().toISOString().split('T')[0];

  // Calculate stats
  const invoices = docs.filter(d => d.ai_detected_type === 'invoice' || d.doc_type === 'facture');
  const unpaidInvoices = invoices.filter(d =>
    d.status === 'validated' && d.date_echeance && d.date_echeance < today
  );

  const stats: OverviewStats = {
    total_documents: docs.length,
    total_invoices: invoices.length,
    total_cvs: docs.filter(d => d.ai_detected_type === 'cv').length,
    total_contracts: docs.filter(d => d.ai_detected_type === 'contract' || d.doc_type === 'contrat').length,
    total_other: docs.filter(d => !d.ai_detected_type || d.ai_detected_type === 'other').length,
    unpaid_invoices: unpaidInvoices.length,
    unpaid_amount: unpaidInvoices.reduce((sum, d) => sum + (d.montant_ttc || 0), 0),
    total_amount_ttc: invoices.reduce((sum, d) => sum + (d.montant_ttc || 0), 0),
    suppliers_count: new Set(invoices.map(d => d.fournisseur).filter(Boolean)).size,
  };

  return {
    stats,
    columns: [
      { key: 'metric', label: 'Indicateur', type: 'string' },
      { key: 'value', label: 'Valeur', type: 'number' },
    ],
  };
}

// =============================================================================
// Tool: search_documents
// =============================================================================

export async function searchDocuments(
  supabase: SupabaseClient,
  orgId: string,
  filter: { query: string; type?: string; limit?: number }
): Promise<{ rows: DocumentRow[]; columns: ColumnDefinition[]; total: number }> {
  const limit = Math.min(filter.limit || 50, 100);

  // Use full-text search
  let query = supabase
    .from('daf_documents')
    .select('id, file_name, ai_detected_type, doc_type, status, page_count, created_at, key_info, fournisseur, montant_ttc', { count: 'exact' })
    .eq('org_id', orgId)
    .or(`file_name.ilike.%${filter.query}%,fournisseur.ilike.%${filter.query}%,full_text.ilike.%${filter.query}%,numero_facture.ilike.%${filter.query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter.type) {
    query = query.eq('ai_detected_type', filter.type);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[search_documents] Error:', error);
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return {
    rows: (data || []) as any,
    columns: [
      { key: 'file_name', label: 'Document', type: 'string' },
      { key: 'ai_detected_type', label: 'Type', type: 'string' },
      { key: 'fournisseur', label: 'Fournisseur', type: 'string' },
      { key: 'montant_ttc', label: 'Montant', type: 'currency' },
      { key: 'created_at', label: 'Date', type: 'date' },
    ],
    total: count || 0,
  };
}

// =============================================================================
// Tool: semantic_search
// =============================================================================

export async function semanticSearch(
  supabase: SupabaseClient,
  orgId: string,
  filter: { query: string; type?: string; limit?: number; threshold?: number }
): Promise<{ rows: any[]; columns: ColumnDefinition[]; total: number }> {
  const limit = Math.min(filter.limit || 10, 50);
  const threshold = filter.threshold || 0.6;

  try {
    // Generate embedding for the query
    const embeddings = new EmbeddingsGenerator();
    const queryEmbedding = await embeddings.generateQueryEmbedding(filter.query);

    // Call the hybrid search function from the database
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_embedding: queryEmbedding,
      query_text: filter.query,
      p_org_id: orgId,
      p_content_type: filter.type ? `daf_${filter.type}` : null,
      p_metadata_filters: null,
      p_limit: limit,
      vector_weight: 0.7,
      fts_weight: 0.3,
    });

    if (error) {
      console.error('[semantic_search] Error:', error);
      // Fallback to regular full-text search if semantic fails
      console.log('[semantic_search] Falling back to full-text search');
      return await searchDocuments(supabase, orgId, filter);
    }

    if (!data || data.length === 0) {
      // If no embeddings found, fall back to regular search
      console.log('[semantic_search] No embeddings found, falling back to full-text search');
      return await searchDocuments(supabase, orgId, filter);
    }

    // Filter by similarity threshold
    const filteredResults = data.filter((row: any) =>
      (row.combined_score || row.vector_similarity || 0) >= threshold
    );

    // Fetch the actual document details for each source
    const sourceIds = [...new Set(filteredResults.map((r: any) => r.source_id))];

    if (sourceIds.length === 0) {
      return {
        rows: [],
        columns: [
          { key: 'file_name', label: 'Document', type: 'string' },
          { key: 'ai_detected_type', label: 'Type', type: 'string' },
          { key: 'similarity', label: 'Pertinence', type: 'percentage' },
          { key: 'chunk_preview', label: 'Extrait', type: 'string' },
        ],
        total: 0,
      };
    }

    const { data: documents, error: docError } = await supabase
      .from('daf_documents')
      .select('id, file_name, ai_detected_type, doc_type, fournisseur, montant_ttc, status, created_at')
      .eq('org_id', orgId)
      .in('id', sourceIds);

    if (docError) {
      console.error('[semantic_search] Error fetching documents:', docError);
    }

    // Merge results with document metadata
    const docMap = new Map((documents || []).map((d: any) => [d.id, d]));

    const rows = filteredResults.map((result: any) => {
      const doc = docMap.get(result.source_id) || {};
      return {
        id: result.source_id,
        file_name: doc.file_name || 'Unknown',
        ai_detected_type: doc.ai_detected_type || result.content_type?.replace('daf_', '') || 'document',
        fournisseur: doc.fournisseur,
        montant_ttc: doc.montant_ttc,
        similarity: result.combined_score || result.vector_similarity || 0,
        chunk_preview: result.chunk_text?.substring(0, 200) + (result.chunk_text?.length > 200 ? '...' : ''),
        created_at: doc.created_at,
      };
    });

    // Deduplicate by document ID (take highest similarity)
    const uniqueDocs = new Map();
    for (const row of rows) {
      if (!uniqueDocs.has(row.id) || uniqueDocs.get(row.id).similarity < row.similarity) {
        uniqueDocs.set(row.id, row);
      }
    }

    const uniqueRows = Array.from(uniqueDocs.values());

    return {
      rows: uniqueRows.slice(0, limit),
      columns: [
        { key: 'file_name', label: 'Document', type: 'string' },
        { key: 'ai_detected_type', label: 'Type', type: 'string' },
        { key: 'fournisseur', label: 'Fournisseur', type: 'string' },
        { key: 'montant_ttc', label: 'Montant', type: 'currency' },
        { key: 'similarity', label: 'Pertinence', type: 'percentage' },
        { key: 'chunk_preview', label: 'Extrait', type: 'string' },
      ],
      total: uniqueRows.length,
    };
  } catch (error) {
    console.error('[semantic_search] Error:', error);
    // Graceful fallback to full-text search
    console.log('[semantic_search] Falling back to full-text search due to error');
    return await searchDocuments(supabase, orgId, filter);
  }
}

// =============================================================================
// Tool Executor
// =============================================================================

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: any; columns?: ColumnDefinition[] }> {
  console.log(`[Ask DAF] Executing tool: ${toolName}`, args);

  switch (toolName) {
    case 'list_invoices':
      return await listInvoices(supabase, orgId, args as any);

    case 'sum_invoices':
      return await sumInvoices(supabase, orgId, args as any);

    case 'invoices_by_supplier':
      return await invoicesBySupplier(supabase, orgId, args as any);

    case 'invoices_by_month':
      return await invoicesByMonth(supabase, orgId, args as any);

    case 'list_documents':
      return await listDocuments(supabase, orgId, args as any);

    case 'list_cvs':
      return await listCVs(supabase, orgId, args as any);

    case 'get_overview_stats':
      return await getOverviewStats(supabase, orgId);

    case 'search_documents':
      return await searchDocuments(supabase, orgId, args as any);

    case 'semantic_search':
      return await semanticSearch(supabase, orgId, args as any);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// =============================================================================
// CSV Export Helper
// =============================================================================

export function generateCSV(rows: Record<string, any>[], columns: ColumnDefinition[]): string {
  if (!rows.length) return '';

  const headers = columns.map(c => c.label).join(',');
  const dataRows = rows.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',');
  });

  return [headers, ...dataRows].join('\n');
}
