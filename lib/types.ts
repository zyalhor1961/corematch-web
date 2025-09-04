export interface Organization {
  id: string;
  name: string;
  stripe_customer_id?: string;
  plan: 'starter' | 'pro' | 'scale';
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  trial_end_date?: string;
  created_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  role: 'org_admin' | 'org_manager' | 'org_viewer';
  invited_email?: string;
  created_at: string;
}

export interface MyOrg {
  org_id: string;
  user_id: string;
  role: 'org_admin' | 'org_manager' | 'org_viewer';
  org_name: string;
  plan: string;
  status: string;
  trial_end_date?: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  stripe_subscription_id?: string;
  plan: 'starter' | 'pro' | 'scale';
  status: 'active' | 'past_due' | 'canceled' | 'unpaid';
  current_period_end?: string;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  job_title?: string;
  requirements?: string;
  created_by?: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  project_id: string;
  org_id: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  cv_url?: string;
  cv_filename?: string;
  score?: number;
  explanation?: string;
  shortlisted: boolean;
  status: 'pending' | 'processing' | 'analyzed' | 'rejected';
  created_at: string;
}

export interface Document {
  id: string;
  org_id: string;
  doc_type: 'invoice' | 'delivery_note' | 'mixed';
  file_path?: string;
  filename?: string;
  supplier_name?: string;
  supplier_vat?: string;
  supplier_country?: string;
  supplier_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  delivery_note_number?: string;
  currency: string;
  incoterm?: string;
  transport_mode?: string;
  transport_document?: string;
  total_ht?: number;
  total_ttc?: number;
  shipping_total?: number;
  status: 'uploaded' | 'processing' | 'parsed' | 'enriched' | 'needs_review' | 'approved' | 'exported' | 'error';
  export_url?: string;
  pages_count: number;
  line_count?: number;
  confidence_avg?: number;
  created_by?: string;
  created_at: string;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  page_no: number;
  type?: 'invoice' | 'delivery_note' | 'other';
  confidence?: number;
  raw_ocr_data?: Record<string, unknown>;
  created_at: string;
}

export interface DocumentLine {
  id: string;
  document_id: string;
  line_no: number;
  description?: string;
  sku?: string;
  qty?: number;
  unit?: string;
  unit_price?: number;
  line_amount?: number;
  hs_code?: string;
  country_of_origin?: string;
  net_mass_kg?: number;
  shipping_allocated?: number;
  customs_value_line?: number;
  source_weight?: string;
  source_hs?: string;
  bl_links?: string[];
  pages_source?: number[];
  created_at: string;
}

export interface DocumentLink {
  id: string;
  document_id: string;
  linked_document_id: string;
  link_type: 'bl_invoice_match' | 'manual' | 'auto_detected';
  confidence: number;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface ExtractedDocumentData {
  document_type: 'invoice' | 'delivery_note' | 'mixed';
  confidence: number;
  pages_count: number;
  supplier_name: string;
  supplier_vat?: string;
  supplier_country?: string;
  supplier_address?: string;
  invoice_number?: string;
  invoice_date?: string;
  delivery_note_number?: string;
  total_ht?: number;
  total_ttc?: number;
  shipping_total?: number;
  currency: string;
  incoterm?: string;
  transport_mode?: string;
  lines?: ExtractedLineData[];
  additional_info?: {
    delivery_address?: string;
    purchase_order?: string;
    container_number?: string;
    transport_document?: string;
  };
}

export interface ExtractedLineData {
  line_no: number;
  description: string;
  sku?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_amount: number;
  hs_code?: string;
  country_of_origin?: string;
  net_mass_kg?: number;
  customs_value?: number;
}

export interface Product {
  id: string;
  org_id: string;
  sku: string;
  default_hs_code?: string;
  default_net_mass_kg?: number;
  default_unit?: string;
  description?: string;
  created_at: string;
}

export interface Job {
  id: string;
  document_id: string;
  stage: 'ocr' | 'classification' | 'extraction' | 'enrichment' | 'export';
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  progress: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  org_id: string;
  email: string;
  company?: string;
  source?: string;
  stage: 'new' | 'contacted' | 'qualified' | 'demo' | 'proposal' | 'won' | 'lost';
  score?: number;
  owner?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageCounter {
  id: string;
  org_id: string;
  period_month: string;
  cv_count: number;
  deb_pages_count: number;
  updated_at: string;
}

export interface PlanQuota {
  cv_monthly_quota: number;
  deb_pages_quota: number;
  multi_entities: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Stripe types
export interface StripeCheckoutRequest {
  orgId: string;
  plan: 'starter' | 'pro' | 'scale';
  successUrl?: string;
  cancelUrl?: string;
}

// Azure Document Intelligence types
export interface AzureOCRResult {
  status: string;
  pages: Array<{
    pageNumber: number;
    content: string;
    lines?: Array<{
      content: string;
      boundingBox: number[];
    }>;
    tables?: Array<{
      rowCount: number;
      columnCount: number;
      cells: Array<{
        content: string;
        rowIndex: number;
        columnIndex: number;
      }>;
    }>;
  }>;
  documents?: Array<{
    docType: string;
    confidence: number;
    fields: Record<string, {
      content: string;
      confidence: number;
    }>;
  }>;
}

// OpenAI types
export interface CVAnalysisResult {
  score: number;
  explanation: string;
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
}

export interface PageClassificationResult {
  pages: Array<{
    pageNumber: number;
    type: 'invoice' | 'delivery_note' | 'other';
    confidence: number;
  }>;
  segments: Array<{
    type: 'invoice' | 'delivery_note';
    pages: number[];
    identifier?: string;
  }>;
}

export interface ExtractionResult {
  supplier_name?: string;
  supplier_vat?: string;
  supplier_country?: string;
  invoice_number?: string;
  invoice_date?: string;
  currency?: string;
  incoterm?: string;
  total_ht?: number;
  shipping_total?: number;
  lines: Array<{
    line_no: number;
    description?: string;
    sku?: string;
    qty?: number;
    unit?: string;
    unit_price?: number;
    line_amount?: number;
    hs_code?: string;
    country_of_origin?: string;
    net_mass_kg?: number;
    pages_source?: number[];
  }>;
}