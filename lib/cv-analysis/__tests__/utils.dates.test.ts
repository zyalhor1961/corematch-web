/**
 * Tests pour utils/dates.ts
 */

import {
  getAnalysisDate,
  toYearMonth,
  parseYearMonth,
  normalizeEndDate,
  calculateMonths,
  mergePeriods,
  calculateTotalMonths,
  periodsOverlap,
  isValidYearMonth,
  yearsFromDate,
  formatDuration,
} from '../utils/dates';

// Helper pour les assertions
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ ${message}`);
  }
  console.log(`✅ ${message}`);
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`❌ ${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
  }
  console.log(`✅ ${message}`);
}

console.log('\n🧪 Testing utils/dates.ts\n');

// ============================================================================
// Test: getAnalysisDate
// ============================================================================
console.log('📅 Testing getAnalysisDate()');
const analysisDate = getAnalysisDate();
assert(/^\d{4}-\d{2}-\d{2}$/.test(analysisDate), 'getAnalysisDate() returns YYYY-MM-DD format');

// ============================================================================
// Test: toYearMonth
// ============================================================================
console.log('\n📅 Testing toYearMonth()');
assertEquals(toYearMonth('2024-01-15'), '2024-01', 'toYearMonth() converts YYYY-MM-DD to YYYY-MM');
assertEquals(toYearMonth('2023-12-31'), '2023-12', 'toYearMonth() handles end of year');

// ============================================================================
// Test: parseYearMonth
// ============================================================================
console.log('\n📅 Testing parseYearMonth()');
const parsed = parseYearMonth('2024-03');
assertEquals(parsed.getFullYear(), 2024, 'parseYearMonth() extracts year correctly');
assertEquals(parsed.getMonth(), 2, 'parseYearMonth() extracts month correctly (0-indexed)');

// ============================================================================
// Test: normalizeEndDate
// ============================================================================
console.log('\n📅 Testing normalizeEndDate()');
assertEquals(normalizeEndDate(null), null, 'normalizeEndDate(null) returns null');
assertEquals(normalizeEndDate('en cours'), null, 'normalizeEndDate("en cours") returns null');
assertEquals(normalizeEndDate('présent'), null, 'normalizeEndDate("présent") returns null');
assertEquals(normalizeEndDate('2024-06'), '2024-06', 'normalizeEndDate() preserves valid dates');
assert(
  normalizeEndDate('INFORMATION_MANQUANTE', '2024-01-15')?.startsWith('2024-'),
  'normalizeEndDate("INFORMATION_MANQUANTE") uses analysis date'
);

// ============================================================================
// Test: calculateMonths
// ============================================================================
console.log('\n📅 Testing calculateMonths()');
assertEquals(calculateMonths('2020-01', '2020-12', '2025-01-24'), 12, 'calculateMonths() for 1 year');
assertEquals(calculateMonths('2020-01', '2023-01', '2025-01-24'), 37, 'calculateMonths() for 3 years');
assertEquals(calculateMonths('2023-06', '2023-08', '2025-01-24'), 3, 'calculateMonths() for 3 months');
assert(
  calculateMonths('2020-01', null, '2024-12-31') > 50,
  'calculateMonths() with null end date uses analysis date'
);
assertEquals(calculateMonths('INFORMATION_MANQUANTE', '2024-12', '2025-01-24'), 0, 'calculateMonths() returns 0 for invalid start');

// ============================================================================
// Test: isValidYearMonth
// ============================================================================
console.log('\n📅 Testing isValidYearMonth()');
assert(isValidYearMonth('2024-01'), 'isValidYearMonth() accepts valid date');
assert(isValidYearMonth('2023-12'), 'isValidYearMonth() accepts December');
assert(!isValidYearMonth('2024-13'), 'isValidYearMonth() rejects month > 12');
assert(!isValidYearMonth('2024-00'), 'isValidYearMonth() rejects month 0');
assert(!isValidYearMonth('24-01'), 'isValidYearMonth() rejects short year');
assert(!isValidYearMonth('2024/01'), 'isValidYearMonth() rejects wrong separator');

