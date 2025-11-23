import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { onExpenseRecorded } from '@/lib/accounting';

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
        supplier:erp_suppliers(id, name)
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

    const expenseDate = expense_date || new Date().toISOString().split('T')[0];

    // Calculer le TTC si nécessaire
    const vatRate = body.vat_rate || 20;
    const amountHT = body.amount_ht || amount || 0;
    const calculatedVat = vat_amount !== undefined ? vat_amount : (amountHT * vatRate / 100);
    const amountTTC = amountHT + calculatedVat;

    const { data: expense, error } = await supabase
      .from('erp_expenses')
      .insert({
        org_id,
        supplier_id,
        description,
        amount: amountTTC,
        amount_ht: amountHT,
        vat_amount: calculatedVat,
        vat_rate: vatRate,
        category: category || 'other',
        expense_date: expenseDate,
        payment_method,
        reference,
        notes,
        status: 'validated',
      })
      .select(`
        *,
        supplier:erp_suppliers(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating expense:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Trigger accounting entry generation
    const accountingResult = await onExpenseRecorded(supabase, {
      id: expense.id,
      org_id,
      expense_date: expenseDate,
      amount: amountHT,
      vat_amount: calculatedVat,
      category: category || 'other',
      description: description || '',
      supplier_id,
      supplier_name: expense.supplier?.name,
      reference,
      payment_method,
    });

    // Update expense with journal entry id if accounting succeeded
    if (accountingResult?.success && accountingResult.entry_id) {
      await supabase
        .from('erp_expenses')
        .update({ journal_entry_id: accountingResult.entry_id })
        .eq('id', expense.id);

      expense.journal_entry_id = accountingResult.entry_id;
    }

    return NextResponse.json({
      success: true,
      data: {
        expense,
        accounting_result: accountingResult,
      },
    });
  } catch (err: any) {
    console.error('Expense creation error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
