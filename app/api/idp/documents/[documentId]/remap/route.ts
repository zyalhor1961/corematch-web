import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeDocument, detectBestModel, AzurePrebuiltModel } from '@/lib/services/azure-document-intelligence';

export const runtime = 'nodejs';

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
 * POST /api/idp/documents/[documentId]/remap
 *
 * Re-map extracted fields to document columns using updated multilingual logic
 * Useful for fixing stuck documents that have fields extracted but not mapped
 */
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

    // Get all extracted fields for this document
    const { data: fields, error: fieldsError } = await supabase
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId);

    // Use a mutable reference for downstream processing
    let remapFields = fields || [];

    if (fieldsError || !fields) {
      return NextResponse.json(
        { success: false, error: 'Failed to load extracted fields' },
        { status: 500 }
      );
    }

    if (remapFields.length === 0) {
      // Attempt an automatic analyze pass to populate fields, if possible
      console.log('[remap] No extracted fields found. Attempting auto-analyze...');

      // Load document to get storage info
      const { data: doc, error: docError } = await supabase
        .from('idp_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (!doc || docError) {
        return NextResponse.json(
          {
            success: false,
            error: 'No extracted fields found for this document',
            details: 'Document not found or inaccessible',
            code: docError?.code || 'DOC_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      if (!doc.storage_bucket || !doc.storage_path || !doc.org_id) {
        return NextResponse.json(
          {
            success: false,
            error: 'No extracted fields found for this document',
            details: 'Document missing storage info; cannot auto-analyze',
            code: 'MISSING_STORAGE_INFO'
          },
          { status: 400 }
        );
      }

      // Create a signed URL for the stored file
      const { data: signed, error: signedErr } = await supabase
        .storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.storage_path, 3600);

      if (signedErr || !signed?.signedUrl) {
        return NextResponse.json(
          {
            success: false,
            error: 'No extracted fields found for this document',
            details: 'Failed to create signed URL for auto-analyze',
            code: signedErr?.code || 'SIGNED_URL_FAILED'
          },
          { status: 500 }
        );
      }

      // Directly invoke Azure analysis to populate fields (no internal HTTP)
      try {
        let selectedModel = AzurePrebuiltModel.GENERAL_DOCUMENT;
        const filename = (doc.filename || doc.original_filename || '').toString();
        if (filename) {
          selectedModel = detectBestModel(filename);
        }

        const result = await analyzeDocument(signed.signedUrl, selectedModel);

        // Update document basic analysis metadata
        await supabase
          .from('idp_documents')
          .update({
            status: 'processing',
            azure_model_id: selectedModel,
            azure_analyzed_at: new Date().toISOString(),
            overall_confidence: result.confidence,
            field_count: result.fields.length,
            page_count: result.pages.length
          })
          .eq('id', documentId);

        // Persist extracted fields
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
          const { error: fieldsInsertError } = await supabase
            .from('idp_extracted_fields')
            .insert(fieldsToInsert);
          if (fieldsInsertError) {
            console.error('[remap] Error saving extracted fields:', fieldsInsertError);
          }
        }

        // Re-fetch fields after analysis attempt
        const { data: fieldsAfter } = await supabase
          .from('idp_extracted_fields')
          .select('*')
          .eq('document_id', documentId);

        if (!fieldsAfter || fieldsAfter.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'No extracted fields found for this document',
              details: 'Auto-analyze succeeded but returned no fields',
              code: 'NO_FIELDS_AFTER_ANALYZE'
            },
            { status: 404 }
          );
        }

        // Swap to the newly extracted fields and continue remap flow
        console.log(`[remap] Auto-analyze produced ${fieldsAfter.length} fields; continuing remap`);
        remapFields = fieldsAfter;
      } catch (e: any) {
        return NextResponse.json(
          {
            success: false,
            error: 'No extracted fields found for this document',
            details: `Auto-analyze exception: ${e?.message || 'unknown'}`,
            code: 'AUTO_ANALYZE_EXCEPTION'
          },
          { status: 500 }
        );
      }
    }

    // Re-map fields using multilingual logic
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

    for (const field of remapFields) {
      const fieldName = field.field_name.toLowerCase();
      const fieldValue = field.value_text || '';

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

    // Update document with remapped data
    const updateData = {
      status: 'processed',
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
      processed_at: new Date().toISOString(),
      processing_notes: `Remapped at ${new Date().toISOString()} - ${remapFields.length} fields processed`
    };

    console.log('Updating document with data:', updateData);

    const { data: updatedDoc, error: updateError } = await supabase
      .from('idp_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update document',
          details: updateError.message,
          hint: updateError.hint,
          code: updateError.code
        },
        { status: 500 }
      );
    }

    console.log('Document updated successfully:', updatedDoc);

    return NextResponse.json({
      success: true,
      message: 'Document remapped successfully',
      mapped: {
        invoiceNumber,
        vendorName,
        totalAmount,
        currencyCode,
        documentDate,
        fieldsProcessed: remapFields.length
      }
    });
  } catch (error: any) {
    console.error('Error in remap API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
