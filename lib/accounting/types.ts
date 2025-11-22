/**
 * Types pour le moteur comptable Corematch
 * Conforme PCG français, extensible international
 */

// Source types pour la traçabilité
export type SourceType =
  | 'customer_invoice'
  | 'supplier_invoice'
  | 'payment_in'
  | 'payment_out'
  | 'expense'
  | 'manual_adjustment'
  | 'opening';

// Types d'événements déclencheurs
export type AccountingEventType =
  | 'customer_invoice_validated'
  | 'supplier_invoice_validated'
  | 'payment_received'
  | 'payment_sent'
  | 'expense_recorded'
  | 'manual_entry';

// Statuts des écritures
export type EntryStatus = 'draft' | 'posted' | 'reversed' | 'locked';

// Types de journaux
export type JournalType = 'sale' | 'purchase' | 'bank' | 'cash' | 'misc' | 'opening';

// Types de comptes
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

// Structure d'un compte
export interface Account {
  id: string;
  org_id: string;
  account_code: string;
  account_name: string;
  account_name_short?: string;
  account_class: string;
  account_type: AccountType;
  account_subtype?: string;
  is_active: boolean;
  is_reconcilable: boolean;
  is_centralized: boolean;
  default_vat_rate?: number;
  vat_account_code?: string;
  requires_analytic: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Structure d'un journal
export interface Journal {
  id: string;
  org_id: string;
  journal_code: string;
  journal_name: string;
  journal_type: JournalType;
  default_account_code?: string;
  sequence_prefix?: string;
  next_sequence_number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Structure d'une écriture comptable
export interface JournalEntry {
  id: string;
  org_id: string;
  entry_number?: string;
  journal_id: string;
  journal?: Journal;
  source_type: SourceType;
  source_id?: string;
  source_ref?: string;
  entry_date: string;
  document_date?: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: EntryStatus;
  reversal_of?: string;
  reversed_by?: string;
  reversal_date?: string;
  created_by?: string;
  created_at: string;
  posted_by?: string;
  posted_at?: string;
  locked_by?: string;
  locked_at?: string;
  lines?: JournalLine[];
}

// Structure d'une ligne d'écriture
export interface JournalLine {
  id: string;
  entry_id: string;
  account_id?: string;
  account_code: string;
  account?: Account;
  debit: number;
  credit: number;
  description?: string;
  partner_type?: 'client' | 'supplier' | 'employee';
  partner_id?: string;
  partner_name?: string;
  analytic_account?: string;
  analytic_axis?: string;
  reconcile_ref?: string;
  reconciled_at?: string;
  line_number: number;
  created_at: string;
}

// Structure d'une règle de comptabilisation
export interface AccountingRule {
  id: string;
  org_id: string;
  rule_code: string;
  rule_name: string;
  event_type: AccountingEventType;
  journal_code: string;
  line_templates: LineTemplate[];
  conditions?: Record<string, any>;
  priority: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Template de ligne pour les règles
export interface LineTemplate {
  account_expression: string;    // Ex: '411000', 'expense_account'
  debit_expression: string;      // Ex: 'source.total_ttc', '0'
  credit_expression: string;
  description_template: string;  // Ex: 'Client {partner_name} - Facture {source_ref}'
  partner_expression?: string;   // Ex: 'source.client_id'
}

// Période fiscale
export interface FiscalPeriod {
  id: string;
  org_id: string;
  period_name: string;
  period_type: 'month' | 'quarter' | 'year';
  start_date: string;
  end_date: string;
  status: 'open' | 'closing' | 'closed' | 'locked';
  closed_at?: string;
  closed_by?: string;
  fiscal_year: number;
  created_at: string;
}

// Mapping catégorie dépense -> compte
export interface ExpenseAccountMapping {
  id: string;
  org_id: string;
  expense_category: string;
  account_code: string;
  is_default: boolean;
  created_at: string;
}

// Input pour créer une écriture
export interface CreateEntryInput {
  org_id: string;
  journal_code: string;
  source_type: SourceType;
  source_id?: string;
  source_ref?: string;
  entry_date: string;
  document_date?: string;
  description: string;
  lines: CreateLineInput[];
  auto_post?: boolean;
}

export interface CreateLineInput {
  account_code: string;
  debit: number;
  credit: number;
  description?: string;
  partner_type?: 'client' | 'supplier' | 'employee';
  partner_id?: string;
  partner_name?: string;
  analytic_account?: string;
}

// Données source pour génération automatique
export interface AccountingEventData {
  event_type: AccountingEventType;
  org_id: string;
  source: {
    id: string;
    ref?: string;
    date: string;
    total_ht?: number;
    total_tva?: number;
    total_ttc?: number;
    amount?: number;
    vat_amount?: number;
    client_id?: string;
    client_name?: string;
    supplier_id?: string;
    supplier_name?: string;
    category?: string;
    description?: string;
    payment_method?: string;
    expense_account?: string;
    [key: string]: any;
  };
}

// Résultat de génération
export interface GenerationResult {
  success: boolean;
  entry?: JournalEntry;
  entry_id?: string;
  entry_number?: string;
  error?: string;
  warnings?: string[];
}

// Solde de compte
export interface AccountBalance {
  org_id: string;
  account_code: string;
  account_name: string;
  account_class: string;
  account_type: AccountType;
  total_debit: number;
  total_credit: number;
  balance: number;
  last_movement_date?: string;
}

// Grand livre (détail d'un compte)
export interface GeneralLedgerEntry {
  entry_id: string;
  entry_number: string;
  entry_date: string;
  journal_code: string;
  account_code: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  partner_name?: string;
  source_type: SourceType;
  source_ref?: string;
}
