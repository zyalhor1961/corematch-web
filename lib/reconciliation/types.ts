/**
 * Types pour le Moteur de Réconciliation Bancaire et Lettrage
 */

// ===== COMPTES BANCAIRES =====
export interface BankAccount {
  id: string;
  org_id: string;
  label: string;
  bank_name?: string;
  iban?: string;
  bic?: string;
  account_number?: string;
  account_code: string;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  last_balance?: number;
  last_balance_date?: string;
  external_provider?: string;
  external_account_id?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

// ===== RELEVÉS BANCAIRES =====
export interface BankStatement {
  id: string;
  org_id: string;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  reference?: string;
  opening_balance?: number;
  closing_balance?: number;
  source_type: 'manual' | 'file_import' | 'api_sync';
  source_file_url?: string;
  source_file_name?: string;
  status: 'imported' | 'processing' | 'reconciled' | 'closed';
  transaction_count: number;
  reconciled_count: number;
  imported_by?: string;
  imported_at: string;
  reconciled_by?: string;
  reconciled_at?: string;
}

// ===== TRANSACTIONS BANCAIRES =====
export type TransactionDirection = 'credit' | 'debit';
export type ReconciliationStatus = 'unmatched' | 'suggested' | 'matched' | 'suspicious' | 'ignored';

export interface BankTransaction {
  id: string;
  org_id: string;
  bank_account_id: string;
  bank_statement_id?: string;
  operation_date: string;
  value_date?: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  label_raw: string;
  label_clean?: string;
  label_category?: string;
  bank_reference?: string;
  counterparty_name?: string;
  counterparty_iban?: string;
  counterparty_bic?: string;
  check_number?: string;
  card_last_digits?: string;
  ai_extracted_invoice_ref?: string;
  ai_extracted_client_name?: string;
  ai_extracted_supplier_name?: string;
  ai_operation_type?: string;
  ai_confidence?: number;
  ai_extracted_at?: string;
  reconciliation_status: ReconciliationStatus;
  reconciliation_score?: number;
  external_id?: string;
  created_at: string;
  updated_at: string;
}

// ===== MATCHES DE RÉCONCILIATION =====
export type MatchType =
  | 'customer_invoice'
  | 'supplier_invoice'
  | 'customer_payment'
  | 'supplier_payment'
  | 'expense'
  | 'bank_fee'
  | 'salary'
  | 'tax'
  | 'transfer'
  | 'loan'
  | 'other'
  | 'unknown';

export type MatchStatus = 'suggested' | 'accepted' | 'rejected' | 'modified';

export interface ReconciliationMatch {
  id: string;
  org_id: string;
  bank_transaction_id: string;
  match_type: MatchType;
  matched_invoice_id?: string;
  matched_supplier_invoice_id?: string;
  matched_payment_id?: string;
  matched_supplier_payment_id?: string;
  matched_expense_id?: string;
  matched_journal_entry_id?: string;
  matched_invoice_ids?: string[];
  matched_supplier_invoice_ids?: string[];
  matched_amount: number;
  remaining_amount: number;
  match_rule?: string;
  confidence_score: number;
  is_auto_match: boolean;
  status: MatchStatus;
  validated_by?: string;
  validated_at?: string;
  rejection_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ===== RÈGLES DE MATCHING =====
export type RuleType = 'deterministic' | 'scoring' | 'ai';

export interface MatchConditions {
  amount_tolerance?: number;        // Tolérance en % (0.01 = 1%)
  date_window_days?: number;        // Fenêtre de dates en jours
  require_iban_match?: boolean;     // IBAN doit correspondre
  require_invoice_ref?: boolean;    // Référence facture doit être trouvée
  require_name_match?: boolean;     // Nom doit correspondre
  name_similarity_min?: number;     // Score similarité nom minimum
  label_patterns?: string[];        // Patterns à chercher dans libellé
  use_llm?: boolean;                // Utiliser LLM pour extraction
  extract_fields?: string[];        // Champs à extraire par IA
}

export interface ScoreWeights {
  exact_amount?: number;            // Poids montant exact
  date_proximity?: number;          // Poids proximité date
  name_similarity?: number;         // Poids similarité nom
  iban_match?: number;              // Poids IBAN
  invoice_ref_found?: number;       // Poids référence facture trouvée
}

export interface ReconciliationRule {
  id: string;
  org_id: string;
  rule_code: string;
  rule_name: string;
  description?: string;
  rule_type: RuleType;
  match_level: number;
  conditions: MatchConditions;
  score_weights?: ScoreWeights;
  auto_match_threshold: number;
  suggestion_threshold: number;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// ===== LETTRAGE COMPTABLE =====
export type PartnerType = 'client' | 'supplier';
export type LettrageStatus = 'partial' | 'balanced' | 'cancelled';

export interface AccountLettrage {
  id: string;
  org_id: string;
  account_code: string;
  partner_type: PartnerType;
  partner_id?: string;
  lettrage_code: string;
  lettrage_date: string;
  total_debit: number;
  total_credit: number;
  balance: number;
  status: LettrageStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LettrageLine {
  id: string;
  lettrage_id: string;
  journal_entry_id: string;
  journal_line_id: string;
  lettered_amount: number;
  created_at: string;
}

// ===== CANDIDATS DE MATCH =====
export interface MatchCandidate {
  type: 'invoice' | 'supplier_invoice' | 'expense' | 'payment';
  entity_id: string;
  entity_ref: string;
  amount: number;
  date: string;
  partner_id?: string;
  partner_name?: string;
  partner_iban?: string;
  open_amount?: number;           // Montant restant dû
  score: number;
  match_reasons: string[];        // Raisons du match
}

// ===== RÉSULTATS DE RÉCONCILIATION =====
export interface ReconciliationResult {
  success: boolean;
  transaction_id: string;
  matches: MatchCandidate[];
  best_match?: MatchCandidate;
  auto_matched: boolean;
  match_id?: string;
  error?: string;
}

// ===== EXTRACTION IA =====
export interface AIExtractionResult {
  invoice_ref?: string;
  client_name?: string;
  supplier_name?: string;
  operation_type?: string;
  confidence: number;
  raw_analysis?: string;
}

// ===== STATISTIQUES =====
export interface ReconciliationStats {
  total_transactions: number;
  unmatched: number;
  suggested: number;
  matched: number;
  suspicious: number;
  ignored: number;
  auto_match_rate: number;       // % de matches automatiques
  total_amount_matched: number;
  total_amount_unmatched: number;
}
