/**
 * Tests pour utils/normalize.ts
 */

import {
  normalizeText,
  tokenize,
  removeStopWords,
  simpleLemmatize,
  normalizeSkill,
  skillsMatch,
  cleanText,
  extractKeywords,
  jaccardSimilarity,
  findMatchingSkills,
  countOccurrences,
} from '../utils/normalize';

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

console.log('\n🧪 Testing utils/normalize.ts\n');

// ============================================================================
// Test: normalizeText
// ============================================================================
console.log('📝 Testing normalizeText()');
assertEquals(normalizeText('Hello WORLD'), 'hello world', 'normalizeText() converts to lowercase');
assertEquals(normalizeText('Café'), 'cafe', 'normalizeText() removes accents');
assertEquals(normalizeText('  Spaces  '), 'spaces', 'normalizeText() trims spaces');
assertEquals(normalizeText('Développeur'), 'developpeur', 'normalizeText() handles French accents');
assertEquals(normalizeText('ÊTRE'), 'etre', 'normalizeText() handles uppercase with accents');

// ============================================================================
// Test: tokenize
// ============================================================================
console.log('\n📝 Testing tokenize()');
assertEquals(tokenize('Hello world'), ['hello', 'world'], 'tokenize() splits by spaces');
assertEquals(
  tokenize('React.js, Node.js'),
  ['react', 'js', 'node', 'js'],
  'tokenize() splits by punctuation'
);
const tokens3 = tokenize('Développeur (Full-Stack)');
assert(tokens3.includes('developpeur'), 'tokenize() handles accents');
assert(tokens3.includes('full-stack'), 'tokenize() preserves hyphens in compound words');

// ============================================================================
// Test: removeStopWords
// ============================================================================
console.log('\n📝 Testing removeStopWords()');
const tokens1 = ['le', 'développeur', 'et', 'la', 'base', 'de', 'données'];
assertEquals(
  removeStopWords(tokens1),
  ['développeur', 'base', 'données'],
  'removeStopWords() removes French stop words'
);

const tokens2 = ['avec', 'sans', 'pour', 'react', 'node'];
assertEquals(
  removeStopWords(tokens2),
  ['react', 'node'],
  'removeStopWords() keeps technical terms'
);

// ============================================================================
// Test: simpleLemmatize
// ============================================================================
console.log('\n📝 Testing simpleLemmatize()');
assertEquals(simpleLemmatize('développeurs'), 'developpeur', 'simpleLemmatize() removes plural');
assertEquals(simpleLemmatize('rapidement'), 'rapide', 'simpleLemmatize() removes -ment');
assertEquals(simpleLemmatize('formation'), 'forma', 'simpleLemmatize() removes -tion');
assertEquals(simpleLemmatize('développeur'), 'developp', 'simpleLemmatize() removes -eur');
assertEquals(simpleLemmatize('chat'), 'chat', 'simpleLemmatize() keeps short words unchanged');

// ============================================================================
// Test: normalizeSkill
// ============================================================================
console.log('\n📝 Testing normalizeSkill()');
assertEquals(normalizeSkill('React.js'), 'reactjs', 'normalizeSkill() removes dots');
assertEquals(normalizeSkill('Node.JS'), 'nodejs', 'normalizeSkill() handles case + dots');
assertEquals(normalizeSkill('C++'), 'cpp', 'normalizeSkill() handles C++');
assertEquals(normalizeSkill('C#'), 'csharp', 'normalizeSkill() handles C#');
assertEquals(normalizeSkill('.NET'), 'dotnet', 'normalizeSkill() handles .NET');
assertEquals(normalizeSkill('Next.js'), 'nextjs', 'normalizeSkill() removes dots and lowers');

