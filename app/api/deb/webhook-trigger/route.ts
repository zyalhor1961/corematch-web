import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('🚀 Triggering N8N workflow for document:', data.document_id);

    // Déclencher le workflow N8N
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://votre-n8n.app/webhook/deb-webhook';
    
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_API_KEY}` // Si authentification requise
      },
      body: JSON.stringify({
        id: data.document_id,
        file_url: data.file_url,
        org_id: data.org_id,
        name: data.name || 'document.pdf',
        triggered_at: new Date().toISOString(),
        source: 'corematch-api'
      })
    });

    if (!n8nResponse.ok) {
      throw new Error(`N8N webhook failed: ${n8nResponse.status} ${n8nResponse.statusText}`);
    }

    const n8nResult = await n8nResponse.json();
    
    console.log('✅ N8N workflow triggered successfully:', n8nResult);

    return NextResponse.json({
      success: true,
      message: 'N8N workflow triggered successfully',
      workflow_id: n8nResult.workflow_id,
      document_id: data.document_id,
      processing_started: true
    });

  } catch (error) {
    console.error('❌ N8N webhook trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger N8N workflow', details: error.message },
      { status: 500 }
    );
  }
}