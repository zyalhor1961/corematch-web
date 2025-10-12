/**
 * DEB Archiving Service
 *
 * Prepares documents for export to SAE (Système d'Archivage Électronique)
 * Validates completeness and generates metadata
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { getVATControlResults } from './vat-control';

export interface ArchiveMetadata {
  documentId: string;
  organizationId: string;

  // Document Info
  documentType: string;
  fileName: string;
  fileSize?: number;
  pageCount: number;

  // Supplier Info
  supplier: {
    name: string;
    vat: string;
    country: string;
    address?: string;
  };

  // Invoice Info
  invoice: {
    number: string;
    date: string;
    dueDate?: string;
    currency: string;
  };

  // Financial Data
  financial: {
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
    shippingCost?: number;
  };

  // VAT Controls
  vatControls: {
    status: string;
    isIntraEU: boolean;
    vatRegime: string;
    controls: any;
  };

  // Line Items
  lineItems: Array<{
    lineNumber: number;
    description: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
    hsCode: string;
    weightKg: number;
    countryOfOrigin?: string;
    shippingAllocated?: number;
    customsValue?: number;
    validated: boolean;
  }>;

  // Validation Status
  validation: {
    allLinesValidated: boolean;
    vatControlsPassed: boolean;
    readyForExport: boolean;
    validatedAt?: string;
    validatedBy?: string;
  };

  // Metadata
  createdAt: string;
  processedAt: string;
  archivedAt?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0-100%
}

/**
 * Validate document is complete and ready for archiving
 */