// ============================================================================
// Test: skillsMatch
// ============================================================================
console.log('\n📝 Testing skillsMatch()');
assert(skillsMatch('React', 'react'), 'skillsMatch() case insensitive');
assert(skillsMatch('React.js', 'ReactJS'), 'skillsMatch() handles dot variants');
assert(skillsMatch('Node.js', 'Node'), 'skillsMatch() partial match');
assert(skillsMatch('JavaScript', 'JS'), 'skillsMatch() handles JS variant');
assert(skillsMatch('TypeScript', 'TS'), 'skillsMatch() handles TS variant');
assert(skillsMatch('Python', 'PY'), 'skillsMatch() handles PY variant');
assert(skillsMatch('PostgreSQL', 'Postgres'), 'skillsMatch() handles Postgres variant');
assert(!skillsMatch('React', 'Angular'), 'skillsMatch() rejects different skills');

// ============================================================================
// Test: cleanText
// ============================================================================
console.log('\n📝 Testing cleanText()');
assertEquals(
  cleanText('Hello   World'),
  'Hello World',
  'cleanText() removes multiple spaces'
);
assertEquals(
  cleanText('Développeur @#$ Full-Stack'),
  'Développeur  Full-Stack',
  'cleanText() removes special chars but keeps accents'
);

// ============================================================================
// Test: extractKeywords
// ============================================================================
console.log('\n📝 Testing extractKeywords()');
const keywords1 = extractKeywords('Le développeur utilise React et Node.js', 3);
assert(keywords1.includes('developp'), 'extractKeywords() includes "développeur" lemmatized');
assert(keywords1.includes('react'), 'extractKeywords() includes "react"');
assert(keywords1.includes('node'), 'extractKeywords() includes "node"');
assert(!keywords1.includes('le'), 'extractKeywords() excludes stop words');
assert(!keywords1.includes('et'), 'extractKeywords() excludes stop words');

// ============================================================================
// Test: jaccardSimilarity
// ============================================================================
console.log('\n📝 Testing jaccardSimilarity()');
const sim1 = jaccardSimilarity(['react', 'node', 'typescript'], ['react', 'node']);
assert(Math.abs(sim1 - 0.667) < 0.01, 'jaccardSimilarity() calculates correct similarity');

const sim2 = jaccardSimilarity(['react', 'node'], ['react', 'node']);
assertEquals(sim2, 1.0, 'jaccardSimilarity() returns 1.0 for identical sets');

const sim3 = jaccardSimilarity(['react'], ['angular']);
assertEquals(sim3, 0, 'jaccardSimilarity() returns 0 for disjoint sets');

const sim4 = jaccardSimilarity([], []);
assertEquals(sim4, 0, 'jaccardSimilarity() returns 0 for empty sets');

// ============================================================================
// Test: findMatchingSkills
// ============================================================================
console.log('\n📝 Testing findMatchingSkills()');
const { matched, missing } = findMatchingSkills(
  ['React', 'Node.js', 'TypeScript', 'Docker'],
  ['react.js', 'nodejs', 'python', 'kubernetes']
);

assert(matched.includes('react.js'), 'findMatchingSkills() matches React variants');
assert(matched.includes('nodejs'), 'findMatchingSkills() matches Node variants');
assertEquals(matched.length, 2, 'findMatchingSkills() finds 2 matches');

assert(missing.includes('python'), 'findMatchingSkills() identifies missing skills');
assert(missing.includes('kubernetes'), 'findMatchingSkills() identifies missing skills');
assertEquals(missing.length, 2, 'findMatchingSkills() finds 2 missing');

// ============================================================================
// Test: countOccurrences
// ============================================================================
console.log('\n📝 Testing countOccurrences()');
assertEquals(
  countOccurrences('React est un framework. React est populaire.', 'react'),
  2,
  'countOccurrences() counts case-insensitive'
);

assertEquals(
  countOccurrences('Développeur développeur DÉVELOPPEUR', 'développeur'),
  3,
  'countOccurrences() counts with accents'
);

// Note: "nodejs" normalizes to contain "node", so this counts as 1
assertEquals(
  countOccurrences('Le nodejs framework', 'node'),
  0,
  'countOccurrences() respects word boundaries (nodejs ≠ node)'
);

assertEquals(
  countOccurrences('Le développeur React travaille sur React', 'React'),
  2,
  'countOccurrences() counts exact words'
);

console.log('\n✅ All normalize tests passed!\n');
