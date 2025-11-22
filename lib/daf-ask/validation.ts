/**
 * Ask DAF - Validation Layer
 * Vérifie l'intégrité et la cohérence des réponses
 *
 * Objectifs:
 * 1. Détecter les hallucinations potentielles
 * 2. Valider la cohérence des données
 * 3. Vérifier que les réponses sont basées sur des données réelles
 */

import type { ColumnDefinition } from './types';

// =============================================================================
// Types
// =============================================================================

export interface ValidationContext {
  question: string;
  answer: string;
  toolsCalled: string[];
  rows: Record<string, any>[];
  columns?: ColumnDefinition[];
  language: 'fr' | 'en';
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1
  warnings: Warning[];
  suggestions?: string[];
}

export interface Warning {
  type: WarningType;
  message: string;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, any>;
}

export type WarningType =
  | 'no_tools_called'
  | 'numbers_without_data'
  | 'data_mismatch'
  | 'unexpected_currency'
  | 'date_anomaly'
  | 'empty_response'
  | 'generic_fallback';

// =============================================================================
// Main Validation Function
// =============================================================================

export function validateDafResponse(context: ValidationContext): ValidationResult {
  const warnings: Warning[] = [];
  let confidence = 1.0;

  // Run all validators
  const validators = [
    validateToolUsage,
    validateNumbersWithData,
    validateCurrencyConsistency,
    validateDateReferences,
    validateResponseContent,
    validateDataPresence,
  ];

  for (const validator of validators) {
    const result = validator(context);
    warnings.push(...result.warnings);
    confidence *= result.confidenceMultiplier;
  }

  // Calculate final validation status
  const highSeverityCount = warnings.filter(w => w.severity === 'high').length;
  const mediumSeverityCount = warnings.filter(w => w.severity === 'medium').length;

  const isValid = highSeverityCount === 0 && mediumSeverityCount <= 1;

  // Generate suggestions if issues detected
  const suggestions = generateSuggestions(warnings, context.language);

  return {
    isValid,
    confidence: Math.max(0, Math.min(1, confidence)),
    warnings,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

// =============================================================================
// Individual Validators
// =============================================================================

interface ValidatorResult {
  warnings: Warning[];
  confidenceMultiplier: number;
}

function validateToolUsage(context: ValidationContext): ValidatorResult {
  const warnings: Warning[] = [];
  let confidenceMultiplier = 1.0;

  if (context.toolsCalled.length === 0) {
    // Check if it's an out-of-scope response (which is OK without tools)
    const isOutOfScopeResponse =
      context.answer.includes('sort du cadre') ||
      context.answer.includes('outside document analysis') ||
      context.answer.includes('hors domaine');

    if (!isOutOfScopeResponse) {
      warnings.push({
        type: 'no_tools_called',
        message: context.language === 'fr'
          ? 'Aucun outil n\'a été utilisé pour cette réponse'
          : 'No tools were used for this response',
        severity: 'medium',
        details: { expectedTools: true },
      });
      confidenceMultiplier = 0.7;
    }
  }

  return { warnings, confidenceMultiplier };
}

function validateNumbersWithData(context: ValidationContext): ValidatorResult {
  const warnings: Warning[] = [];
  let confidenceMultiplier = 1.0;

  // Extract numbers from answer (currency amounts)
  const currencyPattern = /(\d{1,3}(?:[\s.,]\d{3})*(?:[,\.]\d{1,2})?)\s*(?:€|euros?|EUR)/gi;
  const numbersInAnswer = context.answer.match(currencyPattern) || [];

  // If we have numbers in the answer
  if (numbersInAnswer.length > 0) {
    // Check if we have data to back them up
    if (context.rows.length === 0 && context.toolsCalled.length > 0) {
      warnings.push({
        type: 'numbers_without_data',
        message: context.language === 'fr'
          ? 'Des montants sont mentionnés mais aucune donnée n\'a été trouvée'
          : 'Amounts are mentioned but no data was found',
        severity: 'high',
        details: {
          mentionedAmounts: numbersInAnswer,
          rowCount: 0,
        },
      });
      confidenceMultiplier = 0.4;
    } else if (context.rows.length > 0) {
      // Verify numbers match actual data
      const actualAmounts = extractAmountsFromData(context.rows);
      const mentionedAmounts = numbersInAnswer.map(parseAmount);

      // Check if at least one mentioned amount is in data
      const hasMatchingAmount = mentionedAmounts.some(mentioned =>
        actualAmounts.some(actual => isAmountClose(mentioned, actual))
      );

      if (!hasMatchingAmount && mentionedAmounts.length > 0) {
        warnings.push({
          type: 'data_mismatch',
          message: context.language === 'fr'
            ? 'Les montants mentionnés ne correspondent pas aux données'
            : 'Mentioned amounts do not match the data',
          severity: 'medium',
          details: {
            mentionedAmounts,
            actualAmounts: actualAmounts.slice(0, 10),
          },
        });
        confidenceMultiplier = 0.8;
      }
    }
  }

  return { warnings, confidenceMultiplier };
}

function validateCurrencyConsistency(context: ValidationContext): ValidatorResult {
  const warnings: Warning[] = [];
  let confidenceMultiplier = 1.0;

  // Check for non-euro currencies (should not appear in French finance context)
  const nonEuroCurrencies = /\$|dollars?|£|pounds?|¥|yens?/gi;
  if (nonEuroCurrencies.test(context.answer)) {
    warnings.push({
      type: 'unexpected_currency',
      message: context.language === 'fr'
        ? 'Devise non-euro détectée dans la réponse'
        : 'Non-euro currency detected in response',
      severity: 'low',
      details: {},
    });
    confidenceMultiplier = 0.95;
  }

  return { warnings, confidenceMultiplier };
}

function validateDateReferences(context: ValidationContext): ValidatorResult {
  const warnings: Warning[] = [];
  let confidenceMultiplier = 1.0;

  // Check for future dates that seem wrong
  const futureYearPattern = /20(2[6-9]|[3-9]\d)/g;
  const futureYears = context.answer.match(futureYearPattern);

  if (futureYears) {
    warnings.push({
      type: 'date_anomaly',
      message: context.language === 'fr'
        ? 'Référence à une année future détectée'
        : 'Reference to future year detected',
      severity: 'low',
      details: { years: futureYears },
    });
    confidenceMultiplier = 0.9;
  }

  return { warnings, confidenceMultiplier };
}

function validateResponseContent(context: ValidationContext): ValidatorResult {
  const warnings: Warning[] = [];
  let confidenceMultiplier = 1.0;

  // Empty or very short response
  if (context.answer.length < 20) {
    warnings.push({
      type: 'empty_response',
      message: context.language === 'fr'
        ? 'Réponse très courte ou vide'
        : 'Very short or empty response',
      severity: 'medium',
    });
    confidenceMultiplier = 0.6;
  }

  // Generic fallback phrases
  const genericPhrases = [
    'je ne suis pas sûr',
    'i am not sure',
    'je ne peux pas',
    'i cannot',
    'information non disponible',
    'information not available',
    'données insuffisantes',
    'insufficient data',
  ];

  const hasGenericFallback = genericPhrases.some(phrase =>
    context.answer.toLowerCase().includes(phrase)
  );

  if (hasGenericFallback && context.rows.length > 0) {
    warnings.push({
      type: 'generic_fallback',
      message: context.language === 'fr'
        ? 'Réponse générique alors que des données sont disponibles'
        : 'Generic response while data is available',
      severity: 'medium',
      details: { rowCount: context.rows.length },
    });
    confidenceMultiplier = 0.7;
  }

  return { warnings, confidenceMultiplier };
}

function validateDataPresence(context: ValidationContext): ValidatorResult {
  const warnings: Warning[] = [];
  let confidenceMultiplier = 1.0;

  // If data query tools were called but no rows returned
  const dataQueryTools = ['list_invoices', 'list_documents', 'list_cvs', 'search_documents', 'semantic_search'];
  const calledDataTools = context.toolsCalled.filter(t => dataQueryTools.includes(t));

  if (calledDataTools.length > 0 && context.rows.length === 0) {
    // This is OK - just means no data matches the query
    // But the answer should acknowledge this
    const acknowledgesNoData =
      context.answer.toLowerCase().includes('aucun') ||
      context.answer.toLowerCase().includes('pas de') ||
      context.answer.toLowerCase().includes('no ') ||
      context.answer.toLowerCase().includes('none') ||
      context.answer.toLowerCase().includes("n'ai trouvé");

    if (!acknowledgesNoData) {
      warnings.push({
        type: 'data_mismatch',
        message: context.language === 'fr'
          ? 'La réponse ne mentionne pas l\'absence de données'
          : 'Response does not acknowledge lack of data',
        severity: 'low',
      });
      confidenceMultiplier = 0.9;
    }
  }

  return { warnings, confidenceMultiplier };
}

// =============================================================================
// Helper Functions
// =============================================================================

function extractAmountsFromData(rows: Record<string, any>[]): number[] {
  const amounts: number[] = [];

  for (const row of rows) {
    // Check common amount fields
    const amountFields = [
      'montant_ttc', 'montant_ht', 'total_ttc', 'total_ht',
      'amount', 'total', 'value', 'avg_amount',
    ];

    for (const field of amountFields) {
      if (typeof row[field] === 'number' && row[field] > 0) {
        amounts.push(row[field]);
      }
    }
  }

  return amounts;
}

function parseAmount(amountStr: string): number {
  // Remove currency symbols and normalize
  const cleaned = amountStr
    .replace(/[€$£¥\s]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');

  return parseFloat(cleaned) || 0;
}

function isAmountClose(a: number, b: number, tolerance: number = 0.01): boolean {
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return false;

  const percentDiff = Math.abs(a - b) / Math.max(a, b);
  return percentDiff <= tolerance;
}

function generateSuggestions(warnings: Warning[], language: 'fr' | 'en'): string[] {
  const suggestions: string[] = [];

  for (const warning of warnings) {
    switch (warning.type) {
      case 'no_tools_called':
        suggestions.push(
          language === 'fr'
            ? 'Essayez de reformuler la question avec des termes plus précis (factures, fournisseur, date...)'
            : 'Try rephrasing with more specific terms (invoices, supplier, date...)'
        );
        break;

      case 'numbers_without_data':
        suggestions.push(
          language === 'fr'
            ? 'Vérifiez que vous avez des données pour la période demandée'
            : 'Check that you have data for the requested period'
        );
        break;

      case 'data_mismatch':
        suggestions.push(
          language === 'fr'
            ? 'Les résultats peuvent nécessiter une vérification manuelle'
            : 'Results may require manual verification'
        );
        break;
    }
  }

  // Deduplicate
  return [...new Set(suggestions)];
}

// =============================================================================
// Quick Validation (for real-time feedback)
// =============================================================================

export function quickValidate(context: Partial<ValidationContext>): {
  hasIssues: boolean;
  primaryWarning?: string;
} {
  // No tools called
  if (context.toolsCalled?.length === 0) {
    return {
      hasIssues: true,
      primaryWarning: context.language === 'fr'
        ? 'Réponse sans consultation des données'
        : 'Response without data lookup',
    };
  }

  // Numbers mentioned but no data
  const hasNumbers = /\d+\s*€/.test(context.answer || '');
  const hasData = (context.rows?.length || 0) > 0;

  if (hasNumbers && !hasData && (context.toolsCalled?.length || 0) > 0) {
    return {
      hasIssues: true,
      primaryWarning: context.language === 'fr'
        ? 'Montants mentionnés sans données correspondantes'
        : 'Amounts mentioned without matching data',
    };
  }

  return { hasIssues: false };
}

// =============================================================================
// Exports
// =============================================================================

export { extractAmountsFromData, parseAmount, isAmountClose };
