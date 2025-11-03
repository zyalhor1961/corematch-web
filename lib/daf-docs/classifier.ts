/**
 * Classification automatique de documents DAF
 *
 * Phase 0: Règles simples basées sur keywords
 * Phase 2+: ML avec embeddings
 */

import type { DocumentType, ClassificationResult } from './types';

/**
 * Base de connaissance: Keywords par type de document
 */
const CLASSIFICATION_RULES: Record<DocumentType, {
  keywords: string[];
  fournisseurs?: string[];
  priority: number; // 1 = haute priorité
}> = {
  facture: {
    keywords: [
      'facture', 'invoice', 'bill', 'fact', 'devis', 'quote',
      'montant', 'ttc', 'ht', 'tva', 'total', 'doit',
      'n°', 'numéro', 'échéance', 'paiement'
    ],
    priority: 1,
  },

  releve_bancaire: {
    keywords: [
      'relevé', 'statement', 'compte', 'bank', 'banc', 'banque',
      'iban', 'bic', 'solde', 'crédit', 'débit',
      'bnp', 'société générale', 'crédit agricole', 'lcl', 'banque postale'
    ],
    priority: 1,
  },

  contrat: {
    keywords: [
      'contrat', 'contract', 'convention', 'accord', 'agreement',
      'bail', 'lease', 'signature', 'parties', 'conditions générales',
      'cg', 'cgv', 'annexe'
    ],
    priority: 2,
  },

  assurance: {
    keywords: [
      'assurance', 'insurance', 'police', 'garantie', 'sinistre',
      'prime', 'cotisation', 'couverture', 'indemnité',
      'axa', 'allianz', 'generali', 'maif', 'macif', 'maaf'
    ],
    fournisseurs: ['axa', 'allianz', 'generali', 'maif', 'macif', 'maaf', 'mma'],
    priority: 1,
  },

  note_frais: {
    keywords: [
      'note de frais', 'expense', 'frais', 'remboursement',
      'déplacement', 'mission', 'taxi', 'restaurant', 'hôtel',
      'km', 'kilométrique'
    ],
    priority: 2,
  },

  autre: {
    keywords: [],
    priority: 3,
  },
};

/**
 * Fournisseurs courants et leurs variations
 */
const KNOWN_VENDORS = {
  // Énergie
  'edf': ['edf', 'électricité de france', 'electricite'],
  'engie': ['engie', 'gdf', 'gaz de france'],
  'enedis': ['enedis', 'erdf'],
  'total energies': ['total', 'total energies', 'totalenergies'],

  // Télécom
  'orange': ['orange', 'france telecom'],
  'sfr': ['sfr', 'société française du radiotéléphone'],
  'bouygues': ['bouygues', 'bouygues telecom'],
  'free': ['free', 'iliad'],

  // Assurances
  'axa': ['axa'],
  'allianz': ['allianz'],
  'generali': ['generali'],
  'maif': ['maif'],

  // Cloud/SaaS
  'microsoft': ['microsoft', 'ms', 'azure', 'office 365', 'o365'],
  'google': ['google', 'g suite', 'workspace'],
  'aws': ['aws', 'amazon web services'],
  'ovh': ['ovh', 'ovhcloud'],
};

/**
 * Normalise un nom de fournisseur
 */
function normalizeFournisseur(raw: string): string | undefined {
  const normalized = raw.toLowerCase().trim();

  for (const [canonical, variations] of Object.entries(KNOWN_VENDORS)) {
    if (variations.some(v => normalized.includes(v))) {
      return canonical.toUpperCase();
    }
  }

  // Sinon retourner le nom brut capitalisé
  return raw.trim().split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Classifie un document basé sur son nom de fichier
 *
 * @param fileName Nom du fichier (ex: "Facture_EDF_Mars_2025.pdf")
 * @param fileType MIME type (ex: "application/pdf")
 * @returns Classification avec confiance et raison
 */
export function classifyDocument(
  fileName: string,
  fileType?: string
): ClassificationResult {
  const searchText = fileName.toLowerCase();

  // Scores par type
  const scores: Record<DocumentType, number> = {
    facture: 0,
    releve_bancaire: 0,
    contrat: 0,
    assurance: 0,
    note_frais: 0,
    autre: 0,
  };

  // Calculer scores
  for (const [docType, config] of Object.entries(CLASSIFICATION_RULES)) {
    let score = 0;

    // Points pour keywords
    for (const keyword of config.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Bonus priorité
    score *= config.priority;

    scores[docType as DocumentType] = score;
  }

  // Trouver le meilleur score
  const sortedTypes = (Object.entries(scores) as [DocumentType, number][])
    .sort((a, b) => b[1] - a[1]);

  const [bestType, bestScore] = sortedTypes[0];

  // Si aucun match, c'est "autre"
  if (bestScore === 0) {
    return {
      doc_type: 'autre',
      confidence: 0.2,
      raison: 'Aucun mot-clé reconnu',
    };
  }

  // Calculer confiance (0-1)
  const maxPossibleScore = Math.max(...Object.values(scores));
  const confidence = Math.min(bestScore / (maxPossibleScore + 3), 0.95);

  // Détecter fournisseur
  let fournisseur: string | undefined;
  const fournisseurMatch = detectFournisseur(fileName);
  if (fournisseurMatch) {
    fournisseur = fournisseurMatch;
  }

  // Raison lisible
  const matchedKeywords = CLASSIFICATION_RULES[bestType].keywords
    .filter(k => searchText.includes(k.toLowerCase()))
    .slice(0, 3);

  const raison = matchedKeywords.length > 0
    ? `Détecté: ${matchedKeywords.join(', ')}`
    : `Classifié comme ${bestType}`;

  return {
    doc_type: bestType,
    confidence,
    fournisseur_detecte: fournisseur,
    raison,
  };
}

/**
 * Détecte le nom du fournisseur dans un nom de fichier
 */
export function detectFournisseur(fileName: string): string | undefined {
  const searchText = fileName.toLowerCase();

  for (const [canonical, variations] of Object.entries(KNOWN_VENDORS)) {
    for (const variation of variations) {
      if (searchText.includes(variation)) {
        return canonical.toUpperCase();
      }
    }
  }

  // Patterns courants
  // Ex: "Facture_ACME_Corp_2025.pdf" → "ACME Corp"
  const patterns = [
    /facture[_\s-]+([a-z0-9\s]+)/i,
    /invoice[_\s-]+([a-z0-9\s]+)/i,
    /([a-z0-9]+)[_\s-]+facture/i,
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].replace(/[_-]/g, ' ').trim();
      // Ignorer les mots génériques
      if (!['mars', 'avril', 'mai', 'juin', 'juillet', '2024', '2025'].includes(candidate.toLowerCase())) {
        return normalizeFournisseur(candidate);
      }
    }
  }

  return undefined;
}

/**
 * Améliore la classification avec plus de contexte
 * (Pour Phase 2: avec contenu OCR/extraction)
 */
export function classifyWithContent(
  fileName: string,
  extractedText?: string,
  fileType?: string
): ClassificationResult {
  // Pour l'instant, juste le nom de fichier
  // TODO Phase 2: analyser le contenu extrait
  return classifyDocument(fileName, fileType);
}
