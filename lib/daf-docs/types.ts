/**
 * Types pour DAF Docs Assistant
 */

// Types de documents reconnus
export type DocumentType =
  | 'facture'
  | 'releve_bancaire'
  | 'contrat'
  | 'assurance'
  | 'note_frais'
  | 'autre';

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

  // Classification
  doc_type: DocumentType;
  fournisseur?: string;

  // Extraction
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

// Statistiques documents
export interface DAFStats {
  total_documents: number;
  total_factures: number;
  total_valides: number;
  total_en_attente: number;
  montant_total_ttc: number;
  nombre_fournisseurs: number;
}
