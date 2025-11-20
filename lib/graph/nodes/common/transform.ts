/**
 * Common Transformation Nodes
 * Reusable nodes for data transformation
 */

import type { NodeFunction } from '../../core/types';

/**
 * Map fields from one structure to another
 */
export const mapFields: NodeFunction<
  { data: Record<string, any>; mapping: Record<string, string> },
  Record<string, any>
> = async (state, input) => {
  const result: Record<string, any> = {};

  for (const [targetField, sourceField] of Object.entries(input.mapping)) {
    // Support nested field access with dot notation
    const value = getNestedValue(input.data, sourceField);
    if (value !== undefined) {
      result[targetField] = value;
    }
  }

  return {
    success: true,
    data: result,
    stateUpdates: {
      mappedData: result,
    },
  };
};

/**
 * Normalize text (trim, lowercase, remove special chars)
 */
export const normalizeText: NodeFunction<
  { text: string; options?: { lowercase?: boolean; trim?: boolean; removeSpecialChars?: boolean } },
  string
> = async (state, input) => {
  let normalized = input.text;

  const options = input.options || {};

  if (options.trim !== false) {
    normalized = normalized.trim();
  }

  if (options.lowercase) {
    normalized = normalized.toLowerCase();
  }

  if (options.removeSpecialChars) {
    normalized = normalized.replace(/[^a-zA-Z0-9\s]/g, '');
  }

  return {
    success: true,
    data: normalized,
    stateUpdates: {
      normalizedText: normalized,
    },
  };
};

/**
 * Parse date from various formats
 */
export const parseDate: NodeFunction<
  { dateString: string; format?: string },
  { date: Date | null; iso: string | null }
> = async (state, input) => {
  try {
    const date = new Date(input.dateString);

    if (isNaN(date.getTime())) {
      return {
        success: true,
        data: { date: null, iso: null },
        stateUpdates: {
          parsedDate: null,
        },
      };
    }

    return {
      success: true,
      data: { date, iso: date.toISOString() },
      stateUpdates: {
        parsedDate: date,
        parsedDateISO: date.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Date parsing failed',
    };
  }
};

/**
 * Extract numbers from text
 */
export const extractNumbers: NodeFunction<
  { text: string; pattern?: RegExp },
  { numbers: number[]; matched: string[] }
> = async (state, input) => {
  try {
    const pattern = input.pattern || /[\d,]+\.?\d*/g;
    const matches = input.text.match(pattern) || [];

    const numbers = matches
      .map((m) => parseFloat(m.replace(/,/g, '')))
      .filter((n) => !isNaN(n));

    return {
      success: true,
      data: { numbers, matched: matches },
      stateUpdates: {
        extractedNumbers: numbers,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Number extraction failed',
    };
  }
};

/**
 * Classify document type based on content
 */
export const classifyDocument: NodeFunction<
  { fileName: string; fileType: string; content?: string },
  { docType: string; confidence: number }
> = async (state, input) => {
  try {
    // Simple heuristic classification
    const fileName = input.fileName.toLowerCase();
    const content = input.content?.toLowerCase() || '';

    let docType = 'unknown';
    let confidence = 0.5;

    // Invoice detection
    if (
      fileName.includes('invoice') ||
      fileName.includes('facture') ||
      content.includes('invoice') ||
      content.includes('facture')
    ) {
      docType = 'facture';
      confidence = 0.8;
    }
    // Bank statement detection
    else if (
      fileName.includes('bank') ||
      fileName.includes('releve') ||
      content.includes('bank statement') ||
      content.includes('relevé bancaire')
    ) {
      docType = 'releve_bancaire';
      confidence = 0.8;
    }
    // Contract detection
    else if (fileName.includes('contract') || fileName.includes('contrat') || content.includes('contrat')) {
      docType = 'contrat';
      confidence = 0.7;
    }

    return {
      success: true,
      data: { docType, confidence },
      stateUpdates: {
        classification: { doc_type: docType, confidence },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document classification failed',
    };
  }
};

/**
 * Merge multiple data objects
 */
export const mergeData: NodeFunction<
  { sources: Record<string, any>[]; strategy?: 'shallow' | 'deep' },
  Record<string, any>
> = async (state, input) => {
  try {
    const strategy = input.strategy || 'shallow';

    let merged: Record<string, any> = {};

    if (strategy === 'shallow') {
      for (const source of input.sources) {
        merged = { ...merged, ...source };
      }
    } else {
      // Deep merge
      for (const source of input.sources) {
        merged = deepMerge(merged, source);
      }
    }

    return {
      success: true,
      data: merged,
      stateUpdates: {
        mergedData: merged,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Data merge failed',
    };
  }
};

/**
 * Filter data by criteria
 */
export const filterData: NodeFunction<
  { data: any[]; predicate: (item: any) => boolean },
  any[]
> = async (state, input) => {
  try {
    const filtered = input.data.filter(input.predicate);

    return {
      success: true,
      data: filtered,
      stateUpdates: {
        filteredData: filtered,
        filteredCount: filtered.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Data filtering failed',
    };
  }
};

/**
 * Sort data by field
 */
export const sortData: NodeFunction<
  { data: any[]; sortBy: string; order?: 'asc' | 'desc' },
  any[]
> = async (state, input) => {
  try {
    const sorted = [...input.data].sort((a, b) => {
      const aVal = getNestedValue(a, input.sortBy);
      const bVal = getNestedValue(b, input.sortBy);

      if (aVal < bVal) return input.order === 'desc' ? 1 : -1;
      if (aVal > bVal) return input.order === 'desc' ? -1 : 1;
      return 0;
    });

    return {
      success: true,
      data: sorted,
      stateUpdates: {
        sortedData: sorted,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Data sorting failed',
    };
  }
};

// Utility functions

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}
