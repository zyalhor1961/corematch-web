/**
 * Validation centralisée avec AJV
 * Tous les schémas JSON compilés et prêts à l'emploi
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import cvSchema from '../schemas/cv.schema.json';
import outputSchema from '../schemas/output.schema.json';
import aggregatedResultSchema from '../schemas/aggregated-result.schema.json';
import type { CV_JSON, EvaluationResult, AggregatedResult } from '../types';

// ============================================================================
// Instance AJV globale
// ============================================================================

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false, // Pour supporter $ref entre fichiers
});

// ============================================================================
// Validation functions compilées
// ============================================================================

let validateCV: ValidateFunction<CV_JSON> | null = null;
let validateOutput: ValidateFunction<EvaluationResult> | null = null;
let validateAggregatedResult: ValidateFunction<AggregatedResult> | null = null;

// Flag pour éviter la double initialisation
let initialized = false;

/**
 * Initialiser les validators (à appeler au démarrage)
 */
export function initValidators(): void {
  if (initialized) {
    console.log('[Validators] Already initialized, skipping...');
    return;
  }

  console.log('[Validators] Initializing AJV validators...');

  try {
    // Add schemas to AJV first (for $ref resolution)
    ajv.addSchema(cvSchema, 'cv.schema.json');
    ajv.addSchema(outputSchema, 'output.schema.json');

    // Compile schemas
    validateCV = ajv.compile<CV_JSON>(cvSchema);
    validateOutput = ajv.compile<EvaluationResult>(outputSchema);
    validateAggregatedResult = ajv.compile<AggregatedResult>(aggregatedResultSchema);

    initialized = true;
    console.log('[Validators] ✅ All validators compiled successfully');
  } catch (error) {
    console.error('[Validators] ❌ Failed to compile validators:', error);
    throw error;
  }
}

// ============================================================================
// Validation helpers
// ============================================================================

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ErrorObject[];
  errorMessage?: string;
}

/**
 * Valider un CV extrait
 */
export function validateCVData(data: unknown): ValidationResult<CV_JSON> {
  if (!validateCV) {
    throw new Error('[Validators] validateCV not initialized. Call initValidators() first.');
  }

  const valid = validateCV(data);

  if (!valid) {
    return {
      valid: false,
      errors: validateCV.errors || [],
      errorMessage: formatErrors(validateCV.errors || []),
    };
  }

  return {
    valid: true,
    data: data as CV_JSON,
  };
}

/**
 * Valider un résultat d'évaluation
 */
export function validateEvaluationResult(data: unknown): ValidationResult<EvaluationResult> {
  if (!validateOutput) {
    throw new Error('[Validators] validateOutput not initialized. Call initValidators() first.');
  }

  const valid = validateOutput(data);

  if (!valid) {
    return {
      valid: false,
      errors: validateOutput.errors || [],
      errorMessage: formatErrors(validateOutput.errors || []),
    };
  }

  return {
    valid: true,
    data: data as EvaluationResult,
  };
}

/**
 * Valider un résultat agrégé
 */
export function validateAggregatedResultData(data: unknown): ValidationResult<AggregatedResult> {
  if (!validateAggregatedResult) {
    throw new Error('[Validators] validateAggregatedResult not initialized. Call initValidators() first.');
  }

  const valid = validateAggregatedResult(data);

  if (!valid) {
    return {
      valid: false,
      errors: validateAggregatedResult.errors || [],
      errorMessage: formatErrors(validateAggregatedResult.errors || []),
    };
  }

  return {
    valid: true,
    data: data as AggregatedResult,
  };
}

// ============================================================================
// Error formatting
// ============================================================================

/**
 * Formater les erreurs AJV en message lisible
 */
function formatErrors(errors: ErrorObject[]): string {
  if (errors.length === 0) return 'Unknown validation error';

  const messages = errors.map((err) => {
    const path = err.instancePath || '/';
    const message = err.message || 'validation failed';
    const params = err.params ? JSON.stringify(err.params) : '';

    return `${path}: ${message} ${params}`.trim();
  });

  return messages.join('; ');
}

/**
 * Obtenir les erreurs détaillées pour debug
 */
export function getDetailedErrors(errors: ErrorObject[]): string {
  return JSON.stringify(errors, null, 2);
}

// ============================================================================
// Quick validation (throw on error)
// ============================================================================

/**
 * Valider et throw si erreur (pour usage dans try/catch)
 */
export function assertValidCV(data: unknown): asserts data is CV_JSON {
  const result = validateCVData(data);
  if (!result.valid) {
    throw new Error(`CV validation failed: ${result.errorMessage}`);
  }
}

export function assertValidEvaluation(data: unknown): asserts data is EvaluationResult {
  const result = validateEvaluationResult(data);
  if (!result.valid) {
    throw new Error(`Evaluation validation failed: ${result.errorMessage}`);
  }
}

export function assertValidAggregatedResult(data: unknown): asserts data is AggregatedResult {
  const result = validateAggregatedResultData(data);
  if (!result.valid) {
    throw new Error(`AggregatedResult validation failed: ${result.errorMessage}`);
  }
}

// ============================================================================
// Export raw validators pour usage avancé
// ============================================================================

export function getRawValidators() {
  return {
    validateCV,
    validateOutput,
    validateAggregatedResult,
  };
}
