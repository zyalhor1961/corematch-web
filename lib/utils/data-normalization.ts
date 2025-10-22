/**
 * Utilitaires de normalisation et masquage de données pour l'analyse CV
 */

/**
 * Normalise une compétence pour matching (lowercase, sans accents, sans espaces multiples)
 */
export function normalizeSkill(skill: string): string {
  if (!skill) return '';

  return skill
    .toLowerCase()
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9\s]/g, ' ') // Remplace caractères spéciaux par espaces
    .replace(/\s+/g, ' ') // Normalise espaces multiples
    .trim();
}

/**
 * Normalise un numéro de téléphone au format E.164
 * Corrige les formats incorrects comme "+33) ..." et normalise vers +33XXXXXXXXX
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Nettoyer le numéro: garder seulement chiffres et + initial
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Si commence par 00, remplacer par +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // Si ne commence pas par +, ajouter +33 pour numéros français
  if (!cleaned.startsWith('+')) {
    // Si commence par 0, supprimer le 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+33' + cleaned;
  }

  // Valider format E.164 basique: +[1-3 chiffres indicatif][4-14 chiffres]
  const e164Pattern = /^\+[1-9]\d{1,14}$/;
  if (!e164Pattern.test(cleaned)) {
    return phone; // Retourner original si invalide
  }

  return cleaned;
}

/**
 * Masque les informations personnelles (PII) dans les logs
 * - Email: affiche seulement première lettre et domaine
 * - Téléphone: affiche seulement 4 derniers chiffres
 */
export function maskPII(text: string): string {
  if (!text) return '';

  let masked = text;

  // Masquer emails: john.doe@example.com → j***@example.com
  masked = masked.replace(
    /\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    '$1***@$2'
  );

  // Masquer téléphones: +33123456789 → +33******789
  masked = masked.replace(
    /(\+?\d{1,3})\d{5,11}(\d{3})/g,
    '$1******$2'
  );

  return masked;
}

/**
 * Détecte si un texte contient un diplôme FLE
 * Retourne le diplôme détecté ou null
 */
export function detectFLEDiploma(text: string): string | null {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  // Diplômes FLE reconnus (par ordre de priorité)
  const diplomas = [
    { pattern: /master.*fle|m2.*fle|master 2.*fle/i, name: 'Master FLE (M2)' },
    { pattern: /master.*didactique.*langues|m2.*didactique/i, name: 'Master Didactique des Langues' },
    { pattern: /daefle/i, name: 'DAEFLE (Alliance Française)' },
    { pattern: /dufle/i, name: 'DUFLE' },
    { pattern: /licence.*fle|l3.*fle/i, name: 'Licence FLE' },
    { pattern: /du.*fle/i, name: 'DU FLE' }
  ];

  for (const diploma of diplomas) {
    if (diploma.pattern.test(lowerText)) {
      return diploma.name;
    }
  }

  return null;
}

/**
 * Détecte les diplômes FLE dans les formations d'un CV
 * Retourne la liste des diplômes détectés avec leurs preuves
 */
export function detectFLEDiplomasInCV(formations: any[]): Array<{ diploma: string; quote: string; field_path: string }> {
  if (!formations || !Array.isArray(formations)) return [];

  const detected: Array<{ diploma: string; quote: string; field_path: string }> = [];

  formations.forEach((formation, index) => {
    const intitule = formation.intitule || '';
    const etablissement = formation.etablissement || '';
    const combinedText = `${intitule} ${etablissement}`;

    const diploma = detectFLEDiploma(combinedText);
    if (diploma) {
      detected.push({
        diploma,
        quote: intitule || combinedText,
        field_path: `formations[${index}].intitule`
      });
    }
  });

  return detected;
}
