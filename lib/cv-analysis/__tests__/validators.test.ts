/**
 * Tests pour validators/
 */

import {
  initValidators,
  validateCVData,
  validateEvaluationResult,
  assertValidCV,
  assertValidEvaluation,
} from '../validators';

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

console.log('\n🧪 Testing validators/\n');

// ============================================================================
// Initialiser les validators
// ============================================================================
console.log('🔧 Initializing validators...');
initValidators();
console.log('✅ Validators initialized\n');

// ============================================================================
// Test: validateCVData - Valid CV
// ============================================================================
console.log('📋 Testing validateCVData() with valid CV');

const validCV = {
  identite: {
    prenom: 'Jean',
    nom: 'Dupont',
    email: 'jean.dupont@example.com',
  },
  experiences: [
    {
      index: 0,
      titre: 'Développeur Full Stack',
      employeur: 'TechCorp',
      date_debut: '2020-01',
      date_fin: 'en cours',
      missions: ['Développement React', 'API REST'],
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'Master Informatique',
      etablissement: 'Université Paris',
      annee: '2019',
      niveau: 'Bac+5',
    },
  ],
  competences: ['React', 'Node.js', 'TypeScript'],
  langues: [
    {
      langue: 'Français',
      niveau: 'Natif',
    },
  ],
};

const cvResult = validateCVData(validCV);
assert(cvResult.valid, 'validateCVData() accepts valid CV');
assert(cvResult.data !== undefined, 'validateCVData() returns data on success');

// ============================================================================
// Test: validateCVData - Invalid CV (missing required fields)
// ============================================================================
console.log('\n📋 Testing validateCVData() with invalid CV');

const invalidCV = {
  identite: {
    prenom: 'Jean',
    // nom manquant (required)
  },
  experiences: [],
  formations: [],
  competences: [],
};

const invalidCvResult = validateCVData(invalidCV);
assert(!invalidCvResult.valid, 'validateCVData() rejects invalid CV');
assert(invalidCvResult.errors !== undefined, 'validateCVData() returns errors');
assert(invalidCvResult.errorMessage !== undefined, 'validateCVData() returns error message');

// ============================================================================
// Test: validateEvaluationResult - Valid result
// ============================================================================
console.log('\n📊 Testing validateEvaluationResult() with valid result');

const validEvaluation = {
  meets_all_must_have: true,
  fails: [],
  relevance_summary: {
    months_direct: 36,
    months_adjacent: 12,
    months_peripheral: 0,
    months_non_pertinent: 0,
    by_experience: [
      {
        index: 0,
        titre: 'Développeur Full Stack',
        employeur: 'TechCorp',
        start: '2020-01',
        end: null,
        relevance: 'DIRECTE',
        reason: 'Développement web correspond au poste',
        evidence: [
          {
            quote: 'Développement React',
            field_path: 'experiences[0].missions[0]',
          },
        ],
      },
    ],
  },
  subscores: {
    experience_years_relevant: 3.5,
    skills_match_0_to_100: 85,
    nice_to_have_0_to_100: 60,
  },
  overall_score_0_to_100: 78.5,
  recommendation: 'SHORTLIST',
  strengths: [
    {
      point: 'Solide expérience en développement web',
      evidence: [
        {
          quote: 'Développement React',
          field_path: 'experiences[0].missions[0]',
        },
      ],
    },
  ],
  improvements: [
    {
      point: 'Manque de certifications',
      why: 'Aucune certification listée',
      suggested_action: 'Obtenir certification AWS ou Azure',
    },
  ],
};

const evalResult = validateEvaluationResult(validEvaluation);
assert(evalResult.valid, 'validateEvaluationResult() accepts valid result');
assert(evalResult.data !== undefined, 'validateEvaluationResult() returns data on success');

// ============================================================================
// Test: validateEvaluationResult - Invalid result
// ============================================================================
console.log('\n📊 Testing validateEvaluationResult() with invalid result');

const invalidEvaluation = {
  meets_all_must_have: true,
  // fails manquant (required)
  relevance_summary: {
    months_direct: 36,
    months_adjacent: 12,
    months_peripheral: 0,
    months_non_pertinent: 0,
    by_experience: [],
  },
  subscores: {
    experience_years_relevant: 3.5,
    skills_match_0_to_100: 85,
    nice_to_have_0_to_100: 60,
  },
  overall_score_0_to_100: 78.5,
  recommendation: 'SHORTLIST',
  strengths: [],
  improvements: [],
};

const invalidEvalResult = validateEvaluationResult(invalidEvaluation);
assert(!invalidEvalResult.valid, 'validateEvaluationResult() rejects invalid result');

// ============================================================================
// Test: assertValidCV
// ============================================================================
console.log('\n📋 Testing assertValidCV()');

try {
  assertValidCV(validCV);
  console.log('✅ assertValidCV() accepts valid CV without throwing');
} catch (error) {
  throw new Error('❌ assertValidCV() should not throw for valid CV');
}

try {
  assertValidCV(invalidCV);
  throw new Error('❌ assertValidCV() should throw for invalid CV');
} catch (error: any) {
  if (error.message.includes('CV validation failed')) {
    console.log('✅ assertValidCV() throws for invalid CV');
  } else {
    throw error;
  }
}

// ============================================================================
// Test: assertValidEvaluation
// ============================================================================
console.log('\n📊 Testing assertValidEvaluation()');

try {
  assertValidEvaluation(validEvaluation);
  console.log('✅ assertValidEvaluation() accepts valid evaluation without throwing');
} catch (error) {
  throw new Error('❌ assertValidEvaluation() should not throw for valid evaluation');
}

try {
  assertValidEvaluation(invalidEvaluation);
  throw new Error('❌ assertValidEvaluation() should throw for invalid evaluation');
} catch (error: any) {
  if (error.message.includes('Evaluation validation failed')) {
    console.log('✅ assertValidEvaluation() throws for invalid evaluation');
  } else {
    throw error;
  }
}

// ============================================================================
// Test: Invalid data types
// ============================================================================
console.log('\n📋 Testing type validation');

const wrongTypeCV = {
  identite: {
    prenom: 'Jean',
    nom: 'Dupont',
  },
  experiences: 'not an array', // Wrong type
  formations: [],
  competences: [],
};

const wrongTypeResult = validateCVData(wrongTypeCV);
assert(!wrongTypeResult.valid, 'validateCVData() rejects wrong data types');

// ============================================================================
// Test: Enum validation
// ============================================================================
console.log('\n📋 Testing enum validation');

const wrongEnumEvaluation = {
  ...validEvaluation,
  recommendation: 'MAYBE', // Invalid enum value
};

const wrongEnumResult = validateEvaluationResult(wrongEnumEvaluation);
assert(!wrongEnumResult.valid, 'validateEvaluationResult() rejects invalid enum values');

console.log('\n✅ All validator tests passed!\n');
