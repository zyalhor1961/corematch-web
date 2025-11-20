/**
 * Common Validation Nodes
 * Reusable nodes for data validation
 */

import type { NodeFunction, NodeResult } from '../../core/types';

/**
 * Validate required fields exist
 */
export const validateRequiredFields: NodeFunction<
  { data: Record<string, any>; requiredFields: string[] },
  { valid: boolean; missingFields: string[] }
> = async (state, input) => {
  const missingFields: string[] = [];

  for (const field of input.requiredFields) {
    const value = input.data[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }

  const valid = missingFields.length === 0;

  return {
    success: true,
    data: { valid, missingFields },
    stateUpdates: {
      validationPassed: valid,
      missingFields: valid ? undefined : missingFields,
    },
  };
};

/**
 * Validate document extraction quality
 */
export const validateExtractionQuality: NodeFunction<
  { extractionResult: any; minConfidence?: number },
  { valid: boolean; confidence: number; reason?: string }
> = async (state, input) => {
  const { extractionResult, minConfidence = 0.5 } = input;

  if (!extractionResult) {
    return {
      success: true,
      data: { valid: false, confidence: 0, reason: 'No extraction result' },
      stateUpdates: {
        validationPassed: false,
        validationReason: 'No extraction result',
      },
    };
  }

  const confidence = extractionResult.confidence || 0;
  const valid = confidence >= minConfidence;

  return {
    success: true,
    data: {
      valid,
      confidence,
      reason: valid ? undefined : `Confidence ${confidence} below threshold ${minConfidence}`,
    },
    stateUpdates: {
      validationPassed: valid,
      extractionConfidence: confidence,
    },
  };
};

/**
 * Validate file type
 */
export const validateFileType: NodeFunction<
  { fileName: string; fileType: string; allowedTypes?: string[] },
  { valid: boolean; detectedType: string; reason?: string }
> = async (state, input) => {
  const { fileName, fileType, allowedTypes = ['application/pdf'] } = input;

  const valid = allowedTypes.includes(fileType);
  const reason = valid ? undefined : `File type ${fileType} not in allowed types: ${allowedTypes.join(', ')}`;

  return {
    success: true,
    data: { valid, detectedType: fileType, reason },
    stateUpdates: {
      validationPassed: valid,
      fileType,
    },
  };
};

/**
 * Validate date range
 */
export const validateDateRange: NodeFunction<
  { date: string | Date; minDate?: Date; maxDate?: Date },
  { valid: boolean; parsedDate: Date | null; reason?: string }
> = async (state, input) => {
  try {
    const parsedDate = typeof input.date === 'string' ? new Date(input.date) : input.date;

    if (isNaN(parsedDate.getTime())) {
      return {
        success: true,
        data: { valid: false, parsedDate: null, reason: 'Invalid date format' },
        stateUpdates: { validationPassed: false },
      };
    }

    let valid = true;
    let reason: string | undefined;

    if (input.minDate && parsedDate < input.minDate) {
      valid = false;
      reason = `Date ${parsedDate.toISOString()} before minimum ${input.minDate.toISOString()}`;
    }

    if (input.maxDate && parsedDate > input.maxDate) {
      valid = false;
      reason = `Date ${parsedDate.toISOString()} after maximum ${input.maxDate.toISOString()}`;
    }

    return {
      success: true,
      data: { valid, parsedDate, reason },
      stateUpdates: { validationPassed: valid },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Date validation failed',
    };
  }
};

/**
 * Validate amount (positive number)
 */
export const validateAmount: NodeFunction<
  { amount: number | string; min?: number; max?: number },
  { valid: boolean; parsedAmount: number | null; reason?: string }
> = async (state, input) => {
  try {
    const amount = typeof input.amount === 'string' ? parseFloat(input.amount) : input.amount;

    if (isNaN(amount)) {
      return {
        success: true,
        data: { valid: false, parsedAmount: null, reason: 'Invalid amount format' },
        stateUpdates: { validationPassed: false },
      };
    }

    let valid = true;
    let reason: string | undefined;

    if (input.min !== undefined && amount < input.min) {
      valid = false;
      reason = `Amount ${amount} below minimum ${input.min}`;
    }

    if (input.max !== undefined && amount > input.max) {
      valid = false;
      reason = `Amount ${amount} above maximum ${input.max}`;
    }

    return {
      success: true,
      data: { valid, parsedAmount: amount, reason },
      stateUpdates: { validationPassed: valid, amount },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Amount validation failed',
    };
  }
};

/**
 * Generic schema validation
 */
export const validateSchema: NodeFunction<
  { data: any; schema: Record<string, (value: any) => boolean>; schemaName?: string },
  { valid: boolean; errors: string[] }
> = async (state, input) => {
  const errors: string[] = [];

  for (const [field, validator] of Object.entries(input.schema)) {
    const value = input.data[field];
    try {
      if (!validator(value)) {
        errors.push(`Field "${field}" failed validation`);
      }
    } catch (error) {
      errors.push(`Field "${field}" validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  const valid = errors.length === 0;

  return {
    success: true,
    data: { valid, errors },
    stateUpdates: {
      validationPassed: valid,
      validationErrors: valid ? undefined : errors,
    },
  };
};
