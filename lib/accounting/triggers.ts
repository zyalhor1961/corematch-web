/**
 * Déclencheurs comptables
 * Fonctions pour générer les écritures automatiquement lors des événements métier
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createAccountingEngine } from './engine';
import { AccountingEventData, GenerationResult, SourceType } from './types';

/**
 * Déclenche la comptabilisation d'une facture client validée
 */
export async function onCustomerInvoiceValidated(
  supabase: SupabaseClient,
  invoice: {
    id: string;
    org_id: string;
    invoice_number: string;
    invoice_date: string;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    client_id: string;
    client_name?: string;
  }
): Promise<GenerationResult> {
  const engine = createAccountingEngine(supabase, invoice.org_id);

  // Récupérer le nom du client si non fourni
  let clientName = invoice.client_name;
  if (!clientName && invoice.client_id) {
    const { data: client } = await supabase
      .from('erp_clients')
      .select('name, company_name')
      .eq('id', invoice.client_id)
      .single();
    clientName = client?.company_name || client?.name || '';
  }

  const eventData: AccountingEventData = {
    event_type: 'customer_invoice_validated',
    org_id: invoice.org_id,
    source: {
      id: invoice.id,
      ref: invoice.invoice_number,
      date: invoice.invoice_date,
      total_ht: invoice.total_ht,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      client_id: invoice.client_id,
      client_name: clientName,
    },
  };

  return engine.generateFromEvent(eventData);
}

/**
 * Déclenche la comptabilisation d'une facture fournisseur validée
 */
export async function onSupplierInvoiceValidated(
  supabase: SupabaseClient,
  invoice: {
    id: string;
    org_id: string;
    invoice_number: string;
    invoice_date: string;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    supplier_id: string;
    supplier_name?: string;
    expense_category?: string;
  }
): Promise<GenerationResult> {
  const engine = createAccountingEngine(supabase, invoice.org_id);

  // Récupérer le nom du fournisseur si non fourni
  let supplierName = invoice.supplier_name;
  if (!supplierName && invoice.supplier_id) {
    const { data: supplier } = await supabase
      .from('erp_suppliers')
      .select('name, company_name')
      .eq('id', invoice.supplier_id)
      .single();
    supplierName = supplier?.company_name || supplier?.name || '';
  }

  const eventData: AccountingEventData = {
    event_type: 'supplier_invoice_validated',
    org_id: invoice.org_id,
    source: {
      id: invoice.id,
      ref: invoice.invoice_number,
      date: invoice.invoice_date,
      total_ht: invoice.total_ht,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      supplier_id: invoice.supplier_id,
      supplier_name: supplierName,
      category: invoice.expense_category,
    },
  };

  return engine.generateFromEvent(eventData);
}

/**
 * Déclenche la comptabilisation d'un encaissement client
 */
export async function onPaymentReceived(
  supabase: SupabaseClient,
  payment: {
    id: string;
    org_id: string;
    invoice_id?: string;
    invoice_number?: string;
    payment_date: string;
    amount: number;
    client_id: string;
    client_name?: string;
    payment_method?: string;
    reference?: string;
  }
): Promise<GenerationResult> {
  const engine = createAccountingEngine(supabase, payment.org_id);

  // Récupérer le nom du client si non fourni
  let clientName = payment.client_name;
  if (!clientName && payment.client_id) {
    const { data: client } = await supabase
      .from('erp_clients')
      .select('name, company_name')
      .eq('id', payment.client_id)
      .single();
    clientName = client?.company_name || client?.name || '';
  }

  const eventData: AccountingEventData = {
    event_type: 'payment_received',
    org_id: payment.org_id,
    source: {
      id: payment.id,
      ref: payment.reference || payment.invoice_number || `ENC-${payment.id.substring(0, 8)}`,
      date: payment.payment_date,
      amount: payment.amount,
      client_id: payment.client_id,
      client_name: clientName,
      payment_method: payment.payment_method,
      invoice_id: payment.invoice_id,
    },
  };

  return engine.generateFromEvent(eventData);
}

/**
 * Déclenche la comptabilisation d'un décaissement fournisseur
 */
export async function onPaymentSent(
  supabase: SupabaseClient,
  payment: {
    id: string;
    org_id: string;
    invoice_id?: string;
    invoice_number?: string;
    payment_date: string;
    amount: number;
    supplier_id: string;
    supplier_name?: string;
    payment_method?: string;
    reference?: string;
  }
): Promise<GenerationResult> {
  const engine = createAccountingEngine(supabase, payment.org_id);

  // Récupérer le nom du fournisseur si non fourni
  let supplierName = payment.supplier_name;
  if (!supplierName && payment.supplier_id) {
    const { data: supplier } = await supabase
      .from('erp_suppliers')
      .select('name, company_name')
      .eq('id', payment.supplier_id)
      .single();
    supplierName = supplier?.company_name || supplier?.name || '';
  }

  const eventData: AccountingEventData = {
    event_type: 'payment_sent',
    org_id: payment.org_id,
    source: {
      id: payment.id,
      ref: payment.reference || payment.invoice_number || `DEC-${payment.id.substring(0, 8)}`,
      date: payment.payment_date,
      amount: payment.amount,
      supplier_id: payment.supplier_id,
      supplier_name: supplierName,
      payment_method: payment.payment_method,
      invoice_id: payment.invoice_id,
    },
  };

  return engine.generateFromEvent(eventData);
}

