/**
 * Types pour DAF Docs Assistant
 * Smart Document Hub - supports all document types
 */

// Legacy types (user-selected classification)
export type DocumentType =
  | 'facture'
  | 'releve_bancaire'
  | 'contrat'
  | 'assurance'
  | 'note_frais'
  | 'autre';

// AI-detected document types
export type AIDetectedType = 'invoice' | 'cv' | 'contract' | 'report' | 'other';

// Mapping AI types to display labels
export const AI_TYPE_LABELS: Record<AIDetectedType, { label: string; icon: string; color: string }> = {
  invoice: { label: 'Facture', icon: '🧾', color: 'blue' },
  cv: { label: 'CV', icon: '👤', color: 'purple' },
  contract: { label: 'Contrat', icon: '📜', color: 'amber' },
  report: { label: 'Rapport', icon: '📊', color: 'green' },
  other: { label: 'Autre', icon: '📄', color: 'slate' },
};

// Type-specific key info structures
export interface InvoiceKeyInfo {
  supplier?: string;
  amount?: number;
  date?: string;
  invoice_number?: string;
}

export interface CVKeyInfo {
  name?: string;
  title?: string;
  skills?: string[];
}

export interface ContractKeyInfo {
  parties?: string[];
  type?: string;
  renewal_date?: string;
}

export interface GenericKeyInfo {
  summary?: string;
  page_count?: number;
  table_count?: number;
}

export type KeyInfo = InvoiceKeyInfo | CVKeyInfo | ContractKeyInfo | GenericKeyInfo;

// Statuts du workflow
export type DocumentStatus =
  | 'uploaded'      // Juste uploadé
  | 'extracted'     // Extraction Azure DI terminée
  | 'validated'     // Validé par le DAF
  | 'exported'      // Exporté vers comptabilité
  | 'archived';     // Archivé de manière probante

// Sources d'ingestion
export type DocumentSource =
  | 'manual_upload'
  | 'email_imap'
  | 'drive_sync'
  | 'sftp';

// Document DAF (structure DB)
export interface DAFDocument {
  id: string;
  org_id: string;

  // Fichier
  file_name: string;
  file_path: string;
  file_url?: string;
  file_size_bytes?: number;
  file_type?: string;

  // Classification (legacy - user selected)
  doc_type: DocumentType;
  fournisseur?: string;

  // AI Detection (Smart Hub)
  ai_detected_type?: AIDetectedType;
  ai_confidence?: number;
  page_count?: number;
  table_count?: number;
  full_text?: string;
  key_info?: KeyInfo;

  // Extraction (invoice-specific)
  montant_ht?: number;
  montant_ttc?: number;
  taux_tva?: number;
  date_document?: string;
  date_echeance?: string;
  numero_facture?: string;

  // Comptabilité
  compte_propose?: string;
  axe_analytique?: string;

  // Extraction brute
  extraction_raw?: Record<string, any>;

  // Workflow
  status: DocumentStatus;
  source: DocumentSource;

  // Métadonnées
  notes?: string;
  tags?: string[];

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  validated_at?: string;
  validated_by?: string;
}

// Résultat de classification
export interface ClassificationResult {
  doc_type: DocumentType;
  confidence: number; // 0-1
  fournisseur_detecte?: string;
  raison: string;
}

// Statistiques documents (legacy)
export interface DAFStats {
  total_documents: number;
  total_factures: number;
  total_valides: number;
  total_en_attente: number;
  montant_total_ttc: number;
  nombre_fournisseurs: number;
}

// Smart Hub Statistics (v2)
export interface SmartHubStats {
  total_documents: number;
  // By AI-detected type
  total_invoices: number;
  total_cvs: number;
  total_contracts: number;
  total_reports: number;
  total_other: number;
  // By status
  total_validated: number;
  total_pending: number;
  total_extracted: number;
  // Financial (invoices only)
  montant_total_ttc: number;
  nombre_fournisseurs: number;
  // Attention needed
  needs_attention: number;
}
