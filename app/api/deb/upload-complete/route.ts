import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { documentId } = await request.json();
    
    console.log('📁 Upload completed for document:', documentId);

    // Récupérer les informations du document
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Error fetching document:', docError);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Générer l'URL publique du fichier pour N8N
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('deb-docs')
      .createSignedUrl(document.file_url, 3600); // 1 heure

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL for N8N:', urlError);
      return NextResponse.json(
        { error: 'Failed to generate file URL' },
        { status: 500 }
      );
    }

    // Déclencher le workflow N8N automatiquement
    const triggerData = {
      document_id: document.id,
      file_url: signedUrlData.signedUrl,
      org_id: document.org_id,
      name: document.name,
      file_type: document.file_type,
      created_at: document.created_at
    };

    // Appel du webhook N8N
    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      
      if (n8nWebhookUrl) {
        console.log('🔄 Triggering N8N workflow...');
        
        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.N8N_API_KEY && { 
              'Authorization': `Bearer ${process.env.N8N_API_KEY}` 
            })
          },
          body: JSON.stringify(triggerData),
          signal: AbortSignal.timeout(10000) // 10 secondes timeout
        });

        if (n8nResponse.ok) {
          const n8nResult = await n8nResponse.json();
          console.log('✅ N8N workflow triggered successfully:', n8nResult);
          
          // Mettre à jour le statut du document
          await supabaseAdmin
            .from('documents')
            .update({
              status: 'processing',
              updated_at: new Date().toISOString()
            })
            .eq('id', documentId);

          return NextResponse.json({
            success: true,
            message: 'Document uploaded and processing started',
            document_id: documentId,
            processing_status: 'started',
            n8n_triggered: true
          });
        } else {
          console.error('N8N webhook failed:', n8nResponse.status, n8nResponse.statusText);
        }
      } else {
        console.log('⚠️ N8N_WEBHOOK_URL not configured, skipping automatic processing');
      }
    } catch (n8nError) {
      console.error('N8N trigger error:', n8nError);
      // Ne pas échouer l'upload même si N8N échoue
    }

    // Même si N8N échoue, confirmer que l'upload est réussi
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'uploaded',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      document_id: documentId,
      processing_status: 'uploaded',
      n8n_triggered: !!process.env.N8N_WEBHOOK_URL
    });

  } catch (error) {
    console.error('❌ Upload completion error:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}