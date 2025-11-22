import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reverseEntriesForSource } from '@/lib/accounting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RouteParams {
  params: Promise<{ paymentId: string }>;
}

/**
 * GET /api/erp/payments/[paymentId]
 * Get a single payment with accounting entries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { paymentId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const type = searchParams.get('type') || 'in'; // 'in' for client, 'out' for supplier

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let payment: any;

    if (type === 'in') {
      const { data, error } = await supabase
        .from('erp_payments')
        .select(`
          *,
          client:erp_clients(id, name, company_name, email),
          invoice:erp_invoices(id, invoice_number, total_ttc, status)
        `)
        .eq('id', paymentId)
        .eq('org_id', orgId)
        .single();

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Paiement non trouvé' }, { status: 404 });
      }

      payment = { ...data, payment_type: 'in' };
    } else {
      const { data, error } = await supabase
        .from('erp_supplier_payments')
        .select(`
          *,
          supplier:erp_suppliers(id, name, company_name, email),
          invoice:erp_supplier_invoices(id, invoice_number, total_ttc, status)
        `)
        .eq('id', paymentId)
        .eq('org_id', orgId)
        .single();

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Paiement non trouvé' }, { status: 404 });
      }

      payment = { ...data, payment_type: 'out' };
    }

    // Fetch linked accounting entries
    const sourceType = type === 'in' ? 'payment_in' : 'payment_out';
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
      .eq('source_type', sourceType)
      .eq('source_id', paymentId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        accounting_entries: accountingEntries || [],
      },
    });
  } catch (err: any) {
    console.error('Payment GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/erp/payments/[paymentId]
 * Delete a payment and reverse accounting entries
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { paymentId } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const type = searchParams.get('type') || 'in';

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const table = type === 'in' ? 'erp_payments' : 'erp_supplier_payments';
    const invoiceTable = type === 'in' ? 'erp_invoices' : 'erp_supplier_invoices';
    const invoiceField = type === 'in' ? 'invoice_id' : 'supplier_invoice_id';
    const sourceType = type === 'in' ? 'payment_in' : 'payment_out';

    // Fetch payment to get amount and invoice_id
    const { data: payment, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', paymentId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ success: false, error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Reverse accounting entries
    const reversalDate = new Date().toISOString().split('T')[0];
    await reverseEntriesForSource(
      supabase,
      orgId,
      sourceType,
      paymentId,
      reversalDate,
      'Annulation du paiement'
    );

    // Update invoice balance
    const invoiceId = payment[invoiceField];
    if (invoiceId) {
      const { data: invoice } = await supabase
        .from(invoiceTable)
        .select('paid_amount, total_ttc')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const newPaidAmount = Math.max(0, (invoice.paid_amount || 0) - payment.amount);
        const newBalance = (invoice.total_ttc || 0) - newPaidAmount;
        const newStatus = newPaidAmount === 0 ? 'unpaid' : newBalance > 0 ? 'partial' : 'paid';

        await supabase
          .from(invoiceTable)
          .update({
            paid_amount: newPaidAmount,
            balance_due: newBalance,
            status: newStatus,
          })
          .eq('id', invoiceId);
      }
    }

    // Delete payment
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Paiement supprimé et écritures annulées',
    });
  } catch (err: any) {
    console.error('Payment DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
