import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for full processing

/**
 * POST /api/invoices/process
 *
 * SIMPLIFIED AUTOMATIC WORKFLOW:
 * 1. Upload PDF
 * 2. Analyze with Azure (automatic)
 * 3. Run DEB controls (automatic)
 * 4. Distribute weight & charges (automatic)
 * 5. Save to invoice table with status
 * 6. Return results
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let documentId: string | null = null;

  try {
    console.log('🚀 Starting simplified invoice processing workflow');

    // ============================================
    // STEP 1: UPLOAD PDF
    // ============================================
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const orgId = formData.get('orgId') as string;

    if (!file || !orgId) {
      return NextResponse.json(
        { error: 'File and orgId are required' },
        { status: 400 }
      );
    }

    console.log('📄 Step 1: Uploading PDF:', file.name);

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `${orgId}/${filename}`;

    const { error: uploadError } = await supabase
      .storage
      .from('idp-documents')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get signed URL for Azure
    const { data: urlData } = await supabase
      .storage
      .from('idp-documents')
      .createSignedUrl(storagePath, 3600);

    if (!urlData) {
      throw new Error('Failed to create signed URL');
    }

    // Create document record with status "processing"
    const { data: document, error: docError } = await supabase
      .from('idp_documents')
      .insert({
        org_id: orgId,
        filename: filename,
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: 'application/pdf',
        document_type: 'invoice',
        storage_bucket: 'idp-documents',
        storage_path: storagePath,
        status: 'processing',
        processing_notes: 'Step 1: Uploaded, starting analysis'
      })
      .select()
      .single();

    if (docError || !document) {
      throw new Error(`Failed to create document record: ${docError?.message}`);
    }

    documentId = document.id;
    console.log('✅ Step 1 complete: Document uploaded, ID:', documentId);

    // ============================================
    // STEP 2: ANALYZE WITH AZURE (AUTOMATIC)
    // ============================================
    console.log('🔍 Step 2: Analyzing with Azure Document Intelligence');

    await supabase
      .from('idp_documents')
      .update({ processing_notes: 'Step 2: Analyzing with Azure' })
      .eq('id', documentId);

    const analyzeResponse = await fetch(`${request.nextUrl.origin}/api/idp/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUrl: urlData.signedUrl,
        documentId: documentId,
        orgId: orgId,
        filename: file.name,
        documentType: 'invoice',
        autoDetect: true,
      }),
    });

    if (!analyzeResponse.ok) {
      throw new Error('Azure analysis failed');
    }

    const analyzeResult = await analyzeResponse.json();
    console.log('✅ Step 2 complete: Extracted', analyzeResult.data?.fields?.length || 0, 'fields');

    // ============================================
    // STEP 3: RUN DEB CONTROLS (AUTOMATIC)
    // ============================================
    console.log('🎯 Step 3: Running DEB VAT controls');

    await supabase
      .from('idp_documents')
      .update({ processing_notes: 'Step 3: Running VAT controls' })
      .eq('id', documentId);

    // Get extracted financial data
    const { data: docData } = await supabase
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    let controlsStatus = 'pending';
    let controlsResult: any = null;

    if (docData && docData.net_amount && docData.total_amount) {
      const vatResponse = await fetch(`${request.nextUrl.origin}/api/deb/documents/${documentId}/vat-control`, {
        method: 'POST'
      });

      if (vatResponse.ok) {
        const vatData = await vatResponse.json();
        controlsResult = vatData.controls;
        controlsStatus = vatData.controls?.overallStatus || 'unknown';
        console.log('✅ Step 3 complete: VAT controls status:', controlsStatus);
      }
    } else {
      console.log('⚠️  Step 3 skipped: Missing financial data for VAT controls');
      controlsStatus = 'skipped';
    }

    // ============================================
    // STEP 4: ENRICH HS CODES & WEIGHTS (AUTOMATIC)
    // ============================================
    console.log('🔧 Step 4: Enriching HS codes and weights');

    await supabase
      .from('idp_documents')
      .update({ processing_notes: 'Step 4: Enriching HS codes' })
      .eq('id', documentId);

    // Get line items
    const { data: lineItems } = await supabase
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .ilike('field_name', '%item%');

    let enrichmentStatus = 'pending';
    let enrichmentResult: any = null;

    if (lineItems && lineItems.length > 0) {
      const enrichResponse = await fetch(`${request.nextUrl.origin}/api/deb/documents/${documentId}/enrich-hs-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: orgId,
          lineItems: lineItems.map((item: any, index: number) => ({
            lineId: `line-${index}`,
            description: item.value_text || 'Unknown item',
            quantity: 1,
            unitPrice: 0,
            valueHT: 0
          }))
        })
      });

      if (enrichResponse.ok) {
        enrichmentResult = await enrichResponse.json();
        enrichmentStatus = 'completed';
        console.log('✅ Step 4 complete: Enriched', enrichmentResult.suggestions?.length || 0, 'items');
      }
    } else {
      console.log('⚠️  Step 4 skipped: No line items found');
      enrichmentStatus = 'skipped';
    }

    // ============================================
    // STEP 5: DISTRIBUTE CHARGES (AUTOMATIC)
    // ============================================
    console.log('💰 Step 5: Distributing shipping charges');

    await supabase
      .from('idp_documents')
      .update({ processing_notes: 'Step 5: Distributing charges' })
      .eq('id', documentId);

    let totalWithCharges = docData?.total_amount || 0;
    let shippingCharge = 0;

    // Check if there's shipping/transport in the extracted data
    const { data: shippingFields } = await supabase
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .or('field_name.ilike.%shipping%,field_name.ilike.%transport%,field_name.ilike.%freight%');

    if (shippingFields && shippingFields.length > 0) {
      shippingCharge = parseFloat(shippingFields[0].value_text || '0') || 0;
      totalWithCharges = (docData?.total_amount || 0) + shippingCharge;
      console.log('✅ Step 5 complete: Added shipping charge:', shippingCharge);
    } else {
      console.log('⚠️  Step 5: No shipping charges found');
    }

    // ============================================
    // STEP 6: SAVE TO INVOICE TABLE WITH STATUS
    // ============================================
    console.log('💾 Step 6: Saving to invoice table');

    // Calculate overall status
    let overallStatus = 'completed';
    if (controlsStatus === 'failed' || enrichmentStatus === 'failed') {
      overallStatus = 'failed';
    } else if (controlsStatus === 'warning') {
      overallStatus = 'warning';
    }

    // Update document with final status
    await supabase
      .from('idp_documents')
      .update({
        status: overallStatus,
        processing_notes: JSON.stringify({
          completed: new Date().toISOString(),
          steps: {
            upload: 'completed',
            analysis: 'completed',
            vatControls: controlsStatus,
            hsEnrichment: enrichmentStatus,
            chargeDistribution: shippingCharge > 0 ? 'completed' : 'skipped'
          }
        }),
        processed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    console.log('✅ Step 6 complete: Invoice saved with status:', overallStatus);

    // ============================================
    // RETURN COMPLETE RESULTS
    // ============================================
    return NextResponse.json({
      success: true,
      documentId: documentId,
      status: overallStatus,
      workflow: {
        step1_upload: {
          status: 'completed',
          filename: file.name,
          size: file.size
        },
        step2_analysis: {
          status: 'completed',
          fieldsExtracted: analyzeResult.data?.fields?.length || 0,
          confidence: analyzeResult.data?.confidence || 0
        },
        step3_vatControls: {
          status: controlsStatus,
          results: controlsResult
        },
        step4_hsEnrichment: {
          status: enrichmentStatus,
          itemsEnriched: enrichmentResult?.suggestions?.length || 0
        },
        step5_charges: {
          status: shippingCharge > 0 ? 'completed' : 'skipped',
          shippingCharge: shippingCharge,
          totalWithCharges: totalWithCharges,
          originalTotal: docData?.total_amount || 0
        }
      },
      invoice: {
        documentId: documentId,
        invoiceNumber: docData?.invoice_number,
        vendor: docData?.vendor_name,
        totalAmount: docData?.total_amount,
        totalWithCharges: totalWithCharges,
        currency: docData?.currency_code,
        status: overallStatus,
        vatControlStatus: controlsStatus
      },
      message: 'Invoice processed successfully through all steps'
    });

  } catch (error: any) {
    console.error('❌ Processing failed:', error);

    // Update document status to failed
    if (documentId) {
      await supabase
        .from('idp_documents')
        .update({
          status: 'failed',
          processing_notes: `Processing failed: ${error.message}`
        })
        .eq('id', documentId);
    }

    return NextResponse.json({
      error: error.message || 'Processing failed',
      documentId: documentId,
      stack: error.stack
    }, { status: 500 });
  }
}
