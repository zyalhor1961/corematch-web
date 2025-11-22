/**
 * Mini-ERP Types
 * TypeScript types for all ERP entities
 */

// =============================================================================
// Base Types
// =============================================================================

export interface Address {
  street?: string;
  street2?: string;
  city?: string;
  postal_code?: string;
  state?: string;
  country?: string;
}

export interface BankDetails {
  iban?: string;
  bic?: string;
  account_name?: string;
  bank_name?: string;
}

export type Currency = 'EUR' | 'USD' | 'GBP';

export type AccountingStandard = 'PCG' | 'GAAP';

// =============================================================================
// Clients
// =============================================================================

export interface Client {
  id: string;
  org_id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  vat_number?: string;
  siret?: string;
  ein?: string;
  billing_address?: Address;
  shipping_address?: Address;
  category?: string;
  tags?: string[];
  notes?: string;
  currency: Currency;
  payment_terms: number;
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  invoice_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ClientInput {
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  vat_number?: string;
  siret?: string;
  ein?: string;
  billing_address?: Address;
  shipping_address?: Address;
  category?: string;
  tags?: string[];
  notes?: string;
  currency?: Currency;
  payment_terms?: number;
}

// =============================================================================
// Suppliers
// =============================================================================

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  vat_number?: string;
  siret?: string;
  ein?: string;
  address?: Address;
  country: string;
  category?: string;
  tags?: string[];
  notes?: string;
  currency: Currency;
  payment_terms: number;
  bank_details?: BankDetails;
  total_purchased: number;
  total_paid: number;
  total_outstanding: number;
  invoice_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SupplierInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  vat_number?: string;
  siret?: string;
  ein?: string;
  address?: Address;
  country?: string;
  category?: string;
  tags?: string[];
  notes?: string;
  currency?: Currency;
  payment_terms?: number;
  bank_details?: BankDetails;
}

// =============================================================================
// Products
// =============================================================================

export type ProductType = 'product' | 'service';

export interface Product {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  sku?: string;
  unit_price: number;
  currency: Currency;
  vat_rate: number;
  tax_category: string;
  product_type: ProductType;
  category?: string;
  revenue_account_code?: string;
  expense_account_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  sku?: string;
  unit_price: number;
  currency?: Currency;
  vat_rate?: number;
  tax_category?: string;
  product_type?: ProductType;
  category?: string;
  revenue_account_code?: string;
  expense_account_code?: string;
  is_active?: boolean;
}

// =============================================================================
// Estimates (Devis)
// =============================================================================

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Estimate {
  id: string;
  org_id: string;
  client_id?: string;
  estimate_number: string;
  reference?: string;
  estimate_date: string;
  valid_until?: string;
  status: EstimateStatus;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  currency: Currency;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  notes?: string;
  terms?: string;
  converted_to_invoice_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined
  client?: Client;
  lines?: EstimateLine[];
}

export interface EstimateLine {
  id: string;
  estimate_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  line_order: number;
  created_at: string;
}

export interface EstimateInput {
  client_id?: string;
  reference?: string;
  estimate_date?: string;
  valid_until?: string;
  notes?: string;
  terms?: string;
  discount_type?: 'percent' | 'amount';
  discount_value?: number;
  lines?: EstimateLineInput[];
}

export interface EstimateLineInput {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
}

// =============================================================================
// Invoices (Factures clients)
// =============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded';

export interface Invoice {
  id: string;
  org_id: string;
  client_id?: string;
  estimate_id?: string;
  invoice_number: string;
  reference?: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  currency: Currency;
  paid_amount: number;
  balance_due: number;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  notes?: string;
  payment_terms?: string;
  footer?: string;
  pdf_url?: string;
  journal_entry_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined
  client?: Client;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  line_order: number;
  created_at: string;
}

