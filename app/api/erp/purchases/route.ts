import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplier_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_supplier_invoices')
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name)
      `)
      .eq('org_id', orgId)
      .order('invoice_date', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: purchases, error } = await query;

    if (error) {
      console.error('Error fetching purchases:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        purchases: purchases || [],
        total: purchases?.length || 0,
        total_amount: purchases?.reduce((sum, p) => sum + (p.total_ttc || 0), 0) || 0,
        total_outstanding: purchases?.reduce((sum, p) => sum + (p.balance_due || 0), 0) || 0,
      },
    });
  } catch (err: any) {
    console.error('Purchases API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, supplier_id, invoice_number, invoice_date, due_date, total_ht, total_tva, total_ttc, notes } = body;

    if (!org_id || !supplier_id) {
      return NextResponse.json({ success: false, error: 'org_id and supplier_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: purchase, error } = await supabase
      .from('erp_supplier_invoices')
      .insert({
        org_id,
        supplier_id,
        invoice_number: invoice_number || `ACH-${Date.now()}`,
        invoice_date: invoice_date || new Date().toISOString().split('T')[0],
        due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_ht: total_ht || 0,
        total_tva: total_tva || 0,
        total_ttc: total_ttc || 0,
        balance_due: total_ttc || 0,
        paid_amount: 0,
        status: 'received',
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating purchase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: purchase });
  } catch (err: any) {
    console.error('Purchase creation error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
