import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../_helpers';

export async function POST() {
  const supabaseAdmin = await getSupabaseAdmin();

  return NextResponse.json(
    { error: 'Upload via /api/deb/batches' },
    { status: 405 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId');
    const batchId = url.searchParams.get('batchId');

    if (!orgId && !batchId) {
      return NextResponse.json(
        { error: 'orgId ou batchId requis' },
        { status: 400 }
      );
    }

    const membershipOrgId = batchId ? undefined : orgId;
    let verifiedOrgId = orgId;

    if (batchId && !orgId) {
      const { data: batch, error } = await supabaseAdmin
        .from('deb_batches')
        .select('org_id')
        .eq('id', batchId)
        .maybeSingle();

      if (error) {
        console.error('Erreur lecture batch pour documents', error);
        return NextResponse.json({ error: 'Batch introuvable' }, { status: 404 });
      }

      verifiedOrgId = batch?.org_id ?? null;
    }

    if (!verifiedOrgId) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
    }

    const membership = await requireOrgMembership(verifiedOrgId, ['org_admin', 'org_manager', 'org_viewer']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const query = supabaseAdmin
      .from('documents')
      .select(`
        id,
        org_id,
        batch_id,
        doc_type,
        filename,
        storage_object_path,
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
      `)
      .order('created_at', { ascending: false });

    if (batchId) {
      query.eq('batch_id', batchId);
    } else if (orgId) {
      query.eq('org_id', orgId);
    }

    const { data: documents, error: documentsError } = await query;

    if (documentsError) {
      console.error('Erreur lecture documents', documentsError);
      return NextResponse.json({ error: 'Impossible de charger les documents' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: documents ?? [] });
  } catch (error) {
    console.error('Erreur GET /api/deb/documents', error);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
