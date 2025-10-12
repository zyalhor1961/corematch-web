import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument, analyzeDocumentFromBuffer, detectBestModel, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; // 60 seconds for document analysis

/**
 * Parse French date formats to ISO date
 * Examples: "31 juillet 2025" -> "2025-07-31"
 */
function parseFrenchDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // French month names
  const frenchMonths: { [key: string]: string } = {
    'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08', 'aout': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12'
  };

  // Try to match French format: "31 juillet 2025" or "31/07/2025"
  const frenchPattern = /(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i;
  const match = dateStr.match(frenchPattern);

  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const year = match[3];
    const month = frenchMonths[monthName];

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try numeric format: "31/07/2025" or "31-07-2025"
  const numericPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  const numMatch = dateStr.match(numericPattern);

  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    const year = numMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try ISO format (already correct)
  const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
  if (isoPattern.test(dateStr)) {
    return dateStr.substring(0, 10); // Keep only date part
  }

  return null;
}

/**
 * POST /api/idp/analyze
 *
 * Analyze a document using Azure Document Intelligence and save to database
 *
 * Body:
 * - documentUrl: URL to the document (with SAS token)
 * - documentId: ID of the document in idp_documents table
 * - orgId: Organization ID
 * - modelId: (optional) Specific model to use, defaults to auto-detection
 * - autoDetect: (optional) Auto-detect best model based on filename
 * - filename: Document filename
 * - documentType: Document type (invoice, receipt, etc.)
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: any = null;

  try {
    body = await request.json();
    const {
      documentUrl,
      documentId,
      orgId,
      modelId,
      filename,
      documentType = 'general',
      autoDetect = true
    } = body;

    if (!documentUrl || !documentId || !orgId) {
      return NextResponse.json(
        { error: 'documentUrl, documentId, and orgId are required' },
        { status: 400 }
      );
    }

    // Update document status to processing
    await supabase
      .from('idp_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Determine which model to use
    let selectedModel = modelId || AzurePrebuiltModel.GENERAL_DOCUMENT;

    if (autoDetect && filename) {
      selectedModel = detectBestModel(filename);
      console.log(`Auto-detected model for "${filename}": ${selectedModel}`);
    }

    console.log(`Analyzing document with Azure Document Intelligence...`);
    console.log(`Model: ${selectedModel}`);
    console.log(`Document URL: ${documentUrl.substring(0, 50)}...`);

    // Analyze document
    const result = await analyzeDocument(documentUrl, selectedModel);

    console.log(`Analysis complete! Extracted ${result.fields.length} fields, ${result.tables.length} tables`);
    console.log(`Overall confidence: ${Math.round(result.confidence * 100)}%`);

    // Extract financial data from fields
    let totalAmount: number | null = null;
    let taxAmount: number | null = null;
    let netAmount: number | null = null;
    let currencyCode: string | null = null;
    let documentDate: string | null = null;
    let dueDate: string | null = null;
    let vendorName: string | null = null;
    let vendorVat: string | null = null;
    let invoiceNumber: string | null = null;
    let customerName: string | null = null;

    for (const field of result.fields) {
      const fieldName = field.name.toLowerCase();
      const fieldValue = field.value?.toString() || '';

      // Amount fields (English + French)
      if (fieldName.includes('total') ||
          fieldName.includes('invoicetotal') ||
          fieldName.includes('amounttotal') ||
          fieldName.includes('total à payer') ||
          fieldName.includes('montant total') ||
          fieldName.includes('totalpayer')) {
        const parsed = parseFloat(fieldValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (!isNaN(parsed) && !totalAmount) {
          totalAmount = parsed;
        }
      }

      // Tax/VAT fields (English + French)
      if (fieldName.includes('tax') ||
          fieldName.includes('vat') ||
          fieldName.includes('taxamount') ||
          fieldName.includes('tva') ||
          fieldName.includes('montant tva')) {
        const parsed = parseFloat(fieldValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (!isNaN(parsed) && !taxAmount) {
          taxAmount = parsed;
        }
      }

      // Net/Subtotal fields (English + French)
      if (fieldName.includes('subtotal') ||
          fieldName.includes('net') ||
          fieldName.includes('montant ht') ||
          fieldName.includes('total ht')) {
        const parsed = parseFloat(fieldValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (!isNaN(parsed) && !netAmount) {
          netAmount = parsed;
        }
      }

      // Currency - try to extract from amount fields
      if (fieldValue.includes('€') || fieldValue.includes('EUR')) {
        currencyCode = 'EUR';
      } else if (fieldValue.includes('$') || fieldValue.includes('USD')) {
        currencyCode = 'USD';
      } else if (fieldValue.includes('£') || fieldValue.includes('GBP')) {
        currencyCode = 'GBP';
      }

      // Dates (English + French) - parse to ISO format
      if (fieldName.includes('invoicedate') ||
          fieldName.includes('date de la facture') ||
          fieldName.includes('date facture') ||
          (fieldName.includes('date') && !fieldName.includes('duedate') && !fieldName.includes('paymentdate') && !documentDate)) {
        const parsed = parseFrenchDate(fieldValue);
        if (parsed && !documentDate) {
          documentDate = parsed;
        }
      }
      if (fieldName.includes('duedate') ||
          fieldName.includes('paymentdate') ||
          fieldName.includes('date échéance') ||
          fieldName.includes('date paiement')) {
        const parsed = parseFrenchDate(fieldValue);
        if (parsed && !dueDate) {
          dueDate = parsed;
        }
      }

      // Vendor/Supplier (English + French)
      if (fieldName.includes('vendor') ||
          fieldName.includes('supplier') ||
          fieldName.includes('merchantname') ||
          fieldName.includes('vendu par') ||
          fieldName.includes('fournisseur') ||
          fieldName.includes('vendeur')) {
        if (!vendorName && fieldValue.length > 0) {
          vendorName = fieldValue;
        }
      }

      // VAT/Tax ID (English + French)
      if (fieldName.includes('vendorvat') ||
          fieldName.includes('vendortax') ||
          fieldName.includes('vendoraddresstaxid') ||
          fieldName.includes('tva') ||
          fieldName.includes('numéro tva')) {
        if (!vendorVat && fieldValue.length > 0) {
          vendorVat = fieldValue;
        }
      }

      // Invoice number (English + French)
      if (fieldName.includes('invoiceid') ||
          fieldName.includes('invoicenumber') ||
          fieldName.includes('numéro de la facture') ||
          fieldName.includes('numéro facture') ||
          fieldName.includes('n° facture')) {
        if (!invoiceNumber && fieldValue.length > 0) {
          invoiceNumber = fieldValue;
        }
      }

      // Customer (English + French)
      if (fieldName.includes('customer') ||
          fieldName.includes('billto') ||
          fieldName.includes('client') ||
          fieldName.includes('destinataire')) {
        if (!customerName && fieldValue.length > 0) {
          customerName = fieldValue;
        }
      }
    }

    // Update document with extracted data
    const { error: updateError } = await supabase
      .from('idp_documents')
      .update({
        status: 'processed',
        azure_model_id: selectedModel,
        azure_analyzed_at: new Date().toISOString(),
        overall_confidence: result.confidence,
        field_count: result.fields.length,
        page_count: result.pages.length,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        net_amount: netAmount,
        currency_code: currencyCode || 'EUR',
        document_date: documentDate,
        due_date: dueDate,
        vendor_name: vendorName,
        vendor_vat: vendorVat,
        invoice_number: invoiceNumber,
        customer_name: customerName,
        processed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document:', updateError);
    }

    // Save extracted fields
    const fieldsToInsert = result.fields.map((field, index) => ({
      document_id: documentId,
      field_name: field.name,
      field_type: field.type,
      value_text: field.value?.toString() || null,
      value_number: typeof field.value === 'number' ? field.value : parseFloat(field.value) || null,
      confidence: field.confidence,
      page_number: field.pageNumber || 1, // Use extracted page number from Azure
      bounding_box: field.boundingBox ? { polygon: field.boundingBox } : null,
      extraction_method: 'azure'
    }));

    if (fieldsToInsert.length > 0) {
      const { error: fieldsError } = await supabase
        .from('idp_extracted_fields')
        .insert(fieldsToInsert);

      if (fieldsError) {
        console.error('Error saving fields:', fieldsError);
      }
    }

    // Log audit trail
    await supabase
      .from('idp_audit_log')
      .insert({
        org_id: orgId,
        document_id: documentId,
        action: 'document_processed',
        action_category: 'document',
        metadata: {
          model_id: selectedModel,
          field_count: result.fields.length,
          confidence: result.confidence
        }
      });

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        modelId: result.modelId,
        confidence: result.confidence,
        fields: result.fields,
        tables: result.tables,
        pages: result.pages,
        keyValuePairs: result.keyValuePairs,
        analyzedAt: new Date().toISOString(),
        extracted: {
          totalAmount,
          taxAmount,
          netAmount,
          currencyCode,
          documentDate,
          vendorName,
          invoiceNumber
        }
      }
    });
  } catch (error: any) {
    console.error('Error in Azure analysis API:', error);

    // Update document status to failed if we have documentId
    if (body?.documentId) {
      await supabase
        .from('idp_documents')
        .update({
          status: 'failed',
          processing_notes: error.message
        })
        .eq('id', body.documentId);
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to analyze document',
        details: error.details || null
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/idp/analyze/models
 *
 * Get list of available prebuilt models
 */
