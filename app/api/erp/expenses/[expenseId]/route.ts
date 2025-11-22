import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reverseEntriesForSource } from '@/lib/accounting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RouteParams {
  params: Promise<{ expenseId: string }>;
}

/**
 * GET /api/erp/expenses/[expenseId]
 * Get a single expense with accounting entries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { expenseId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch expense with supplier info
    const { data: expense, error } = await supabase
      .from('erp_expenses')
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name, email)
      `)
      .eq('id', expenseId)
      .eq('org_id', orgId)
      .single();

    if (error || !expense) {
      return NextResponse.json({ success: false, error: 'Dépense non trouvée' }, { status: 404 });
    }

    // Fetch linked accounting entries
    const { data: accountingEntries } = await supabase
      .from('erp_journal_entries')
      .select(`
        id,
        entry_number,
        entry_date,
        description,
        total_debit,
        total_credit,
        status,
        journal:erp_journals(journal_code, journal_name),
        lines:erp_journal_lines(
          id,
          account_code,
          debit,
          credit,
          description
        )
      `)
      .eq('org_id', orgId)
      .eq('source_type', 'expense')
      .eq('source_id', expenseId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...expense,
        accounting_entries: accountingEntries || [],
      },
    });
  } catch (err: any) {
    console.error('Expense GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/erp/expenses/[expenseId]
 * Update an expense
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { expenseId } = await params;
    const body = await request.json();
    const { org_id } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch current expense
    const { data: currentExpense, error: fetchError } = await supabase
      .from('erp_expenses')
      .select('*')
      .eq('id', expenseId)
      .eq('org_id', org_id)
      .single();

    if (fetchError || !currentExpense) {
      return NextResponse.json({ success: false, error: 'Dépense non trouvée' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'supplier_id', 'description', 'amount', 'vat_amount',
      'category', 'expense_date', 'payment_method', 'reference',
      'notes', 'status', 'receipt_url'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update expense
    const { data: updatedExpense, error: updateError } = await supabase
      .from('erp_expenses')
      .update(updateData)
      .eq('id', expenseId)
      .select(`
        *,
        supplier:erp_suppliers(id, name, company_name)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Note: For expenses, we typically don't regenerate accounting entries on update
    // since they are immediately posted. If amount changed significantly,
    // we would reverse and create a new expense.

    // Fetch accounting entries for response
    const { data: accountingEntries } = await supabase
      .from('erp_journal_entries')
      .select(`
        id,
        entry_number,
        entry_date,
        description,
        total_debit,
        total_credit,
        status
      `)
      .eq('org_id', org_id)
      .eq('source_type', 'expense')
      .eq('source_id', expenseId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedExpense,
        accounting_entries: accountingEntries || [],
      },
    });
  } catch (err: any) {
    console.error('Expense PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/erp/expenses/[expenseId]
 * Delete an expense and reverse accounting entries
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { expenseId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch expense
    const { data: expense, error: fetchError } = await supabase
      .from('erp_expenses')
      .select('id, status')
      .eq('id', expenseId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !expense) {
      return NextResponse.json({ success: false, error: 'Dépense non trouvée' }, { status: 404 });
    }

    // Reverse accounting entries
    const reversalDate = new Date().toISOString().split('T')[0];
    await reverseEntriesForSource(
      supabase,
      orgId,
      'expense',
      expenseId,
      reversalDate,
      'Annulation de la dépense'
    );

    // Delete expense
    const { error: deleteError } = await supabase
      .from('erp_expenses')
      .delete()
      .eq('id', expenseId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Dépense supprimée et écritures annulées',
    });
  } catch (err: any) {
    console.error('Expense DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