/**
 * Déclenche la comptabilisation d'une dépense/note de frais
 */
export async function onExpenseRecorded(
  supabase: SupabaseClient,
  expense: {
    id: string;
    org_id: string;
    expense_date: string;
    amount: number;
    vat_amount?: number;
    category: string;
    description: string;
    supplier_id?: string;
    supplier_name?: string;
    reference?: string;
    payment_method?: string;
  }
): Promise<GenerationResult> {
  const engine = createAccountingEngine(supabase, expense.org_id);

  // Récupérer le nom du fournisseur si applicable
  let supplierName = expense.supplier_name;
  if (!supplierName && expense.supplier_id) {
    const { data: supplier } = await supabase
      .from('erp_suppliers')
      .select('name, company_name')
      .eq('id', expense.supplier_id)
      .single();
    supplierName = supplier?.company_name || supplier?.name || '';
  }

  // Calculer HT si nécessaire
  const vatAmount = expense.vat_amount || 0;
  const amountHt = expense.amount - vatAmount;

  const eventData: AccountingEventData = {
    event_type: 'expense_recorded',
    org_id: expense.org_id,
    source: {
      id: expense.id,
      ref: expense.reference || `DEP-${expense.id.substring(0, 8)}`,
      date: expense.expense_date,
      amount: expense.amount,
      amount_ht: amountHt,
      vat_amount: vatAmount,
      category: expense.category,
      description: expense.description,
      supplier_id: expense.supplier_id,
      supplier_name: supplierName,
      payment_method: expense.payment_method,
    },
  };

  return engine.generateFromEvent(eventData);
}

/**
 * Annule les écritures liées à une pièce source
 * À utiliser lors de la modification ou suppression d'une facture/paiement
 */
export async function reverseEntriesForSource(
  supabase: SupabaseClient,
  orgId: string,
  sourceType: SourceType,
  sourceId: string,
  reversalDate: string,
  reason?: string
): Promise<GenerationResult[]> {
  const engine = createAccountingEngine(supabase, orgId);

  // Trouver toutes les écritures non annulées liées à cette source
  const { data: entries, error } = await supabase
    .from('erp_journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .neq('status', 'reversed');

  if (error || !entries || entries.length === 0) {
    return [];
  }

  const results: GenerationResult[] = [];
  for (const entry of entries) {
    const result = await engine.reverseEntry(entry.id, reversalDate, reason);
    results.push(result);
  }

  return results;
}

/**
 * Régénère les écritures pour une pièce (après modification)
 * 1. Annule les anciennes écritures
 * 2. Génère de nouvelles écritures
 */
export async function regenerateEntriesForInvoice(
  supabase: SupabaseClient,
  invoice: {
    id: string;
    org_id: string;
    type: 'customer' | 'supplier';
    invoice_number: string;
    invoice_date: string;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    client_id?: string;
    client_name?: string;
    supplier_id?: string;
    supplier_name?: string;
    expense_category?: string;
  }
): Promise<{ reversals: GenerationResult[]; newEntry: GenerationResult }> {
  const sourceType: SourceType = invoice.type === 'customer' ? 'customer_invoice' : 'supplier_invoice';

  // 1. Annuler les anciennes écritures
  const reversals = await reverseEntriesForSource(
    supabase,
    invoice.org_id,
    sourceType,
    invoice.id,
    invoice.invoice_date,
    'Modification de la facture'
  );

  // 2. Générer la nouvelle écriture
  let newEntry: GenerationResult;
  if (invoice.type === 'customer') {
    newEntry = await onCustomerInvoiceValidated(supabase, {
      id: invoice.id,
      org_id: invoice.org_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      total_ht: invoice.total_ht,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      client_id: invoice.client_id!,
      client_name: invoice.client_name,
    });
  } else {
    newEntry = await onSupplierInvoiceValidated(supabase, {
      id: invoice.id,
      org_id: invoice.org_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      total_ht: invoice.total_ht,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      supplier_id: invoice.supplier_id!,
      supplier_name: invoice.supplier_name,
      expense_category: invoice.expense_category,
    });
  }

  return { reversals, newEntry };
}
