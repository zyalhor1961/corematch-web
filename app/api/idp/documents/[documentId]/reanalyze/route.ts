import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeDocument, detectBestModel, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Parse French date formats to ISO date
function parseFrenchDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const frenchMonths: { [key: string]: string } = {
    'janvier': '01', 'fǸvrier': '02', 'fevrier': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'aoǯt': '08', 'aout': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'dǸcembre': '12', 'decembre': '12'
  };

  const frenchPattern = /(\d{1,2})\s+([a-zǸǯ]+)\s+(\d{4})/i;
  const match = dateStr.match(frenchPattern);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const year = match[3];
    const month = frenchMonths[monthName];
    if (month) return `${year}-${month}-${day}`;
  }

  const numericPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  const numMatch = dateStr.match(numericPattern);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    const year = numMatch[3];
    return `${year}-${month}-${day}`;
  }

  const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
  if (isoPattern.test(dateStr)) return dateStr.substring(0, 10);

  return null;
}

function extractFieldData(fields: any[], kvPairs?: { key: string; value: any; confidence: number }[]) {
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

  for (const field of fields) {
    const fieldName = (field.name || field.field_name || '').toLowerCase();
    const fieldValue = field.value ?? field.value_text;

    if (fieldName === 'invoicetotal' ||
        fieldName === 'amountdue' ||
        fieldName.includes('total') ||
        fieldName.includes('amounttotal') ||
        fieldName.includes('total �� payer') ||
        fieldName.includes('montant total') ||
        fieldName.includes('totalpayer')) {
      let parsed: number | null = null;
      if (typeof fieldValue === 'object' && fieldValue !== null && 'amount' in fieldValue) {
        parsed = (fieldValue as any).amount;
        if ('currencyCode' in (fieldValue as any) && (fieldValue as any).currencyCode) {
          currencyCode = (fieldValue as any).currencyCode;
        }
      } else {
        const strValue = (fieldValue?.toString() || '');
        parsed = parseFloat(strValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (strValue.includes('€') || strValue.includes('EUR')) currencyCode = 'EUR';
        else if (strValue.includes('$') || strValue.includes('USD')) currencyCode = 'USD';
        else if (strValue.includes('£') || strValue.includes('GBP')) currencyCode = 'GBP';
      }
      if (parsed && !isNaN(parsed) && !totalAmount) totalAmount = parsed;
    }

    const isTaxId = fieldName.includes('taxid') || fieldName.includes('tax id') ||
                    fieldName.includes('vendortaxid') || fieldName.includes('customertaxid');
    if (!isTaxId && (
        fieldName === 'totaltax' ||
        fieldName === 'taxamount' ||
        fieldName.includes('taxamount') ||
        fieldName.includes('vat') ||
        fieldName.includes('tva') ||
        fieldName.includes('montant tva'))) {
      let parsed: number | null = null;
      if (typeof fieldValue === 'object' && fieldValue !== null && 'amount' in fieldValue) {
        parsed = (fieldValue as any).amount;
      } else {
        const strValue = fieldValue?.toString() || '';
        parsed = parseFloat(strValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      }
      if (parsed && !isNaN(parsed) && !taxAmount) taxAmount = parsed;
    }

    if (fieldName === 'subtotal' ||
        fieldName.includes('net') ||
        fieldName.includes('montant ht') ||
        fieldName.includes('total ht')) {
      let parsed: number | null = null;
      if (typeof fieldValue === 'object' && fieldValue !== null && 'amount' in fieldValue) {
        parsed = (fieldValue as any).amount;
      } else {
        const strValue = fieldValue?.toString() || '';
        parsed = parseFloat(strValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      }
      if (parsed && !isNaN(parsed) && !netAmount) netAmount = parsed;
    }

    if (fieldName === 'invoicedate' ||
        fieldName.includes('date de la facture') ||
        fieldName.includes('date facture') ||
        (fieldName.includes('date') && !fieldName.includes('duedate') && !fieldName.includes('paymentdate') && !documentDate)) {
      const strValue = fieldValue?.toString() || '';
      const parsed = parseFrenchDate(strValue);
      if (parsed && !documentDate) documentDate = parsed;
    }
    if (fieldName === 'duedate' ||
        fieldName === 'paymentdate' ||
        fieldName.includes('date ǸchǸance') ||
        fieldName.includes('date paiement')) {
      const strValue = fieldValue?.toString() || '';
      const parsed = parseFrenchDate(strValue);
      if (parsed && !dueDate) dueDate = parsed;
    }

    if (fieldName === 'vendorname') {
      const strValue = fieldValue?.toString() || '';
      if (!vendorName && strValue.length > 0) vendorName = strValue;
    } else if (!vendorName && (
      fieldName.includes('supplier') ||
      fieldName.includes('merchantname') ||
      fieldName.includes('vendu par') ||
      fieldName.includes('fournisseur') ||
      fieldName.includes('vendeur'))) {
      const strValue = fieldValue?.toString() || '';
      if (strValue.length > 0) vendorName = strValue;
    }

    if (fieldName === 'vendortaxid' ||
        fieldName.includes('vendorvat') ||
        fieldName.includes('vendortax') ||
        fieldName.includes('vendoraddresstaxid') ||
        fieldName.includes('tva') ||
        fieldName.includes('numéro tva') || fieldName.includes('numǸro tva')) {
      const strValue = fieldValue?.toString() || '';
      if (!vendorVat && strValue.length > 0) vendorVat = strValue;
    }

    if (fieldName === 'invoiceid' ||
        fieldName === 'invoicenumber' ||
        fieldName.includes('numéro de la facture') || fieldName.includes('numǸro de la facture') ||
        fieldName.includes('numéro facture') || fieldName.includes('numǸro facture') ||
        fieldName.includes('n° facture') || fieldName.includes('n�� facture')) {
      const strValue = fieldValue?.toString() || '';
      if (!invoiceNumber && strValue.length > 0) invoiceNumber = strValue;
    }

    if (fieldName === 'customername' ||
        fieldName.includes('customer') ||
        fieldName.includes('billto') ||
        fieldName.includes('client') ||
        fieldName.includes('destinataire')) {
      const strValue = fieldValue?.toString() || '';
      if (!customerName && strValue.length > 0) customerName = strValue;
    }
  }

  // Fallbacks using key-value pairs if some critical values are still missing
  if (kvPairs && kvPairs.length > 0) {
    const findKV = (pred: (k: string) => boolean) => {
      const hit = kvPairs.find(p => pred(p.key.toLowerCase()));
      return hit?.value?.toString() || null;
    };

    if (!invoiceNumber) {
      invoiceNumber = findKV(k =>
        k.includes('invoice number') || k.includes('invoice no') || k.includes('invoice #') ||
        k.includes('no facture') || k.includes('n° facture') || k.includes('numéro facture') ||
        k.includes('numero facture') || k.includes('numéro de la facture') || k.includes('numero de la facture')
      );
    }

    if (!documentDate) {
      const raw = findKV(k =>
        k.includes('invoice date') || k.includes('issue date') || k.includes('date de la facture') ||
        (k.includes('date') && !k.includes('due'))
      );
      const parsed = raw ? parseFrenchDate(raw) : null;
      if (parsed) documentDate = parsed;
    }

    if (!vendorName) {
      vendorName = findKV(k =>
        k.includes('vendor') || k.includes('seller') || k.includes('sold by') ||
        k.includes('merchant') || k.includes('supplier') || k.includes('billed by') ||
        k.includes('bill from') || k.includes('vendeur') || k.includes('fournisseur')
      );
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Load document
    const { data: doc, error: docError } = await supabase
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (!doc || docError) {
      return NextResponse.json(
        { success: false, error: 'Document not found', details: docError?.message, code: docError?.code || 'DOC_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!doc.storage_bucket || !doc.storage_path || !doc.org_id) {
      return NextResponse.json(
        { success: false, error: 'Missing storage info', details: 'storage_bucket, storage_path or org_id missing', code: 'MISSING_STORAGE_INFO' },
        { status: 400 }
      );
    }

    // Create a signed URL
    const { data: signed, error: signedErr } = await supabase
      .storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 3600);

    if (signedErr || !signed?.signedUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to create signed URL', details: signedErr?.message, code: signedErr?.code || 'SIGNED_URL_FAILED' },
        { status: 500 }
      );
    }

    // Pick model
    let selectedModel = AzurePrebuiltModel.GENERAL_DOCUMENT;
    const filename = (doc.filename || doc.original_filename || '').toString();
    if (filename) selectedModel = detectBestModel(filename);

    // Mark processing
    await supabase
      .from('idp_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Analyze
    const result = await analyzeDocument(signed.signedUrl, selectedModel);

    // Extract key fields
    const extracted = extractFieldData(result.fields, result.keyValuePairs);

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
        processed_at: new Date().toISOString(),
        processing_notes: `Reanalyzed at ${new Date().toISOString()}`
      })
      .eq('id', documentId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update document', details: updateError.message, code: updateError.code },
        { status: 500 }
      );
    }

    // Replace extracted fields (clear + insert)
    await supabase
      .from('idp_extracted_fields')
      .delete()
      .eq('document_id', documentId);

    const fieldsToInsert = result.fields.map((field: any) => ({
      document_id: documentId,
      field_name: field.name,
      field_type: field.type,
      value_text: field.value?.toString() || null,
      value_number: typeof field.value === 'number' ? field.value : (parseFloat(field.value) || null),
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
        console.error('[reanalyze] Error saving fields:', fieldsError);
      }
    }

    // Audit log
    await supabase
      .from('idp_audit_log')
      .insert({
        org_id: doc.org_id,
        document_id: documentId,
        action: 'document_reanalyzed',
        action_category: 'document',
        metadata: {
          model_id: selectedModel,
          field_count: result.fields.length,
          confidence: result.confidence
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Document reanalyzed successfully',
      data: {
        documentId,
        modelId: selectedModel,
        confidence: result.confidence,
        extracted: {
          totalAmount: extracted.totalAmount,
          taxAmount: extracted.taxAmount,
          netAmount: extracted.netAmount,
          currencyCode: extracted.currencyCode,
          documentDate: extracted.documentDate,
          vendorName: extracted.vendorName,
          invoiceNumber: extracted.invoiceNumber
        }
      }
    });
  } catch (error: any) {
    console.error('Error in reanalyze API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
