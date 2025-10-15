import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function toNum(v: any): number | null {
  const n = typeof v === 'number' ? v : parseFloat((v ?? '').toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function pickField(fields: any[], name: string): string | null {
  const f = fields.find(x => (x.field_name || x.name || '').toLowerCase() === name.toLowerCase());
  const v = f?.value_text ?? f?.value;
  return v ? v.toString().trim() : null;
}

function byPrefix(fields: any[], prefix: string) {
  const lower = prefix.toLowerCase();
  return fields.filter(f => (f.field_name || f.name || '').toLowerCase().startsWith(lower));
}

function parseWeightFromText(text: string | null): number | null {
  if (!text) return null;
  const m = text.toLowerCase().match(/(\d+[\.,]?\d*)\s?(kg|kgs|kilogram|kilograms|g|gram|grams)/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  const unit = m[2];
  if (isNaN(value)) return null;
  if (unit.startsWith('g')) return value / 1000; // convert g to kg
  return value; // kg
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { documentId } = await params;

    const { data: doc } = await supabase
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    const { data: fields = [] } = await supabase
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true })
      .order('created_at', { ascending: true });

    // Build header using summary endpoint logic via fields/doc
    const header = {
      documentId,
      vendor_name: doc?.vendor_name || null,
      invoice_number: doc?.invoice_number || null,
      document_date: doc?.document_date || null,
      vendor_vat: doc?.vendor_vat || null,
      vendor_country: null as string | null,
      place_of_delivery: null as string | null,
      tax_amount: doc?.tax_amount ?? null,
      net_amount: doc?.net_amount ?? null,
      total_amount: doc?.total_amount ?? null,
      vendor_email: null as string | null,
      vendor_phone: null as string | null,
      order_number: null as string | null,
      vendor_iban: null as string | null,
      payment_terms: null as string | null,
      vendor_address: null as string | null,
      charges: null as number | null,
      total_weight: null as number | null,
      currency_code: doc?.currency_code || null
    };

    // Items: read normalized fields like item_{n}_description, ... from idp_extracted_fields
    const itemFields = byPrefix(fields, 'item_');
    const grouped: Record<string, any> = {};
    for (const f of itemFields) {
      const name = (f.field_name || f.name || '').toLowerCase();
      const m = name.match(/^item_(\d+)_([a-z0-9_]+)$/);
      if (!m) continue;
      const idx = m[1];
      const key = m[2];
      if (!grouped[idx]) grouped[idx] = {};
      grouped[idx][key] = f.value_text ?? f.value;
    }

    const items = Object.keys(grouped).sort((a,b)=>Number(a)-Number(b)).map(k => {
      const it = grouped[k];
      const description = (it.description ?? '').toString().trim() || null;
      const quantity = toNum(it.quantity);
      const unit_price = toNum(it.unit_price);
      const amount = toNum(it.amount);
      const code_item = (it.sku ?? it.code ?? it.product ?? '').toString().trim() || null;
      const unit = (it.unit ?? '').toString().trim() || null;

      // Attempt to parse weights from explicit fields or description
      const weight = toNum(it.weight) ?? parseWeightFromText(description);
      const net_weight = toNum(it.net_weight) ?? weight;
      const gross_weight = toNum(it.gross_weight) ?? null;

      // Charges per item if surfaced
      const charges = toNum(it.charges) ?? null;

      const ht_price = unit_price; // assume unit_price is HT
      const ttc = amount; // assume amount is TTC if model returns it; else equals subtotal

      return {
        line: Number(k),
        description,
        code_item,
        quantity,
        unit,
        ht_price,
        ttc,
        charges,
        weight,
        net_weight,
        gross_weight
      };
    });

    return NextResponse.json({ success: true, data: { header, items } });
  } catch (error: any) {
    console.error('Detailed export error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}

