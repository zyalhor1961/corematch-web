/**
 * DEB VAT Control Service
 *
 * Implements financial validation controls for European invoices:
 * 1. Arithmetic TTC validation (net + tax = total)
 * 2. Intra-EU classification
 * 3. VAT zero verification for reverse charge
 */

import { supabaseAdmin } from '@/lib/supabase/server';

// EU Country Codes
export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

export interface VATControlConfig {
  toleranceAmount: number; // Default: 2.00 EUR
  euCountries: string[];
}

export interface ControlDetail {
  passed: boolean;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  expected?: number;
  actual?: number;
  difference?: number;
}

export interface VATControlResult {
  passed: boolean;
  overallStatus: 'passed' | 'warning' | 'failed';
  controls: {
    arithmeticTTC: ControlDetail;
    intraEUClassification: ControlDetail;
    vatZeroVerification: ControlDetail;
  };
  needsManualReview: boolean;
}

export interface InvoiceData {
  documentId: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  vendorCountry?: string | null;
  vendorVAT?: string | null;
  currency?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: VATControlConfig = {
  toleranceAmount: 2.00, // EUR
  euCountries: EU_COUNTRIES
};

/**
 * Main VAT control function
 * Runs all validation checks and stores results in database
 */
export async function performVATControls(
  invoiceData: InvoiceData,
  config: Partial<VATControlConfig> = {}
): Promise<VATControlResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 1. Arithmetic TTC validation
  const arithmeticTTC = validateArithmeticTTC(
    invoiceData.netAmount,
    invoiceData.taxAmount,
    invoiceData.totalAmount,
    finalConfig.toleranceAmount
  );

  // 2. Intra-EU classification
  const intraEU = classifyIntraEU(
    invoiceData.vendorCountry,
    invoiceData.vendorVAT,
    finalConfig.euCountries
  );

  // 3. VAT zero verification (only if intra-EU)
  const vatZero = verifyVATZero(
    invoiceData.taxAmount,
    intraEU.isIntraEU
  );

  // Determine overall status
  const allControls = [arithmeticTTC, vatZero];
  const hasFailed = allControls.some(c => c.status === 'failed');
  const hasWarning = allControls.some(c => c.status === 'warning');

  const overallStatus = hasFailed ? 'failed' : hasWarning ? 'warning' : 'passed';
  const needsManualReview = hasFailed || (hasWarning && arithmeticTTC.status === 'failed');

  // Store results in database
  await storeVATControlResults(invoiceData.documentId, {
    arithmeticTTC,
    intraEUClassification: intraEU.control,
    vatZeroVerification: vatZero
  }, overallStatus, intraEU.isIntraEU, intraEU.vatRegime);

  return {
    passed: overallStatus === 'passed',
    overallStatus,
    controls: {
      arithmeticTTC,
      intraEUClassification: intraEU.control,
      vatZeroVerification: vatZero
    },
    needsManualReview
  };
}

/**
 * 1. Arithmetic TTC Validation
 * Formula: net_amount + tax_amount = total_amount
 */
export function validateArithmeticTTC(
  netAmount: number,
  taxAmount: number,
  totalAmount: number,
  tolerance: number = 2.00
): ControlDetail {
  const calculated = netAmount + taxAmount;
  const difference = Math.abs(calculated - totalAmount);

  if (difference <= 0.01) {
    return {
      passed: true,
      status: 'passed',
      message: 'TTC arithmetic validation passed',
      severity: 'info',
      expected: totalAmount,
      actual: calculated,
      difference
    };
  }

  if (difference <= tolerance) {
    return {
      passed: true,
      status: 'warning',
      message: `TTC difference within tolerance (${difference.toFixed(2)} EUR)`,
      severity: 'warning',
      expected: totalAmount,
      actual: calculated,
      difference
    };
  }

  return {
    passed: false,
    status: 'failed',
    message: `TTC arithmetic error: difference exceeds tolerance (${difference.toFixed(2)} EUR > ${tolerance.toFixed(2)} EUR)`,
    severity: 'error',
    expected: totalAmount,
    actual: calculated,
    difference
  };
}

/**
 * 2. Intra-EU Classification
 * Determines if transaction is within EU based on vendor country/VAT
 */
export function classifyIntraEU(
  vendorCountry: string | null | undefined,
  vendorVAT: string | null | undefined,
  euCountries: string[] = EU_COUNTRIES
): {
  isIntraEU: boolean;
  vatRegime: 'standard' | 'reverse_charge' | 'exempted' | 'not_applicable';
  control: ControlDetail;
} {
  // Extract country from VAT number (first 2 characters)
  let countryCode = vendorCountry?.toUpperCase();

  if (!countryCode && vendorVAT) {
    // Try to extract from VAT number
    const vatMatch = vendorVAT.match(/^([A-Z]{2})/);
    if (vatMatch) {
      countryCode = vatMatch[1];
    }
  }

  if (!countryCode) {
    return {
      isIntraEU: false,
      vatRegime: 'not_applicable',
      control: {
        passed: true,
        status: 'warning',
        message: 'Cannot determine vendor country - classification uncertain',
        severity: 'warning'
      }
    };
  }

  const isIntraEU = euCountries.includes(countryCode);

  return {
    isIntraEU,
    vatRegime: isIntraEU ? 'reverse_charge' : 'standard',
    control: {
      passed: true,
      status: 'passed',
      message: isIntraEU
        ? `Intra-EU transaction detected (${countryCode})`
        : `Extra-EU transaction (${countryCode})`,
      severity: 'info'
    }
  };
}

