/**
 * Tests pour config/
 */

import {
  ANALYSIS_MODES,
  getModeConfig,
  estimateCost,
  isValidMode,
  PROVIDER_CONFIGS,
  getProviderConfig,
  getProvidersForMode,
  normalizeWeights,
  calculateProviderCost,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  getDomainConfig,
  detectDomain,
  mergeConfig,
} from '../config';

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

console.log('\n🧪 Testing config/\n');

// ============================================================================
// Test: ANALYSIS_MODES
// ============================================================================
console.log('⚙️ Testing ANALYSIS_MODES');

assert(ANALYSIS_MODES.eco !== undefined, 'ANALYSIS_MODES.eco exists');
assert(ANALYSIS_MODES.balanced !== undefined, 'ANALYSIS_MODES.balanced exists');
assert(ANALYSIS_MODES.premium !== undefined, 'ANALYSIS_MODES.premium exists');

assertEquals(ANALYSIS_MODES.eco.providers_count, 1, 'Éco mode uses 1 provider');
assert(!ANALYSIS_MODES.eco.uses_arbiter, 'Éco mode does not use arbiter');

assertEquals(ANALYSIS_MODES.balanced.providers_count, 1, 'Balanced mode starts with 1 provider');
assert(ANALYSIS_MODES.balanced.uses_arbiter, 'Balanced mode can use arbiter');

assertEquals(ANALYSIS_MODES.premium.providers_count, 3, 'Premium mode uses 3 providers');
assert(ANALYSIS_MODES.premium.uses_arbiter, 'Premium mode always uses arbiter');

// ============================================================================
// Test: getModeConfig
// ============================================================================
console.log('\n⚙️ Testing getModeConfig()');

const ecoConfig = getModeConfig('eco');
assertEquals(ecoConfig.mode, 'eco', 'getModeConfig() returns correct mode');
assert(ecoConfig.estimated_cost_multiplier === 1.0, 'Éco has multiplier 1.0');

const premiumConfig = getModeConfig('premium');
assert(premiumConfig.estimated_cost_multiplier > 3.0, 'Premium has higher multiplier');

// ============================================================================
// Test: estimateCost
// ============================================================================
console.log('\n⚙️ Testing estimateCost()');

const ecoCost = estimateCost('eco', 100, 0.05);
assertEquals(ecoCost.perCV, 0.05, 'Éco cost per CV is base cost');
assertEquals(ecoCost.total, 5.0, 'Éco total cost for 100 CVs');

const premiumCost = estimateCost('premium', 100, 0.05);
assert(premiumCost.perCV > 0.15, 'Premium cost per CV is higher');
assert(premiumCost.total > 15.0, 'Premium total cost is higher');

// ============================================================================
// Test: isValidMode
// ============================================================================
console.log('\n⚙️ Testing isValidMode()');

assert(isValidMode('eco'), 'isValidMode() accepts "eco"');
assert(isValidMode('balanced'), 'isValidMode() accepts "balanced"');
assert(isValidMode('premium'), 'isValidMode() accepts "premium"');
assert(!isValidMode('invalid'), 'isValidMode() rejects invalid mode');
assert(!isValidMode('ECO'), 'isValidMode() rejects wrong case');

// ============================================================================
// Test: PROVIDER_CONFIGS
// ============================================================================
console.log('\n🔌 Testing PROVIDER_CONFIGS');

assert(PROVIDER_CONFIGS.openai !== undefined, 'PROVIDER_CONFIGS.openai exists');
assert(PROVIDER_CONFIGS.gemini !== undefined, 'PROVIDER_CONFIGS.gemini exists');
assert(PROVIDER_CONFIGS.claude !== undefined, 'PROVIDER_CONFIGS.claude exists');

assertEquals(PROVIDER_CONFIGS.openai.name, 'openai', 'OpenAI config has correct name');
assertEquals(PROVIDER_CONFIGS.openai.temperature, 0, 'OpenAI uses temperature 0');

// ============================================================================
// Test: getProviderConfig
// ============================================================================
console.log('\n🔌 Testing getProviderConfig()');

const openaiConfig = getProviderConfig('openai');
assertEquals(openaiConfig.name, 'openai', 'getProviderConfig() returns correct config');
assert(openaiConfig.weight > 0, 'Provider has weight');

// ============================================================================
// Test: getProvidersForMode
// ============================================================================
console.log('\n🔌 Testing getProvidersForMode()');

const ecoProviders = getProvidersForMode('eco');
assertEquals(ecoProviders.length, 1, 'Éco mode has 1 provider');
assert(ecoProviders.includes('openai'), 'Éco mode uses OpenAI');

const balancedProviders = getProvidersForMode('balanced');
assertEquals(balancedProviders.length, 2, 'Balanced mode has 2 providers');

const premiumProviders = getProvidersForMode('premium');
assertEquals(premiumProviders.length, 3, 'Premium mode has 3 providers');
assert(premiumProviders.includes('openai'), 'Premium includes OpenAI');
assert(premiumProviders.includes('gemini'), 'Premium includes Gemini');
assert(premiumProviders.includes('claude'), 'Premium includes Claude');

