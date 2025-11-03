/**
 * Types pour l'extraction de documents DAF
 */

export interface DAFExtractionResult {
  success: boolean;
  provider: 'landing-ai' | 'azure-di';
  confidence: number; // 0-1

  // Champs extraits
  montant_ht?: number;
  montant_ttc?: number;
  taux_tva?: number;
  date_document?: string; // ISO date
  date_echeance?: string; // ISO date
  numero_facture?: string;
  fournisseur?: string;

  // Métadonnées
  extraction_duration_ms: number;
  raw_response?: any;
  error?: string;
}

export interface DAFExtractor {
  name: string;
  extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult>;
}

export interface DAFExtractionConfig {
  primaryProvider: 'landing-ai' | 'azure-di';
  fallbackProvider: 'landing-ai' | 'azure-di' | null;
  timeout: number; // ms
}
