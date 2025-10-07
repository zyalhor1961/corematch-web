import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireOrgMembership } from '../../../_helpers';

const EDITABLE_FIELDS = [
  'description',
  'sku',
  'qty',
  'unit',
  'unit_price',
  'line_amount',
  'hs_code',
  'hs_confidence',
  'country_of_origin',
  'net_mass_kg',
  'weight_confidence',
  'shipping_allocated',
  'customs_value_line',
  'source_weight',
  'source_hs',
  'pages_source',
  'enrichment_notes'
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

type LineUpdate = {
  lineId: string;
  values: Partial<Record<EditableField, unknown>>;
};

async function loadBatchOrg(batchId: string) {
  const { data, error } = await supabaseAdmin
    .from('deb_batches')
    .select('org_id')
    .eq('id', batchId)
    .maybeSingle();

  if (error) {
    console.error('Erreur lecture deb_batches', error);
    throw new Error('Batch introuvable');
  }

  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;
    if (!batchId) {
      return NextResponse.json({ error: 'batchId requis' }, { status: 400 });
    }

    const batch = await loadBatchOrg(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch introuvable' }, { status: 404 });
    }

    const membership = await requireOrgMembership(batch.org_id, ['org_admin', 'org_manager', 'org_viewer']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const { data: documents, error: documentsError } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        doc_type,
        filename,
        supplier_name,
        supplier_vat,
        supplier_country,
        invoice_number,
        invoice_date,
        delivery_note_number,
        status
      `)
      .eq('batch_id', batchId);

    if (documentsError) {
      console.error('Erreur lecture documents', documentsError);
      return NextResponse.json({ error: 'Impossible de charger les documents' }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ success: true, data: { documents: [], lines: [] } });
    }

    const documentIds = documents.map((doc) => doc.id);

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('document_lines')
      .select(`
        id,
        document_id,
        line_no,
        description,
        sku,
        qty,
        unit,
        unit_price,
        line_amount,
        hs_code,
        hs_confidence,
        country_of_origin,
        net_mass_kg,
        weight_confidence,
        shipping_allocated,
        customs_value_line,
        source_weight,
        source_hs,
        pages_source,
        enrichment_notes,
        last_reviewed_at,
        documents:documents (
          id,
          doc_type,
          filename,
          invoice_number,
          invoice_date,
          delivery_note_number,
          supplier_name,
          supplier_country,
          supplier_vat,
          status
        )
      `)
      .in('document_id', documentIds)
      .order('line_no', { ascending: true });

    if (linesError) {
      console.error('Erreur lecture document_lines', linesError);
      return NextResponse.json({ error: 'Impossible de charger les lignes' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        documents,
        lines: lines ?? [],
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/deb/batches/[batchId]/lines', error);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;
    if (!batchId) {
      return NextResponse.json({ error: 'batchId requis' }, { status: 400 });
    }

    const batch = await loadBatchOrg(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch introuvable' }, { status: 404 });
    }

    const membership = await requireOrgMembership(batch.org_id, ['org_admin', 'org_manager']);
    if ('error' in membership) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const body = await request.json();
    const updates = body?.updates as LineUpdate[] | undefined;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Aucune mise a jour fournie' }, { status: 400 });
    }

    const { data: documents, error: documentsError } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('batch_id', batchId);

    if (documentsError) {
      console.error('Erreur lecture documents', documentsError);
      return NextResponse.json({ error: 'Impossible de verifier les documents' }, { status: 500 });
    }

    const authorizedDocumentIds = (documents ?? []).map((doc) => doc.id);

    if (authorizedDocumentIds.length === 0) {
      return NextResponse.json({ error: 'Aucun document associe au batch' }, { status: 400 });
    }

    const results = [] as unknown[];

    for (const update of updates) {
      if (!update?.lineId || typeof update.lineId !== 'string') {
        continue;
      }

      const sanitizedValues: Record<string, unknown> = {};
      for (const key of EDITABLE_FIELDS) {
        if (update.values && key in update.values) {
          sanitizedValues[key] = update.values[key];
        }
      }

      if (Object.keys(sanitizedValues).length === 0) {
        continue;
      }

      sanitizedValues['last_reviewed_at'] = new Date().toISOString();

      const { data: line, error: lineError } = await supabaseAdmin
        .from('document_lines')
        .update(sanitizedValues)
        .eq('id', update.lineId)
        .in('document_id', authorizedDocumentIds)
        .select('*')
        .single();

      if (lineError) {
        console.error('Erreur mise a jour document_lines', lineError);
        return NextResponse.json({ error: 'Echec mise a jour ligne' }, { status: 500 });
      }

      await supabaseAdmin.from('audit_logs').insert({
        document_id: line.document_id,
        actor: membership.userId,
        action: 'deb_line_update',
        after: sanitizedValues,
      });

      results.push(line);
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Erreur PATCH /api/deb/batches/[batchId]/lines', error);
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