export async function GET(request: NextRequest) {
  try {
    const models = [
      {
        id: AzurePrebuiltModel.GENERAL_DOCUMENT,
        name: 'General Document',
        description: 'Extract text, tables, and key-value pairs from any document'
      },
      {
        id: AzurePrebuiltModel.INVOICE,
        name: 'Invoice',
        description: 'Extract vendor, customer, amounts, line items, and dates from invoices'
      },
      {
        id: AzurePrebuiltModel.RECEIPT,
        name: 'Receipt',
        description: 'Extract merchant, date, total, and line items from receipts'
      },
      {
        id: AzurePrebuiltModel.BUSINESS_CARD,
        name: 'Business Card',
        description: 'Extract contact information from business cards'
      },
      {
        id: AzurePrebuiltModel.ID_DOCUMENT,
        name: 'ID Document',
        description: 'Extract information from passports, driver licenses, and ID cards'
      },
      {
        id: AzurePrebuiltModel.LAYOUT,
        name: 'Layout',
        description: 'Extract text and layout structure without semantic understanding'
      },
      {
        id: AzurePrebuiltModel.READ,
        name: 'Read',
        description: 'OCR optimized for text-heavy documents'
      },
      {
        id: AzurePrebuiltModel.TAX_US_W2,
        name: 'US W-2 Tax Form',
        description: 'Extract information from US W-2 tax forms'
      },
      {
        id: AzurePrebuiltModel.HEALTH_INSURANCE_CARD,
        name: 'US Health Insurance Card',
        description: 'Extract information from US health insurance cards'
      }
    ];

    return NextResponse.json({
      success: true,
      models
    });
  } catch (error: any) {
    console.error('Error getting models:', error);
    return NextResponse.json(
      { error: 'Failed to get models' },
      { status: 500 }
    );
  }
}
