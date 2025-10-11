import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocument, analyzeDocumentFromBuffer, detectBestModel, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; // 60 seconds for document analysis

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

      // Amount fields
      if (fieldName.includes('total') || fieldName.includes('invoicetotal') || fieldName.includes('amounttotal')) {
        totalAmount = parseFloat(field.value) || null;
      }
      if (fieldName.includes('tax') || fieldName.includes('vat') || fieldName.includes('taxamount')) {
        taxAmount = parseFloat(field.value) || null;
      }
      if (fieldName.includes('subtotal') || fieldName.includes('net')) {
        netAmount = parseFloat(field.value) || null;
      }

      // Currency
      if (fieldName.includes('currency')) {
        currencyCode = field.value?.toString().substring(0, 3).toUpperCase() || null;
      }

      // Dates
      if (fieldName.includes('invoicedate') || fieldName.includes('date')) {
        documentDate = field.value || null;
      }
      if (fieldName.includes('duedate') || fieldName.includes('paymentdate')) {
        dueDate = field.value || null;
      }

      // Vendor/Supplier
      if (fieldName.includes('vendor') || fieldName.includes('supplier') || fieldName.includes('merchantname')) {
        vendorName = field.value?.toString() || null;
      }
      if (fieldName.includes('vendorvat') || fieldName.includes('vendortax') || fieldName.includes('vendoraddresstaxid')) {
        vendorVat = field.value?.toString() || null;
      }

      // Invoice number
      if (fieldName.includes('invoiceid') || fieldName.includes('invoicenumber')) {
        invoiceNumber = field.value?.toString() || null;
      }

      // Customer
      if (fieldName.includes('customer') || fieldName.includes('billto')) {
        customerName = field.value?.toString() || null;
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
