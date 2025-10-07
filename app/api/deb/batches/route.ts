import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../_helpers';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const orgId = formData.get('orgId');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier PDF requis' }, { status: 400 });
    }

    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json({ error: 'orgId manquant' }, { status: 400 });
    }

    const membership = await requireOrgMembership(orgId, ['org_admin', 'org_manager']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9\.\-_]+/g, '_');
    const batchId = randomUUID();
    const documentId = randomUUID();
    const objectPath = `deb/${orgId}/${batchId}/${Date.now()}-${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('deb-docs')
      .upload(objectPath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload vers Supabase Storage echoue', uploadError);
      return NextResponse.json({ error: "Impossible d'uploader le fichier" }, { status: 500 });
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('deb_batches')
      .insert({
        id: batchId,
        org_id: orgId,
        created_by: membership.userId,
        source_filename: file.name,
        storage_object_path: objectPath,
        status: 'uploaded',
        total_documents: 1,
        processed_documents: 0,
      })
      .select('*')
      .single();

    if (batchError || !batch) {
      console.error('Insertion deb_batches echouee', batchError);
      await supabaseAdmin.storage.from('deb-docs').remove([objectPath]);
      return NextResponse.json({ error: 'Impossible de creer le batch' }, { status: 500 });
    }

    const { data: document, error: documentError } = await supabaseAdmin
      .from('documents')
      .insert({
        id: documentId,
        org_id: orgId,
        batch_id: batchId,
        doc_type: 'mixed',
        file_path: objectPath,
        storage_object_path: objectPath,
        filename: file.name,
        status: 'uploaded',
        created_by: membership.userId,
        pages_count: 0,
      })
      .select('*')
      .single();

    if (documentError || !document) {
      console.error('Insertion documents echouee', documentError);
      console.error('Document data:', { documentId, orgId, batchId, objectPath, filename: file.name });
      await supabaseAdmin.storage.from('deb-docs').remove([objectPath]);
      await supabaseAdmin.from('deb_batches').delete().eq('id', batchId);
      return NextResponse.json({
        error: 'Impossible de creer le document',
        details: documentError?.message || 'Unknown error'
      }, { status: 500 });
    }

    const webhookUrl = process.env.N8N_DEB_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId,
            documentId,
            orgId,
            storageObjectPath: objectPath,
          }),
        });

        if (!webhookResponse.ok) {
          throw new Error('n8n webhook failed: ' + webhookResponse.status);
        }

        await supabaseAdmin
          .from('deb_batches')
          .update({ status: 'processing' })
          .eq('id', batchId);

        await supabaseAdmin
          .from('documents')
          .update({ status: 'processing' })
          .eq('id', documentId);
      } catch (webhookError) {
        console.error('Erreur webhook n8n', webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch,
        document,
      },
    });
  } catch (error) {
    console.error('Erreur POST /api/deb/batches', error);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId requis' }, { status: 400 });
    }

    const membership = await requireOrgMembership(orgId, ['org_admin', 'org_manager', 'org_viewer']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const { data: batches, error } = await supabaseAdmin
      .from('deb_batches')
      .select(`
        id,
        org_id,
        source_filename,
        storage_object_path,
        status,
        total_documents,
        processed_documents,
        error_message,
        created_at,
        updated_at,
        documents:documents (
          id,
          doc_type,
          filename,
          invoice_number,
          invoice_date,
          delivery_note_number,
          supplier_name,
          supplier_vat,
          supplier_country,
          status,
          pages_count,
          total_ht,
          shipping_total,
          export_url,
          metadata,
          created_at,
          updated_at
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lecture deb_batches echouee', error);
      return NextResponse.json({ error: 'Impossible de charger les batches' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: batches ?? [] });
  } catch (error) {
    console.error('Erreur GET /api/deb/batches', error);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}