// ============================================================================
// Test: normalizeWeights
// ============================================================================
console.log('\n🔌 Testing normalizeWeights()');

const weights1 = normalizeWeights(['openai']);
assertEquals(weights1.openai, 1.0, 'Single provider gets weight 1.0');

const weights2 = normalizeWeights(['openai', 'gemini']);
assert(weights2.openai > 0 && weights2.openai < 1, 'Normalized weight < 1');
assert(weights2.gemini > 0 && weights2.gemini < 1, 'Normalized weight < 1');
const sum = weights2.openai + weights2.gemini;
assert(Math.abs(sum - 1.0) < 0.001, 'Normalized weights sum to 1.0');

// ============================================================================
// Test: calculateProviderCost
// ============================================================================
console.log('\n🔌 Testing calculateProviderCost()');

const cost1 = calculateProviderCost('openai', 'gpt-4o', 1000, 500);
assert(cost1 > 0, 'calculateProviderCost() returns positive cost');
assert(cost1 < 0.01, 'Cost for 1500 tokens is reasonable');

const cost2 = calculateProviderCost('openai', 'gpt-4o-mini', 1000, 500);
assert(cost2 < cost1, 'gpt-4o-mini is cheaper than gpt-4o');

// ============================================================================
// Test: DEFAULT_WEIGHTS and DEFAULT_THRESHOLDS
// ============================================================================
console.log('\n⚖️ Testing DEFAULT_WEIGHTS and DEFAULT_THRESHOLDS');

assertEquals(DEFAULT_WEIGHTS.w_exp, 0.5, 'Default experience weight is 50%');
assertEquals(DEFAULT_WEIGHTS.w_skills, 0.3, 'Default skills weight is 30%');
assertEquals(DEFAULT_WEIGHTS.w_nice, 0.2, 'Default nice-to-have weight is 20%');

const totalWeight = DEFAULT_WEIGHTS.w_exp + DEFAULT_WEIGHTS.w_skills + DEFAULT_WEIGHTS.w_nice;
assert(Math.abs(totalWeight - 1.0) < 0.001, 'Default weights sum to 1.0');

assertEquals(DEFAULT_THRESHOLDS.years_full_score, 3, 'Default years for full score is 3');
assertEquals(DEFAULT_THRESHOLDS.shortlist_min, 75, 'Default shortlist threshold is 75');
assertEquals(DEFAULT_THRESHOLDS.consider_min, 60, 'Default consider threshold is 60');

// ============================================================================
// Test: getDomainConfig
// ============================================================================
console.log('\n🏢 Testing getDomainConfig()');

const techConfig = getDomainConfig('tech');
assertEquals(techConfig.domain, 'tech', 'getDomainConfig() returns correct domain');
assert(techConfig.weights.w_skills > 0.4, 'Tech domain valorizes skills');

const teachingConfig = getDomainConfig('teaching');
assert(teachingConfig.weights.w_exp > 0.5, 'Teaching domain valorizes experience');

const defaultConfig = getDomainConfig('unknown');
assertEquals(defaultConfig.domain, 'default', 'Unknown domain returns default');

const noConfig = getDomainConfig();
assertEquals(noConfig.domain, 'default', 'No domain returns default');

// ============================================================================
// Test: detectDomain
// ============================================================================
console.log('\n🏢 Testing detectDomain()');

assertEquals(detectDomain('Développeur Full Stack'), 'tech', 'detectDomain() detects tech');
assertEquals(detectDomain('Professeur de FLE'), 'teaching', 'detectDomain() detects teaching');
assertEquals(detectDomain('Peintre en bâtiment'), 'construction', 'detectDomain() detects construction');
assertEquals(detectDomain('Manager de projet'), 'management', 'detectDomain() detects management');
assertEquals(detectDomain('Infirmier'), 'healthcare', 'detectDomain() detects healthcare');
assertEquals(detectDomain('Autre métier'), 'default', 'detectDomain() returns default for unknown');

// ============================================================================
// Test: mergeConfig
// ============================================================================
console.log('\n🏢 Testing mergeConfig()');

const merged1 = mergeConfig('tech');
assert(merged1.weights.w_skills > 0.4, 'mergeConfig() uses domain config');

const merged2 = mergeConfig('tech', { w_exp: 0.6 });
assertEquals(merged2.weights.w_exp, 0.6, 'mergeConfig() overrides with custom weights');

const merged3 = mergeConfig('tech', undefined, { shortlist_min: 80 });
assertEquals(merged3.thresholds.shortlist_min, 80, 'mergeConfig() overrides thresholds');

const merged4 = mergeConfig();
assertEquals(merged4.weights.w_exp, DEFAULT_WEIGHTS.w_exp, 'mergeConfig() with no args uses defaults');

console.log('\n✅ All config tests passed!\n');
