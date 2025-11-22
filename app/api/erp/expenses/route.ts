import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const category = searchParams.get('category');
    const supplierId = searchParams.get('supplier_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_expenses')
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name)
      `)
      .eq('org_id', orgId)
      .order('expense_date', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: expenses, error } = await query;

    if (error) {
      console.error('Error fetching expenses:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get category stats
    const categories = expenses?.reduce((acc: Record<string, number>, exp) => {
      const cat = exp.category || 'other';
      acc[cat] = (acc[cat] || 0) + (exp.amount || 0);
      return acc;
    }, {}) || {};

    return NextResponse.json({
      success: true,
      data: {
        expenses: expenses || [],
        total: expenses?.length || 0,
        total_amount: expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
        categories,
      },
    });
  } catch (err: any) {
    console.error('Expenses API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, supplier_id, description, amount, category, expense_date, vat_amount, payment_method, reference, notes } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: expense, error } = await supabase
      .from('erp_expenses')
      .insert({
        org_id,
        supplier_id,
        description,
        amount: amount || 0,
        vat_amount: vat_amount || 0,
        category: category || 'other',
        expense_date: expense_date || new Date().toISOString().split('T')[0],
        payment_method,
        reference,
        notes,
        status: 'recorded',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating expense:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: expense });
  } catch (err: any) {
    console.error('Expense creation error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
