/**
 * Types pour l'extraction de documents DAF
 */

export interface FieldBoundingBox {
  field: string;
  page: number;
  polygon: number[]; // [x1, y1, x2, y2, ...] in Azure inches
  text: string;
  confidence?: number;
}

export interface DAFExtractionResult {
  success: boolean;
  provider: 'landing-ai' | 'azure-di' | 'simple-text';
  confidence: number; // 0-1

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
  extractDocument(fileBuffer: ArrayBuffer, fileName: string): Promise<DAFExtractionResult>;
}

export interface DAFExtractionConfig {
  primaryProvider: 'landing-ai' | 'azure-di';
  fallbackProvider: 'landing-ai' | 'azure-di' | null;
  timeout: number; // ms
}