/**
 * 3. VAT Zero Verification
 * For intra-EU transactions, VAT should be 0 (reverse charge)
 */
export function verifyVATZero(
  taxAmount: number,
  isIntraEU: boolean
): ControlDetail {
  if (!isIntraEU) {
    return {
      passed: true,
      status: 'passed',
      message: 'VAT verification not applicable (extra-EU)',
      severity: 'info'
    };
  }

  if (taxAmount === 0 || taxAmount === null) {
    return {
      passed: true,
      status: 'passed',
      message: 'VAT = 0 for intra-EU transaction (reverse charge)',
      severity: 'info'
    };
  }

  return {
    passed: false,
    status: 'warning',
    message: `Intra-EU transaction with VAT > 0 (${taxAmount.toFixed(2)}). Possible error or special regime.`,
    severity: 'warning',
    actual: taxAmount,
    expected: 0
  };
}

/**
 * Store VAT control results in database
 */
async function storeVATControlResults(
  documentId: string,
  controls: {
    arithmeticTTC: ControlDetail;
    intraEUClassification: ControlDetail;
    vatZeroVerification: ControlDetail;
  },
  overallStatus: 'passed' | 'warning' | 'failed',
  isIntraEU: boolean,
  vatRegime: 'standard' | 'reverse_charge' | 'exempted' | 'not_applicable'
): Promise<void> {
  try {
    // Update document with VAT control status
    await supabaseAdmin
      .from('idp_documents')
      .update({
        vat_control_status: overallStatus,
        vat_control_results: {
          arithmeticTTC: controls.arithmeticTTC,
          intraEUClassification: controls.intraEUClassification,
          vatZeroVerification: controls.vatZeroVerification,
          timestamp: new Date().toISOString()
        },
        is_intra_eu: isIntraEU,
        vat_regime: vatRegime
      })
      .eq('id', documentId);

    // Insert individual control records
    const controlRecords = [
      {
        document_id: documentId,
        control_type: 'arithmetic_ttc',
        status: controls.arithmeticTTC.status,
        expected_value: controls.arithmeticTTC.expected,
        actual_value: controls.arithmeticTTC.actual,
        difference: controls.arithmeticTTC.difference,
        tolerance: 2.00,
        message: controls.arithmeticTTC.message,
        severity: controls.arithmeticTTC.severity
      },
      {
        document_id: documentId,
        control_type: 'intra_eu_classification',
        status: controls.intraEUClassification.status,
        message: controls.intraEUClassification.message,
        severity: controls.intraEUClassification.severity
      },
      {
        document_id: documentId,
        control_type: 'vat_zero_verification',
        status: controls.vatZeroVerification.status,
        expected_value: controls.vatZeroVerification.expected,
        actual_value: controls.vatZeroVerification.actual,
        message: controls.vatZeroVerification.message,
        severity: controls.vatZeroVerification.severity
      }
    ];

    await supabaseAdmin
      .from('deb_vat_controls')
      .insert(controlRecords);

  } catch (error) {
    console.error('Error storing VAT control results:', error);
    throw new Error(`Failed to store VAT controls: ${error}`);
  }
}

/**
 * Retrieve VAT control results for a document
 */
export async function getVATControlResults(documentId: string): Promise<VATControlResult | null> {
  try {
    const { data: document, error: docError } = await supabaseAdmin
      .from('idp_documents')
      .select('vat_control_status, vat_control_results, is_intra_eu')
      .eq('id', documentId)
      .single();

    if (docError || !document || !document.vat_control_results) {
      return null;
    }

    const results = document.vat_control_results as any;

    return {
      passed: document.vat_control_status === 'passed',
      overallStatus: document.vat_control_status as 'passed' | 'warning' | 'failed',
      controls: {
        arithmeticTTC: results.arithmeticTTC,
        intraEUClassification: results.intraEUClassification,
        vatZeroVerification: results.vatZeroVerification
      },
      needsManualReview: document.vat_control_status === 'failed'
    };
  } catch (error) {
    console.error('Error retrieving VAT control results:', error);
    return null;
  }
}

/**
 * Helper: Extract country code from VAT number
 */
export function extractCountryFromVAT(vatNumber: string): string | null {
  if (!vatNumber) return null;

  const match = vatNumber.match(/^([A-Z]{2})/);
  return match ? match[1] : null;
}

/**
 * Helper: Validate VAT number format (basic check)
 */
export function validateVATFormat(vatNumber: string): boolean {
  if (!vatNumber) return false;

  // Basic EU VAT format: 2 letters + 2-12 alphanumeric characters
  return /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(vatNumber);
}
