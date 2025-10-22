/**
 * Date utilities for calculating experience months
 */

/**
 * Parse ISO date string (YYYY-MM or YYYY-MM-DD) to Date
 */
export function parseISODate(isoString: string): Date {
  if (!isoString || isoString === 'INFORMATION_MANQUANTE') {
    return new Date();
  }

  // Handle YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(isoString)) {
    return new Date(`${isoString}-01`);
  }

  // Handle YYYY-MM-DD format
  return new Date(isoString);
}

/**
 * Calculate months between two dates
 */
export function monthsBetween(startISO: string, endISO: string | null, enCours: boolean = false): number {
  const start = parseISODate(startISO);
  const end = endISO ? parseISODate(endISO) : (enCours ? new Date() : new Date());

  const yearsDiff = end.getFullYear() - start.getFullYear();
  const monthsDiff = end.getMonth() - start.getMonth();

  return Math.max(0, yearsDiff * 12 + monthsDiff);
}

/**
 * Calculate union of overlapping periods
 * Returns total months without double-counting overlaps
 */
export function calculateUnionMonths(periods: Array<{ debut_iso: string; fin_iso: string | null; en_cours?: boolean }>): number {
  if (periods.length === 0) return 0;

  // Convert to timestamps for easier comparison
  const intervals = periods.map(p => ({
    start: parseISODate(p.debut_iso).getTime(),
    end: p.fin_iso ? parseISODate(p.fin_iso).getTime() : Date.now()
  }));

  // Sort by start date
  intervals.sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged: Array<{ start: number; end: number }> = [];
  let current = intervals[0];

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];

    if (next.start <= current.end) {
      // Overlap - merge
      current.end = Math.max(current.end, next.end);
    } else {
      // No overlap - push current and start new
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  // Calculate total months
  let totalMonths = 0;
  for (const interval of merged) {
    const start = new Date(interval.start);
    const end = new Date(interval.end);
    const yearsDiff = end.getFullYear() - start.getFullYear();
    const monthsDiff = end.getMonth() - start.getMonth();
    totalMonths += yearsDiff * 12 + monthsDiff;
  }

  return Math.max(0, totalMonths);
}

/**
 * Get current date in ISO format (YYYY-MM-DD)
 */
export function getCurrentDateISO(): string {
  return new Date().toISOString().split('T')[0];
}