// ============================================================================
// Test: mergePeriods
// ============================================================================
console.log('\n📅 Testing mergePeriods()');

const periods1 = [
  { start: '2020-01', end: '2020-06' },
  { start: '2020-05', end: '2020-12' }, // Overlap with first
];
const merged1 = mergePeriods(periods1, '2025-01-24');
assertEquals(merged1.length, 1, 'mergePeriods() merges overlapping periods');
assertEquals(merged1[0].start, '2020-01', 'mergePeriods() keeps earliest start');
assertEquals(merged1[0].end, '2020-12', 'mergePeriods() keeps latest end');

const periods2 = [
  { start: '2020-01', end: '2020-06' },
  { start: '2021-01', end: '2021-06' }, // No overlap
];
const merged2 = mergePeriods(periods2, '2025-01-24');
assertEquals(merged2.length, 2, 'mergePeriods() keeps separate non-overlapping periods');

const periods3 = [
  { start: '2020-01', end: null }, // En cours
  { start: '2021-01', end: '2021-06' },
];
const merged3 = mergePeriods(periods3, '2025-01-24');
assertEquals(merged3.length, 1, 'mergePeriods() handles "en cours" (null) correctly');

// ============================================================================
// Test: calculateTotalMonths
// ============================================================================
console.log('\n📅 Testing calculateTotalMonths()');
const periodsTotal = [
  { start: '2020-01', end: '2020-06' }, // 6 months
  { start: '2021-01', end: '2021-06' }, // 6 months
];
assertEquals(calculateTotalMonths(periodsTotal, '2025-01-24'), 12, 'calculateTotalMonths() sums non-overlapping periods');

const periodsOverlapping = [
  { start: '2020-01', end: '2020-06' }, // 6 months
  { start: '2020-05', end: '2020-12' }, // Overlaps → merged to 12 months
];
assertEquals(calculateTotalMonths(periodsOverlapping, '2025-01-24'), 12, 'calculateTotalMonths() handles overlaps');

// ============================================================================
// Test: periodsOverlap
// ============================================================================
console.log('\n📅 Testing periodsOverlap()');
assert(
  periodsOverlap(
    { start: '2020-01', end: '2020-06' },
    { start: '2020-05', end: '2020-12' },
    '2025-01-24'
  ),
  'periodsOverlap() detects overlap'
);
assert(
  !periodsOverlap(
    { start: '2020-01', end: '2020-06' },
    { start: '2021-01', end: '2021-06' },
    '2025-01-24'
  ),
  'periodsOverlap() detects no overlap'
);
assert(
  periodsOverlap(
    { start: '2020-01', end: null }, // En cours
    { start: '2023-01', end: '2023-06' },
    '2025-01-24'
  ),
  'periodsOverlap() handles "en cours" correctly'
);

// ============================================================================
// Test: yearsFromDate
// ============================================================================
console.log('\n📅 Testing yearsFromDate()');
const years1 = yearsFromDate('2020-01', '2023-01', '2025-01-24');
assert(Math.abs(years1 - 3.08) < 0.1, 'yearsFromDate() calculates years correctly');

const years2 = yearsFromDate('2023-01', '2023-07', '2025-01-24');
assert(Math.abs(years2 - 0.58) < 0.1, 'yearsFromDate() calculates fractional years');

// ============================================================================
// Test: formatDuration
// ============================================================================
console.log('\n📅 Testing formatDuration()');
assertEquals(formatDuration(12), '1 an', 'formatDuration() formats 1 year');
assertEquals(formatDuration(24), '2 ans', 'formatDuration() formats 2 years');
assertEquals(formatDuration(6), '6 mois', 'formatDuration() formats months only');
assertEquals(formatDuration(18), '1 an 6 mois', 'formatDuration() formats years + months');
assertEquals(formatDuration(30), '2 ans 6 mois', 'formatDuration() formats multiple years + months');

console.log('\n✅ All dates tests passed!\n');