export interface InvoiceInput {
  client_id?: string;
  estimate_id?: string;
  reference?: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  payment_terms?: string;
  footer?: string;
  discount_type?: 'percent' | 'amount';
  discount_value?: number;
  lines?: InvoiceLineInput[];
}

export interface InvoiceLineInput {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
}

// =============================================================================
// Payments
// =============================================================================

export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'card' | 'paypal' | 'stripe' | 'other';

export interface Payment {
  id: string;
  org_id: string;
  invoice_id?: string;
  client_id?: string;
  amount: number;
  currency: Currency;
  payment_date: string;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
  journal_entry_id?: string;
  created_at: string;
  created_by?: string;
}

export interface PaymentInput {
  invoice_id?: string;
  client_id?: string;
  amount: number;
  currency?: Currency;
  payment_date?: string;
  payment_method?: PaymentMethod;
  reference?: string;
  notes?: string;
}

// =============================================================================
// Supplier Invoices
// =============================================================================

export type SupplierInvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'overdue' | 'disputed';

export interface SupplierInvoice {
  id: string;
  org_id: string;
  supplier_id?: string;
  daf_document_id?: string;
  invoice_number?: string;
  reference?: string;
  invoice_date?: string;
  due_date?: string;
  received_date: string;
  status: SupplierInvoiceStatus;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  currency: Currency;
  paid_amount: number;
  balance_due: number;
  document_url?: string;
  notes?: string;
  journal_entry_id?: string;
  expense_category?: string;
  account_code?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined
  supplier?: Supplier;
  lines?: SupplierInvoiceLine[];
}

export interface SupplierInvoiceLine {
  id: string;
  supplier_invoice_id: string;
  description: string;
  quantity: number;
  unit_price?: number;
  vat_rate: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  account_code?: string;
  line_order: number;
  created_at: string;
}

export interface SupplierInvoiceInput {
  supplier_id?: string;
  daf_document_id?: string;
  invoice_number?: string;
  reference?: string;
  invoice_date?: string;
  due_date?: string;
  received_date?: string;
  notes?: string;
  expense_category?: string;
  account_code?: string;
  lines?: SupplierInvoiceLineInput[];
}

export interface SupplierInvoiceLineInput {
  description: string;
  quantity?: number;
  unit_price?: number;
  vat_rate?: number;
  total_ht: number;
  account_code?: string;
}

// =============================================================================
// Expenses
// =============================================================================

export type ExpenseStatus = 'pending' | 'validated' | 'rejected' | 'reimbursed';

export interface Expense {
  id: string;
  org_id: string;
  supplier_id?: string;
  description: string;
  amount: number;
  currency: Currency;
  expense_date: string;
  category?: string;
  subcategory?: string;
  payment_method: PaymentMethod;
  is_paid: boolean;
  vat_amount: number;
  is_deductible: boolean;
  receipt_url?: string;
  account_code?: string;
  journal_entry_id?: string;
  status: ExpenseStatus;
  is_recurring: boolean;
  recurrence_pattern?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined
  supplier?: Supplier;
}

export interface ExpenseInput {
  supplier_id?: string;
  description: string;
  amount: number;
  currency?: Currency;
  expense_date?: string;
  category?: string;
  subcategory?: string;
  payment_method?: PaymentMethod;
  is_paid?: boolean;
  vat_amount?: number;
  is_deductible?: boolean;
  receipt_url?: string;
  account_code?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
}

// =============================================================================
// Expense Receipts (Notes de frais)
// =============================================================================

export type ExpenseReceiptStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';

