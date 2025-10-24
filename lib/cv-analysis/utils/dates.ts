/**
 * Utilitaires pour la gestion des dates
 * Union de périodes, calculs de mois, normalisation
 */

/**
 * Période avec début et fin
 */
export interface Period {
  start: string; // YYYY-MM
  end: string | null; // YYYY-MM or null for "en cours"
}

/**
 * Date d'analyse par défaut (aujourd'hui)
 * Format: YYYY-MM-DD
 */
export function getAnalysisDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convertir YYYY-MM-DD vers YYYY-MM
 */
export function toYearMonth(date: string): string {
  return date.substring(0, 7); // "2024-01-15" → "2024-01"
}

/**
 * Parser une date YYYY-MM en objet Date (1er jour du mois)
 */
export function parseYearMonth(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Normaliser une date_fin (gérer "en cours", "présent", null)
 */
export function normalizeEndDate(
  endDate: string | null | undefined,
  analysisDate?: string
): string | null {
  if (!endDate || endDate === 'null' || endDate === 'en cours' || endDate === 'présent') {
    return null; // null = en cours
  }

  // Si INFORMATION_MANQUANTE → utiliser la date d'analyse
  if (endDate === 'INFORMATION_MANQUANTE') {
    return toYearMonth(analysisDate || getAnalysisDate());
  }

  return endDate;
}

/**
 * Calculer le nombre de mois entre deux dates YYYY-MM
 * Si endDate est null, utilise la date d'analyse
 */
export function calculateMonths(
  startDate: string,
  endDate: string | null,
  analysisDate?: string
): number {
  if (!startDate || startDate === 'INFORMATION_MANQUANTE') {
    return 0;
  }

  const start = parseYearMonth(startDate);

  let end: Date;
  if (!endDate) {
    // En cours → utilise la date d'analyse
    const analysisYM = toYearMonth(analysisDate || getAnalysisDate());
    end = parseYearMonth(analysisYM);
  } else {
    end = parseYearMonth(endDate);
  }

  // Calcul de la différence en mois
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1; // +1 pour inclure le mois de début

  return Math.max(0, months);
}

/**
 * Fusionner des périodes qui se chevauchent
 * Algorithme: trier par date de début, puis merger les overlaps
 */
export function mergePeriods(periods: Period[], analysisDate?: string): Period[] {
  if (periods.length === 0) return [];

  // Normaliser les dates de fin (null = date d'analyse)
  const normalized = periods.map((p) => ({
    start: p.start,
    end: normalizeEndDate(p.end, analysisDate) || toYearMonth(analysisDate || getAnalysisDate()),
  }));

  // Trier par date de début
  const sorted = normalized.sort((a, b) => a.start.localeCompare(b.start));

  const merged: Period[] = [];
  let current = { start: sorted[0].start, end: sorted[0].end };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Si next commence avant la fin de current → merge
    if (next.start <= current.end) {
      // Étendre current jusqu'à la fin la plus tardive
      if (next.end > current.end) {
        current.end = next.end;
      }
    } else {
      // Pas de chevauchement → ajouter current et démarrer une nouvelle période
      merged.push({ start: current.start, end: current.end });
      current = { start: next.start, end: next.end };
    }
  }

  // Ajouter la dernière période
  merged.push({ start: current.start, end: current.end });

  return merged;
}

/**
 * Calculer le nombre total de mois pour un ensemble de périodes
 * (en gérant les chevauchements via merge)
 */
export function calculateTotalMonths(periods: Period[], analysisDate?: string): number {
  const merged = mergePeriods(periods, analysisDate);

  return merged.reduce((total, period) => {
    const months = calculateMonths(period.start, period.end, analysisDate);
    return total + months;
  }, 0);
}

/**
 * Vérifier si deux périodes se chevauchent
 */
export function periodsOverlap(p1: Period, p2: Period, analysisDate?: string): boolean {
  const p1End = normalizeEndDate(p1.end, analysisDate) || toYearMonth(analysisDate || getAnalysisDate());
  const p2End = normalizeEndDate(p2.end, analysisDate) || toYearMonth(analysisDate || getAnalysisDate());

  // p1 commence avant la fin de p2 ET p2 commence avant la fin de p1
  return p1.start <= p2End && p2.start <= p1End;
}

/**
 * Valider qu'une date est au format YYYY-MM
 */
export function isValidYearMonth(date: string): boolean {
  const regex = /^\d{4}-\d{2}$/;
  if (!regex.test(date)) return false;

  const [year, month] = date.split('-').map(Number);
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Obtenir le nombre d'années (float) depuis une date YYYY-MM
 */
export function yearsFromDate(startDate: string, endDate: string | null, analysisDate?: string): number {
  const months = calculateMonths(startDate, endDate, analysisDate);
  return months / 12;
}

/**
 * Formater une durée en mois vers "X ans Y mois"
 */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) {
    return `${months} mois`;
  }

  if (remainingMonths === 0) {
    return `${years} an${years > 1 ? 's' : ''}`;
  }

  return `${years} an${years > 1 ? 's' : ''} ${remainingMonths} mois`;
}
