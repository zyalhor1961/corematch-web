/**
 * JSON validation utilities using AJV
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import cvSchema from '../extraction/schema.cv.json';
import outputSchema from '../analysis/schema.output.json';
import { logger } from './logger';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Compile schemas once
let cvValidator: ValidateFunction;
let outputValidator: ValidateFunction;

/**
 * Initialize and compile validators
 */
export function initValidators() {
  if (!cvValidator) {
    cvValidator = ajv.compile(cvSchema);
    logger.debug('CV schema compiled');
  }
  if (!outputValidator) {
    outputValidator = ajv.compile(outputSchema);
    logger.debug('Output schema compiled');
  }
}

/**
 * Validate CV JSON
 */
export function validateCV(data: unknown): boolean {
  if (!cvValidator) initValidators();

  const valid = cvValidator(data);
  if (!valid) {
    logger.error('CV validation failed:', cvValidator.errors);
  }
  return valid as boolean;
}

/**
 * Validate output JSON
 */
export function validateOutput(data: unknown): boolean {
  if (!outputValidator) initValidators();

  const valid = outputValidator(data);
  if (!valid) {
    logger.error('Output validation failed:', outputValidator.errors);
  }
  return valid as boolean;
}

/**
 * Get validation errors as formatted string
 */
export function getValidationErrors(validator: ValidateFunction): string {
  if (!validator.errors) return 'No errors';

  return validator.errors
    .map(err => `${err.instancePath} ${err.message}`)
    .join(', ');
}

/**
 * Safe JSON parse with error handling
 */
export function safeJSONParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error('JSON parse error:', error);
    return null;
  }
}