export interface ExpenseReceipt {
  id: string;
  org_id: string;
  user_id: string;
  description: string;
  amount: number;
  currency: Currency;
  expense_date: string;
  category?: string;
  receipt_url?: string;
  status: ExpenseReceiptStatus;
  validated_by?: string;
  validated_at?: string;
  rejection_reason?: string;
  reimbursed_at?: string;
  reimbursement_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseReceiptInput {
  description: string;
  amount: number;
  currency?: Currency;
  expense_date: string;
  category?: string;
  receipt_url?: string;
}

// =============================================================================
// Accounting
// =============================================================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface ChartOfAccount {
  id: string;
  org_id: string;
  code: string;
  label: string;
  description?: string;
  account_type: AccountType;
  category?: string;
  parent_code?: string;
  level: number;
  accounting_standard: AccountingStandard;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

export type JournalCode = 'VE' | 'AC' | 'BQ' | 'OD' | 'GEN';

export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';

export interface JournalEntry {
  id: string;
  org_id: string;
  journal_code: JournalCode;
  entry_number?: string;
  entry_date: string;
  reference?: string;
  description?: string;
  total_debit: number;
  total_credit: number;
  source_type?: string;
  source_id?: string;
  status: JournalEntryStatus;
  posted_at?: string;
  created_at: string;
  created_by?: string;
  // Joined
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_code: string;
  debit: number;
  credit: number;
  description?: string;
  client_id?: string;
  supplier_id?: string;
  line_order: number;
  created_at: string;
}

export interface JournalEntryInput {
  journal_code?: JournalCode;
  entry_date?: string;
  reference?: string;
  description?: string;
  source_type?: string;
  source_id?: string;
  lines: JournalLineInput[];
}

export interface JournalLineInput {
  account_code: string;
  debit?: number;
  credit?: number;
  description?: string;
  client_id?: string;
  supplier_id?: string;
}

// =============================================================================
// Settings
// =============================================================================

export interface ERPSettings {
  id: string;
  org_id: string;
  company_name?: string;
  legal_name?: string;
  vat_number?: string;
  siret?: string;
  ein?: string;
  address?: Address;
  bank_details?: BankDetails;
  invoice_prefix: string;
  invoice_next_number: number;
  estimate_prefix: string;
  estimate_next_number: number;
  default_currency: Currency;
  default_vat_rate: number;
  default_payment_terms: number;
  accounting_standard: AccountingStandard;
  fiscal_year_start: number;
  country: string;
  language: string;
  date_format: string;
  enable_estimates: boolean;
  enable_expense_receipts: boolean;
  enable_auto_accounting: boolean;
  created_at: string;
  updated_at: string;
}

export interface ERPSettingsInput {
  company_name?: string;
  legal_name?: string;
  vat_number?: string;
  siret?: string;
  ein?: string;
  address?: Address;
  bank_details?: BankDetails;
  invoice_prefix?: string;
  estimate_prefix?: string;
  default_currency?: Currency;
  default_vat_rate?: number;
  default_payment_terms?: number;
  accounting_standard?: AccountingStandard;
  fiscal_year_start?: number;
  country?: string;
  language?: string;
  date_format?: string;
  enable_estimates?: boolean;
  enable_expense_receipts?: boolean;
  enable_auto_accounting?: boolean;
}

// =============================================================================
// KPIs & Dashboard
// =============================================================================

export interface ERPDashboardKPIs {
  // Revenue
  total_revenue_mtd: number;
  total_revenue_ytd: number;
  revenue_change_percent: number;

  // Expenses
  total_expenses_mtd: number;
  total_expenses_ytd: number;
  expenses_change_percent: number;

  // Profit
  profit_mtd: number;
  profit_ytd: number;

  // Receivables
  total_receivables: number;
  overdue_receivables: number;
  receivables_count: number;

  // Payables
  total_payables: number;
  overdue_payables: number;
  payables_count: number;

  // Cash
  estimated_cash_balance: number;
  cashflow_30days: number;
}

export interface TopClient {
  client_id: string;
  client_name: string;
  total_invoiced: number;
  invoice_count: number;
}

export interface TopSupplier {
  supplier_id: string;
  supplier_name: string;
  total_purchased: number;
  invoice_count: number;
}

export interface MonthlyRevenue {
  month: string;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface CashflowForecast {
  date: string;
  expected_inflows: number;
  expected_outflows: number;
  running_balance: number;
}
