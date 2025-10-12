import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectAndSplitInvoices } from '@/lib/utils/pdf-splitter';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for full processing

/**
 * POST /api/invoices/process
 *
 * NEW SPLIT-FIRST WORKFLOW:
 * 1. Upload original PDF
 * 2. Detect invoice boundaries
 * 3. Split PDF into separate invoices
 * 4. For EACH invoice:
 *    a. Upload to storage
 *    b. Create document record
 *    c. Analyze with Azure
 *    d. Run controls & enrichment
 * 5. Return all processed invoices
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const processedInvoices: any[] = [];

  try {
    console.log('🚀 Starting split-first invoice processing workflow');

    // ============================================
    // STEP 1: UPLOAD ORIGINAL PDF & GET SIGNED URL
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

    console.log('📄 Step 1: Uploading original PDF:', file.name);

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload original PDF to temporary location
    const timestamp = Date.now();
    const originalFilename = `${timestamp}_original_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const originalStoragePath = `${orgId}/temp/${originalFilename}`;

    const { error: uploadError } = await supabase
      .storage
      .from('idp-documents')
      .upload(originalStoragePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get signed URL for analysis
    const { data: urlData } = await supabase
      .storage
      .from('idp-documents')
      .createSignedUrl(originalStoragePath, 3600);

    if (!urlData) {
      throw new Error('Failed to create signed URL');
    }

    console.log('✅ Step 1 complete: Original PDF uploaded');

    // ============================================
    // STEP 2: DETECT AND SPLIT INVOICES (TWO-PASS)
    // ============================================
    console.log('✂️  Step 2: Detecting invoice boundaries (Pass 1: Azure detection)...');

    const splitInvoices = await detectAndSplitInvoices(buffer, urlData.signedUrl);

    console.log(`✅ Step 2 complete: Detected and split into ${splitInvoices.length} invoice(s)`);

    // ============================================
    // STEP 3: PROCESS EACH INVOICE SEPARATELY (PASS 2)
    // ============================================
    console.log(`\n🔄 Pass 2: Processing each split invoice individually...`);

    for (let i = 0; i < splitInvoices.length; i++) {
      const invoiceData = splitInvoices[i];
      const invoiceNum = i + 1;

      console.log(`\n📋 Invoice ${invoiceNum}/${splitInvoices.length}: Pages ${invoiceData.pages.join(', ')} (${invoiceData.pages.length} page${invoiceData.pages.length > 1 ? 's' : ''})`);

      try {
        // Upload this invoice's PDF
        const invoiceFilename = splitInvoices.length > 1
          ? `${timestamp}_${file.name.replace(/\.pdf$/i, '')}_invoice${invoiceNum}.pdf`
          : `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const invoiceStoragePath = `${orgId}/${invoiceFilename}`;

        const { error: invoiceUploadError } = await supabase
          .storage
          .from('idp-documents')
          .upload(invoiceStoragePath, invoiceData.pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
          });

        if (invoiceUploadError) {
          console.error(`Failed to upload invoice ${invoiceNum}:`, invoiceUploadError);
          continue;
        }

        // Get signed URL for this invoice
        const { data: invoiceUrlData } = await supabase
          .storage
          .from('idp-documents')
          .createSignedUrl(invoiceStoragePath, 3600);

        if (!invoiceUrlData) {
          console.error(`Failed to create signed URL for invoice ${invoiceNum}`);
          continue;
        }

        // Create document record
        const { data: document, error: docError } = await supabase
          .from('idp_documents')
          .insert({
            org_id: orgId,
            filename: invoiceFilename,
            original_filename: splitInvoices.length > 1
              ? `${file.name} (Invoice ${invoiceNum} - Pages ${invoiceData.pages.join(', ')})`
              : file.name,
            file_size_bytes: invoiceData.pdfBuffer.length,
            mime_type: 'application/pdf',
            document_type: 'invoice',
            storage_bucket: 'idp-documents',
            storage_path: invoiceStoragePath,
            status: 'processing',
            processing_notes: `Invoice ${invoiceNum} of ${splitInvoices.length} from original PDF - Pages ${invoiceData.pages.join(', ')}`
          })
          .select()
          .single();

        if (docError || !document) {
          console.error(`Failed to create document record for invoice ${invoiceNum}:`, docError);
          continue;
        }

        const documentId = document.id;
        console.log(`✅ Created document record: ${documentId}`);

        // Analyze with Azure (Pass 2 - clean analysis of individual invoice)
        console.log(`🔍 Pass 2 Analysis: Sending invoice ${invoiceNum} to Azure...`);

        const analyzeResponse = await fetch(`${request.nextUrl.origin}/api/idp/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentUrl: invoiceUrlData.signedUrl,
            documentId: documentId,
            orgId: orgId,
            filename: invoiceFilename,
            documentType: 'invoice',
            autoDetect: true,
          }),
        });

        if (!analyzeResponse.ok) {
          const errorText = await analyzeResponse.text();
          console.error(`❌ Azure analysis failed for invoice ${invoiceNum}:`, errorText);
          await supabase
            .from('idp_documents')
            .update({
              status: 'failed',
              processing_notes: `Analysis failed: ${errorText.substring(0, 200)}`
            })
            .eq('id', documentId);
          continue;
        }

        const analyzeResult = await analyzeResponse.json();
        console.log(`✅ Analyzed invoice ${invoiceNum}: Extracted ${analyzeResult.data?.fields?.length || 0} fields`);

        // Get extracted data
        const { data: docData } = await supabase
          .from('idp_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        // Add to processed invoices list
        processedInvoices.push({
          documentId: documentId,
          invoiceNumber: docData?.invoice_number,
          vendor: docData?.vendor_name,
          totalAmount: docData?.total_amount,
          currency: docData?.currency_code,
          status: docData?.status,
          pages: invoiceData.pages,
          fieldsExtracted: analyzeResult.data?.fields?.length || 0
        });

        console.log(`✅ Invoice ${invoiceNum} processed successfully`);

      } catch (invoiceError: any) {
        console.error(`Error processing invoice ${invoiceNum}:`, invoiceError);
        // Continue with next invoice
      }
    }

    // Delete temporary original file
    try {
      await supabase.storage.from('idp-documents').remove([originalStoragePath]);
    } catch (cleanupError) {
      console.error('Failed to cleanup temporary file:', cleanupError);
    }

    // ============================================
    // RETURN ALL PROCESSED INVOICES
    // ============================================
    return NextResponse.json({
      success: true,
      totalInvoices: splitInvoices.length,
      processedInvoices: processedInvoices.length,
      invoices: processedInvoices,
      message: `Successfully processed ${processedInvoices.length} of ${splitInvoices.length} invoice(s)`
    });

  } catch (error: any) {
    console.error('❌ Processing failed:', error);

    return NextResponse.json({
      error: error.message || 'Processing failed',
      processedInvoices: processedInvoices.length,
      invoices: processedInvoices,
      stack: error.stack
    }, { status: 500 });
  }
}
