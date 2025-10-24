/**
 * Types pour la structure CV
 * Extraction et normalisation des données candidat
 */

export interface CV_Identity {
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  linkedin?: string;
  github?: string;
}

export interface CV_Experience {
  index: number;
  titre: string;
  employeur?: string;
  date_debut?: string; // YYYY-MM or "INFORMATION_MANQUANTE"
  date_fin?: string | null; // YYYY-MM, "en cours", or null
  missions?: string[];
  lieu?: string;
  type_contrat?: string;
}

export interface CV_Formation {
  index: number;
  intitule: string;
  etablissement?: string;
  annee?: string; // YYYY or "INFORMATION_MANQUANTE"
  lieu?: string;
  niveau?: string;
}

export interface CV_Langue {
  langue: string;
  niveau?: string;
}

export interface CV_Certification {
  nom: string;
  organisme?: string;
  date?: string; // YYYY-MM
}

export interface CV_Projet {
  titre: string;
  description?: string;
  technologies?: string[];
  url?: string;
}

/**
 * Structure complète du CV extrait
 */
export interface CV_JSON {
  identite: CV_Identity;
  experiences: CV_Experience[];
  formations: CV_Formation[];
  competences: string[];
  langues?: CV_Langue[];
  certifications?: CV_Certification[];
  projets?: CV_Projet[];
  texte_brut?: string;
}

/**
 * Métadonnées d'extraction
 */
export interface CV_ExtractionMetadata {
  file_hash: string;
  extracted_at: string; // ISO 8601
  extractor_model: string;
  extraction_version: string;
  confidence_score?: number;
}
