import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkQuota } from '@/lib/utils/quotas';

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = await params;

    // Get document details
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('org_id, file_url, status, name')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.status !== 'uploaded') {
      return NextResponse.json(
        { error: 'Document is not in uploaded status' },
        { status: 400 }
      );
    }

    // Estimate pages for quota check (rough estimate: 1-50 pages per document)
    const estimatedPages = 10; // This would be determined by file size in production
    
    // Check quota before processing
    const quotaCheck = await checkQuota(document.org_id, 'deb', estimatedPages);
    if (!quotaCheck.canUse) {
      return NextResponse.json(
        { 
          error: 'DEB pages quota exceeded',
          remaining: quotaCheck.remaining,
          quota: quotaCheck.quota
        },
        { status: 429 }
      );
    }

    // Update document status
    await supabaseAdmin
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Create initial job
    await supabaseAdmin
      .from('jobs')
      .insert({
        document_id: documentId,
        stage: 'ocr',
        status: 'pending',
      });

    // Get signed URL for the document
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('deb-docs')
      .createSignedUrl(document.file_url, 3600);

    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to get document URL' },
        { status: 500 }
      );
    }

    // Trigger n8n webhook
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_DEB_INGEST_URL;
    if (n8nWebhookUrl) {
      try {
        const webhookResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: documentId,
            signed_url: signedUrlData.signedUrl,
            org_id: document.org_id,
            filename: document.name,
          }),
        });

        if (!webhookResponse.ok) {
          throw new Error(`n8n webhook failed: ${webhookResponse.status}`);
        }

        console.log('n8n webhook triggered successfully');
      } catch (webhookError) {
        console.error('n8n webhook error:', webhookError);
        
        // Update document status to error
        await supabaseAdmin
          .from('documents')
          .update({ status: 'error' })
          .eq('id', documentId);

        return NextResponse.json(
          { error: 'Failed to trigger processing workflow' },
          { status: 500 }
        );
      }
    } else {
      // If no n8n webhook configured, use our AI analysis
      console.log('N8N_WEBHOOK_DEB_INGEST_URL not configured, using AI analysis');
      
      // Start AI analysis
      setTimeout(async () => {
        try {
          console.log('Starting AI analysis for document:', documentId);
          
          const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/deb/documents/${documentId}/analyze`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!analysisResponse.ok) {
            throw new Error(`AI analysis failed: ${analysisResponse.status}`);
          }

          const analysisData = await analysisResponse.json();
          console.log('AI analysis completed:', analysisData);

        } catch (error) {
          console.error('AI Analysis error:', error);
          
          // Update document status to error
          await supabaseAdmin
            .from('documents')
            .update({ status: 'error' })
            .eq('id', documentId);
        }
      }, 3000);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Document processing started',
        documentId,
        status: 'processing',
      },
    });

  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json(
      { error: 'Failed to start document processing' },
      { status: 500 }
    );
  }
}

// Simulation function for demo purposes
async function simulateProcessing(documentId: string) {
  try {
    // Simulate OCR stage
    await supabaseAdmin
      .from('jobs')
      .update({ status: 'running', progress: 25 })
      .eq('document_id', documentId)
      .eq('stage', 'ocr');

    // Create dummy pages
    await supabaseAdmin
      .from('document_pages')
      .insert([
        {
          document_id: documentId,
          page_no: 1,
          type: 'invoice',
          confidence: 0.95,
        },
        {
          document_id: documentId,
          page_no: 2,
          type: 'delivery_note',
          confidence: 0.92,
        }
      ]);

    // Update document
    await supabaseAdmin
      .from('documents')
      .update({
        pages_count: 2,
        confidence_avg: 0.935,
        status: 'parsed',
        supplier_name: 'Demo Supplier Ltd',
        supplier_vat: 'FR12345678901',
        supplier_country: 'FR',
        invoice_number: 'INV-2024-001',
        invoice_date: '2024-01-15',
        total_ht: 1000.00,
        shipping_total: 50.00,
      })
      .eq('id', documentId);

    // Complete OCR job
    await supabaseAdmin
      .from('jobs')
      .update({ status: 'completed', progress: 100 })
      .eq('document_id', documentId)
      .eq('stage', 'ocr');

    console.log(`Simulated processing completed for document ${documentId}`);
  } catch (error) {
    console.error('Simulation error:', error);
  }
}