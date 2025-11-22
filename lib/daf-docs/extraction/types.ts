/**
 * Types pour l'extraction de documents DAF
 * Two-level extraction strategy:
 * - Level 1: Generic extraction (prebuilt-document) for ALL documents
 * - Level 2: Invoice-specific extraction (prebuilt-invoice) only for invoices
 */

export type DocumentType = 'invoice' | 'contract' | 'cv' | 'report' | 'other';

export interface FieldBoundingBox {
  field: string;
  page: number;
  polygon: number[]; // [x1, y1, x2, y2, ...] in Azure inches
  text: string;
  confidence?: number;
}

/**
 * Level 1: Generic extraction result (works for ALL document types)
 * Uses prebuilt-document model
 */
export interface GenericExtractionResult {
  success: boolean;
  provider: 'azure-di';

  // Full text content for RAG/embeddings
  full_text: string;

  // Page-level information
  pages: Array<{
    page_number: number;
    width: number;
    height: number;
    unit: string;
    lines?: Array<{
      content: string;
      polygon?: number[];
    }>;
  }>;

  // Tables extracted from document
  tables?: Array<{
    row_count: number;
    column_count: number;
    cells: Array<{
      row_index: number;
      column_index: number;
      content: string;
      kind?: string;
    }>;
  }>;

  // Document type detection
  detected_type: DocumentType;
  type_confidence: number;

  // Metadata
  extraction_duration_ms: number;
  error?: string;
}

/**
 * Level 2: Invoice-specific extraction result (only for invoices)
 * Uses prebuilt-invoice model
 */
export interface DAFExtractionResult {
  success: boolean;
  provider: 'landing-ai' | 'azure-di' | 'simple-text';
  confidence: number; // 0-1

  // === Level 1: Generic data (always present) ===
  document_type?: DocumentType;
  full_text?: string; // Full text for RAG/embeddings
  pages?: GenericExtractionResult['pages'];
  tables?: GenericExtractionResult['tables'];

  // === Level 2: Invoice-specific fields (only for invoices) ===
  // Champs extraits - Base
  montant_ht?: number;
  montant_ttc?: number;
  taux_tva?: number;
  date_document?: string; // ISO date
  date_echeance?: string; // ISO date
  numero_facture?: string;
  fournisseur?: string;

  // Champs extraits - Additionnels
  client?: string;
  adresse_fournisseur?: string;
  adresse_client?: string;
  email_fournisseur?: string;
  email_client?: string;
  numero_commande?: string;
  conditions_paiement?: string;
  items?: Array<{
    description?: string;
    quantite?: number;
    prix_unitaire?: number;
    montant?: number;
  }>;

  // Positions des champs (pour bounding boxes)
  field_positions?: FieldBoundingBox[];

  // Métadonnées
  extraction_duration_ms: number;
  raw_response?: any;
  error?: string;
}

export interface DAFExtractor {
  name: string;

  /**
   * Main extraction method using two-level strategy:
   * 1. Generic extraction for all documents
   * 2. Invoice-specific extraction only if document is an invoice
   */
  extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult>;

  /**
   * Level 1: Generic extraction using prebuilt-document
   * Works for ALL document types (CV, contracts, invoices, etc.)
   */
  extractGeneric?(fileBuffer: ArrayBuffer, fileName: string): Promise<GenericExtractionResult>;

  /**
   * Level 2: Invoice-specific extraction using prebuilt-invoice
   * Only called if document is detected as an invoice
   */
  extractInvoice?(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult>;
}

export interface DAFExtractionConfig {
  primaryProvider: 'landing-ai' | 'azure-di';
  fallbackProvider: 'landing-ai' | 'azure-di' | null;
  timeout: number; // ms
}
