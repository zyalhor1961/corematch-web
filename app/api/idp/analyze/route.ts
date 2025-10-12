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
 * Extract financial and metadata fields from Azure result
 */
function extractFieldData(fields: any[]) {
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

  // Log first 5 fields for debugging
  console.log('DEBUG: Sample fields:', fields.slice(0, 5).map(f => ({ name: f.name, value: f.value })));

  for (const field of fields) {
    const fieldName = field.name.toLowerCase();
    const fieldValue = field.value;

    // Amount fields - Azure returns complex objects like { amount: 92.29, currencyCode: 'EUR' }
    if (fieldName === 'invoicetotal' ||
        fieldName === 'amountdue' ||
        fieldName.includes('total') ||
        fieldName.includes('amounttotal') ||
        fieldName.includes('total à payer') ||
        fieldName.includes('montant total') ||
        fieldName.includes('totalpayer')) {

      let parsed: number | null = null;

      // Handle complex object (Azure Invoice model)
      if (typeof fieldValue === 'object' && fieldValue !== null && 'amount' in fieldValue) {
        parsed = fieldValue.amount;
        // Also extract currency
        if ('currencyCode' in fieldValue && fieldValue.currencyCode) {
          currencyCode = fieldValue.currencyCode;
        }
      }
      // Handle string/number
      else {
        const strValue = fieldValue?.toString() || '';
        parsed = parseFloat(strValue.replace(/[^\d,.-]/g, '').replace(',', '.'));

        // Try to extract currency from string
        if (strValue.includes('€') || strValue.includes('EUR')) {
          currencyCode = 'EUR';
        } else if (strValue.includes('$') || strValue.includes('USD')) {
          currencyCode = 'USD';
        } else if (strValue.includes('£') || strValue.includes('GBP')) {
          currencyCode = 'GBP';
        }
      }

      if (parsed && !isNaN(parsed) && !totalAmount) {
        totalAmount = parsed;
        console.log(`DEBUG: Found total amount: ${totalAmount} ${currencyCode || ''} from field "${field.name}"`);
      }
    }

    // Tax/VAT fields - also complex objects
    if (fieldName === 'totaltax' ||
        fieldName === 'taxamount' ||
        fieldName.includes('tax') ||
        fieldName.includes('vat') ||
        fieldName.includes('tva') ||
        fieldName.includes('montant tva')) {

      let parsed: number | null = null;

      if (typeof fieldValue === 'object' && fieldValue !== null && 'amount' in fieldValue) {
        parsed = fieldValue.amount;
      } else {
        const strValue = fieldValue?.toString() || '';
        parsed = parseFloat(strValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      }

      if (parsed && !isNaN(parsed) && !taxAmount) {
        taxAmount = parsed;
      }
    }

    // Net/Subtotal fields - also complex objects
    if (fieldName === 'subtotal' ||
        fieldName.includes('net') ||
        fieldName.includes('montant ht') ||
        fieldName.includes('total ht')) {

      let parsed: number | null = null;

      if (typeof fieldValue === 'object' && fieldValue !== null && 'amount' in fieldValue) {
        parsed = fieldValue.amount;
      } else {
        const strValue = fieldValue?.toString() || '';
        parsed = parseFloat(strValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      }

      if (parsed && !isNaN(parsed) && !netAmount) {
        netAmount = parsed;
      }
    }

    // Dates - Azure returns date strings
    if (fieldName === 'invoicedate' ||
        fieldName.includes('date de la facture') ||
        fieldName.includes('date facture') ||
        (fieldName.includes('date') && !fieldName.includes('duedate') && !fieldName.includes('paymentdate') && !documentDate)) {
      const strValue = fieldValue?.toString() || '';
      const parsed = parseFrenchDate(strValue);
      if (parsed && !documentDate) {
        documentDate = parsed;
        console.log(`DEBUG: Found document date: ${documentDate} from field "${field.name}"`);
      }
    }
    if (fieldName === 'duedate' ||
        fieldName === 'paymentdate' ||
        fieldName.includes('date échéance') ||
        fieldName.includes('date paiement')) {
      const strValue = fieldValue?.toString() || '';
      const parsed = parseFrenchDate(strValue);
      if (parsed && !dueDate) {
        dueDate = parsed;
      }
    }

    // Vendor - Azure uses "VendorName" (NOT VendorTaxId!)
    if (fieldName === 'vendorname') {
      const strValue = fieldValue?.toString() || '';
      if (!vendorName && strValue.length > 0) {
        vendorName = strValue;
        console.log(`DEBUG: Found vendor: ${vendorName} from field "${field.name}"`);
      }
    }
    // Fallback to other vendor fields only if VendorName not found
    else if (!vendorName && (
        fieldName.includes('supplier') ||
        fieldName.includes('merchantname') ||
        fieldName.includes('vendu par') ||
        fieldName.includes('fournisseur') ||
        fieldName.includes('vendeur'))) {
      const strValue = fieldValue?.toString() || '';
      if (strValue.length > 0) {
        vendorName = strValue;
      }
    }

    // VAT/Tax ID - Azure uses "VendorTaxId"
    if (fieldName === 'vendortaxid' ||
        fieldName.includes('vendorvat') ||
        fieldName.includes('vendortax') ||
        fieldName.includes('vendoraddresstaxid') ||
        fieldName.includes('tva') ||
        fieldName.includes('numéro tva')) {
      const strValue = fieldValue?.toString() || '';
      if (!vendorVat && strValue.length > 0) {
        vendorVat = strValue;
      }
    }

    // Invoice number - Azure uses "InvoiceId"
    if (fieldName === 'invoiceid' ||
        fieldName === 'invoicenumber' ||
        fieldName.includes('numéro de la facture') ||
        fieldName.includes('numéro facture') ||
        fieldName.includes('n° facture')) {
      const strValue = fieldValue?.toString() || '';
      if (!invoiceNumber && strValue.length > 0) {
        invoiceNumber = strValue;
        console.log(`DEBUG: Found invoice number: ${invoiceNumber} from field "${field.name}"`);
      }
    }

    // Customer - Azure uses "CustomerName"
    if (fieldName === 'customername' ||
        fieldName.includes('customer') ||
        fieldName.includes('billto') ||
        fieldName.includes('client') ||
        fieldName.includes('destinataire')) {
      const strValue = fieldValue?.toString() || '';
      if (!customerName && strValue.length > 0) {
        customerName = strValue;
      }
    }
  }

  return {
    totalAmount,
    taxAmount,
    netAmount,
    currencyCode,
    documentDate,
    dueDate,
    vendorName,
    vendorVat,
    invoiceNumber,
    customerName
  };
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

    // ============================================
    // DETECT MULTIPLE INVOICES IN ONE PDF
    // ============================================
    // Check if fields have Doc1_, Doc2_ prefixes (indicating multiple invoices)
    const hasMultipleInvoices = result.fields.some(f => /^Doc\d+_/.test(f.name));

    // Store extracted data for response (will be from first invoice if multiple)
    let extractedData: any = null;

    if (hasMultipleInvoices) {
      console.log('🔍 Multiple invoices detected in PDF! Splitting...');

      // Group fields by document number
      const fieldsByDoc: { [docNum: string]: typeof result.fields } = {};

      for (const field of result.fields) {
        const match = field.name.match(/^Doc(\d+)_/);
        if (match) {
          const docNum = match[1];
          if (!fieldsByDoc[docNum]) {
            fieldsByDoc[docNum] = [];
          }
          // Remove prefix for processing
          fieldsByDoc[docNum].push({
            ...field,
            name: field.name.replace(/^Doc\d+_/, '')
          });
        } else {
          // Fields without prefix go to Doc1
          if (!fieldsByDoc['1']) {
            fieldsByDoc['1'] = [];
          }
          fieldsByDoc['1'].push(field);
        }
      }

      const docNumbers = Object.keys(fieldsByDoc).sort();
      console.log(`📄 Split into ${docNumbers.length} invoices:`, docNumbers);

      // Get original document details
      const { data: originalDoc } = await supabase
        .from('idp_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      // Process each invoice separately
      const createdDocuments = [];

      for (let i = 0; i < docNumbers.length; i++) {
        const docNum = docNumbers[i];
        const docFields = fieldsByDoc[docNum];
        const isFirstDoc = i === 0;

        // Use existing documentId for first invoice, create new ones for others
        let currentDocId = documentId;

        if (!isFirstDoc && originalDoc) {
          // Create new document record for additional invoices
          const { data: newDoc, error: createError } = await supabase
            .from('idp_documents')
            .insert({
              org_id: originalDoc.org_id,
              filename: originalDoc.filename.replace(/(\.[^.]+)$/, `_invoice${i + 1}$1`),
              original_filename: `${originalDoc.original_filename} (Invoice ${i + 1})`,
              file_size_bytes: originalDoc.file_size_bytes,
              mime_type: originalDoc.mime_type,
              document_type: originalDoc.document_type,
              storage_bucket: originalDoc.storage_bucket,
              storage_path: originalDoc.storage_path,
              status: 'processing',
              created_by: originalDoc.created_by
            })
            .select()
            .single();

          if (createError || !newDoc) {
            console.error(`Failed to create document record for invoice ${i + 1}:`, createError);
            continue;
          }

          currentDocId = newDoc.id;
          console.log(`✅ Created new document record for invoice ${i + 1}: ${currentDocId}`);
        }

        // Extract data from this invoice's fields
        const extracted = extractFieldData(docFields);

        // Store first invoice's data for response
        if (isFirstDoc) {
          extractedData = extracted;
        }

        // Update document with extracted data
        await supabase
          .from('idp_documents')
          .update({
            status: 'processed',
            azure_model_id: selectedModel,
            azure_analyzed_at: new Date().toISOString(),
            overall_confidence: result.confidence,
            field_count: docFields.length,
            page_count: result.pages.length,
            total_amount: extracted.totalAmount,
            tax_amount: extracted.taxAmount,
            net_amount: extracted.netAmount,
            currency_code: extracted.currencyCode || 'EUR',
            document_date: extracted.documentDate,
            due_date: extracted.dueDate,
            vendor_name: extracted.vendorName,
            vendor_vat: extracted.vendorVat,
            invoice_number: extracted.invoiceNumber,
            customer_name: extracted.customerName,
            processed_at: new Date().toISOString(),
            processing_notes: isFirstDoc
              ? `Multi-invoice PDF: Invoice 1 of ${docNumbers.length}`
              : `Multi-invoice PDF: Invoice ${i + 1} of ${docNumbers.length}`
          })
          .eq('id', currentDocId);

        // Save fields for this invoice
        const fieldsToInsert = docFields.map((field) => ({
          document_id: currentDocId,
          field_name: field.name,
          field_type: field.type,
          value_text: field.value?.toString() || null,
          value_number: typeof field.value === 'number' ? field.value : parseFloat(field.value) || null,
          confidence: field.confidence,
          page_number: field.pageNumber || 1,
          bounding_box: field.boundingBox ? { polygon: field.boundingBox } : null,
          extraction_method: 'azure'
        }));

        if (fieldsToInsert.length > 0) {
          await supabase
            .from('idp_extracted_fields')
            .insert(fieldsToInsert);
        }

        createdDocuments.push({
          documentId: currentDocId,
          invoiceNumber: extracted.invoiceNumber,
          totalAmount: extracted.totalAmount,
          fieldCount: docFields.length
        });
      }

      console.log(`✅ Processed ${createdDocuments.length} invoices from multi-invoice PDF`);

    } else {
      // SINGLE INVOICE - Original logic
      console.log('📄 Single invoice detected, processing normally');

      const extracted = extractFieldData(result.fields);
      extractedData = extracted;

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
          total_amount: extracted.totalAmount,
          tax_amount: extracted.taxAmount,
          net_amount: extracted.netAmount,
          currency_code: extracted.currencyCode || 'EUR',
          document_date: extracted.documentDate,
          due_date: extracted.dueDate,
          vendor_name: extracted.vendorName,
          vendor_vat: extracted.vendorVat,
          invoice_number: extracted.invoiceNumber,
          customer_name: extracted.customerName,
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
        page_number: field.pageNumber || 1,
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
          totalAmount: extractedData?.totalAmount,
          taxAmount: extractedData?.taxAmount,
          netAmount: extractedData?.netAmount,
          currencyCode: extractedData?.currencyCode,
          documentDate: extractedData?.documentDate,
          vendorName: extractedData?.vendorName,
          invoiceNumber: extractedData?.invoiceNumber
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