export async function validateDocumentComplete(
  documentId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let completedFields = 0;
  let totalFields = 0;

  try {
    // Fetch document
    const { data: document, error: docError } = await supabaseAdmin
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      errors.push('Document not found');
      return { valid: false, errors, warnings, completeness: 0 };
    }

    // Check required document fields
    const requiredDocFields = [
      'vendor_name',
      'vendor_vat',
      'vendor_country',
      'invoice_number',
      'document_date',
      'currency_code',
      'net_amount',
      'total_amount'
    ];

    for (const field of requiredDocFields) {
      totalFields++;
      if (document[field]) {
        completedFields++;
      } else {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check VAT controls passed
    totalFields++;
    if (document.vat_control_status === 'passed' || document.vat_control_status === 'warning') {
      completedFields++;
    } else if (document.vat_control_status === 'failed') {
      errors.push('VAT controls failed - manual review required');
    } else {
      warnings.push('VAT controls not run');
    }

    // Fetch and validate line items
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .eq('field_category', 'line_item');

    if (fieldsError) {
      errors.push(`Failed to fetch line items: ${fieldsError.message}`);
    } else if (!fields || fields.length === 0) {
      errors.push('No line items found in document');
    } else {
      // Check each line item
      for (const field of fields) {
        totalFields += 3; // HS code, weight, validation

        // Check HS code
        if (field.hs_code_suggested) {
          completedFields++;
        } else {
          errors.push(`Line ${field.id}: Missing HS code`);
        }

        // Check weight
        if (field.weight_kg_suggested && field.weight_kg_suggested > 0) {
          completedFields++;
        } else {
          errors.push(`Line ${field.id}: Missing or invalid weight`);
        }

        // Check validation
        if (field.is_validated) {
          completedFields++;
        } else {
          warnings.push(`Line ${field.id}: Not yet validated by user`);
        }
      }
    }

    const completeness = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;
    const valid = errors.length === 0 && completeness >= 90; // Allow 10% tolerance

    return {
      valid,
      errors,
      warnings,
      completeness: Math.round(completeness)
    };

  } catch (error: any) {
    errors.push(`Validation error: ${error.message}`);
    return { valid: false, errors, warnings, completeness: 0 };
  }
}

/**
 * Generate archive metadata for SAE export
 */
export async function generateArchiveMetadata(
  documentId: string
): Promise<ArchiveMetadata | null> {
  try {
    // Fetch document
    const { data: document, error: docError } = await supabaseAdmin
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Fetch VAT controls
    const vatControls = await getVATControlResults(documentId);

    // Fetch line items
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .eq('field_category', 'line_item')
      .order('field_name', { ascending: true });

    if (fieldsError) {
      throw new Error(`Failed to fetch line items: ${fieldsError.message}`);
    }

    const lineItems = (fields || []).map((field, index) => ({
      lineNumber: index + 1,
      description: field.value_text || '',
      sku: field.metadata?.sku,
      quantity: field.value_number || 0,
      unitPrice: field.metadata?.unit_price || 0,
      lineAmount: field.metadata?.line_amount || 0,
      hsCode: field.hs_code_suggested || '',
      weightKg: field.weight_kg_suggested || 0,
      countryOfOrigin: field.metadata?.country_of_origin,
      shippingAllocated: field.metadata?.shipping_allocated,
      customsValue: field.metadata?.customs_value,
      validated: field.is_validated || false
    }));

    const allLinesValidated = lineItems.every(line => line.validated);
    const vatControlsPassed = vatControls?.passed || false;

    const metadata: ArchiveMetadata = {
      documentId,
      organizationId: document.org_id,

      documentType: document.document_type || 'invoice',
      fileName: document.filename || '',
      fileSize: document.file_size_bytes,
      pageCount: document.page_count || 1,

      supplier: {
        name: document.vendor_name || '',
        vat: document.vendor_vat || '',
        country: document.vendor_country || '',
        address: document.vendor_address
      },

      invoice: {
        number: document.invoice_number || '',
        date: document.document_date || '',
        dueDate: document.due_date,
        currency: document.currency_code || 'EUR'
      },

      financial: {
        netAmount: document.net_amount || 0,
        taxAmount: document.tax_amount || 0,
        totalAmount: document.total_amount || 0,
        shippingCost: document.shipping_total
      },

      vatControls: {
        status: document.vat_control_status || 'pending',
        isIntraEU: document.is_intra_eu || false,
        vatRegime: document.vat_regime || 'standard',
        controls: vatControls?.controls || {}
      },

      lineItems,

      validation: {
        allLinesValidated,
        vatControlsPassed,
        readyForExport: allLinesValidated && vatControlsPassed,
        validatedAt: document.validated_at,
        validatedBy: document.validated_by
      },

      createdAt: document.created_at,
      processedAt: document.processed_at || new Date().toISOString(),
      archivedAt: document.archived_at
    };

    return metadata;

  } catch (error: any) {
    console.error('Error generating archive metadata:', error);
    return null;
  }
}

/**
 * Prepare document for archiving
 * Updates status and generates final metadata
 */
export async function prepareForArchiving(
  documentId: string
): Promise<{
  success: boolean;
  metadata?: ArchiveMetadata;
  validation: ValidationResult;
  message: string;
}> {
  try {
    // Validate document completeness
    const validation = await validateDocumentComplete(documentId);

    if (!validation.valid) {
      return {
        success: false,
        validation,
        message: `Document not ready for archiving: ${validation.errors.join(', ')}`
      };
    }

    // Generate metadata
    const metadata = await generateArchiveMetadata(documentId);

    if (!metadata) {
      return {
        success: false,
        validation,
        message: 'Failed to generate archive metadata'
      };
    }

    // Update document status to 'approved'
    const { error: updateError } = await supabaseAdmin
      .from('idp_documents')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        metadata: metadata
      })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    return {
      success: true,
      metadata,
      validation,
      message: 'Document prepared for archiving successfully'
    };

  } catch (error: any) {
    console.error('Error preparing for archiving:', error);
    return {
      success: false,
      validation: { valid: false, errors: [error.message], warnings: [], completeness: 0 },
      message: `Failed to prepare for archiving: ${error.message}`
    };
  }
}

/**
 * Export to SAE (placeholder - implement actual SAE integration)
 */
export async function exportToSAE(
  documentId: string,
  saeConfig?: {
    endpoint: string;
    apiKey: string;
  }
): Promise<{ success: boolean; message: string; exportId?: string }> {
  try {
    // Prepare for archiving first
    const preparation = await prepareForArchiving(documentId);

    if (!preparation.success || !preparation.metadata) {
      return {
        success: false,
        message: preparation.message
      };
    }

    // TODO: Implement actual SAE integration
    // This is a placeholder for the actual SAE API call
    // You would typically send the metadata to your SAE provider

    console.log('📦 Exporting to SAE:', documentId);
    console.log('Metadata:', JSON.stringify(preparation.metadata, null, 2));

    // Simulate SAE export (replace with actual API call)
    const exportId = `SAE-${Date.now()}`;

    // Update document status to 'exported'
    await supabaseAdmin
      .from('idp_documents')
      .update({
        status: 'exported',
        exported_at: new Date().toISOString(),
        metadata: {
          ...preparation.metadata,
          saeExportId: exportId
        }
      })
      .eq('id', documentId);

    return {
      success: true,
      message: 'Document exported to SAE successfully',
      exportId
    };

  } catch (error: any) {
    console.error('Error exporting to SAE:', error);
    return {
      success: false,
      message: `Failed to export to SAE: ${error.message}`
    };
  }
}
