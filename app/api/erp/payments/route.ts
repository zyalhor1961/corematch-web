import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { onPaymentReceived, onPaymentSent } from '@/lib/accounting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/erp/payments
 * List all payments (client and supplier)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const type = searchParams.get('type'); // 'in' (client), 'out' (supplier), or all
    const invoiceId = searchParams.get('invoice_id');
    const clientId = searchParams.get('client_id');
    const supplierId = searchParams.get('supplier_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch client payments (encaissements)
    let clientPayments: any[] = [];
    if (!type || type === 'in') {
      let query = supabase
        .from('erp_payments')
        .select(`
          *,
          client:erp_clients(id, name, company_name),
          invoice:erp_invoices(id, invoice_number)
        `)
        .eq('org_id', orgId)
        .order('payment_date', { ascending: false });

      if (invoiceId) {
        query = query.eq('invoice_id', invoiceId);
      }
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      if (startDate) {
        query = query.gte('payment_date', startDate);
      }
      if (endDate) {
        query = query.lte('payment_date', endDate);
      }

      const { data } = await query;
      clientPayments = (data || []).map(p => ({ ...p, payment_type: 'in' }));
    }

    // Fetch supplier payments (décaissements)
    // These are tracked via paid_amount on erp_supplier_invoices
    // We'll create a separate table for supplier payment history
    let supplierPayments: any[] = [];
    if (!type || type === 'out') {
      const { data } = await supabase
        .from('erp_supplier_payments')
        .select(`
          *,
          supplier:erp_suppliers(id, name, company_name),
          invoice:erp_supplier_invoices(id, invoice_number)
        `)
        .eq('org_id', orgId)
        .order('payment_date', { ascending: false });

      supplierPayments = (data || []).map(p => ({ ...p, payment_type: 'out' }));
    }

    // Combine and sort
    const allPayments = [...clientPayments, ...supplierPayments].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );

    // Calculate totals
    const totalIn = clientPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalOut = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        payments: type ? (type === 'in' ? clientPayments : supplierPayments) : allPayments,
        client_payments: clientPayments,
        supplier_payments: supplierPayments,
        totals: {
          total_in: totalIn,
          total_out: totalOut,
          net: totalIn - totalOut,
        },
        count: allPayments.length,
      },
    });
  } catch (err: any) {
    console.error('Payments API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/erp/payments
 * Create a new payment (client or supplier)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id,
      payment_type, // 'in' for client, 'out' for supplier
      invoice_id,
      client_id,
      supplier_id,
      amount,
      payment_date,
      payment_method,
      reference,
      notes,
      auto_post, // auto-post accounting entry
    } = body;

    if (!org_id || !amount || !payment_type) {
      return NextResponse.json({
        success: false,
        error: 'org_id, amount, and payment_type required',
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const paymentDateValue = payment_date || new Date().toISOString().split('T')[0];

    let payment: any;
    let accountingResult = null;

    if (payment_type === 'in') {
      // Client payment (encaissement)
      if (!client_id) {
        return NextResponse.json({
          success: false,
          error: 'client_id required for client payment',
        }, { status: 400 });
      }

      // Create payment record
      const { data, error } = await supabase
        .from('erp_payments')
        .insert({
          org_id,
          invoice_id,
          client_id,
          amount,
          payment_date: paymentDateValue,
          payment_method: payment_method || 'bank_transfer',
          reference,
          notes,
        })
        .select(`
          *,
          client:erp_clients(id, name, company_name),
          invoice:erp_invoices(id, invoice_number)
        `)
        .single();

      if (error) {
        console.error('Error creating client payment:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      payment = { ...data, payment_type: 'in' };

      // Update invoice balance if linked
      if (invoice_id) {
        const { data: invoice } = await supabase
          .from('erp_invoices')
          .select('paid_amount, total_ttc, balance_due')
          .eq('id', invoice_id)
          .single();

        if (invoice) {
          const newPaidAmount = (invoice.paid_amount || 0) + amount;
          const newBalance = (invoice.total_ttc || 0) - newPaidAmount;
          const newStatus = newBalance <= 0 ? 'paid' : newBalance < invoice.total_ttc ? 'partial' : invoice.status;

          await supabase
            .from('erp_invoices')
            .update({
              paid_amount: newPaidAmount,
              balance_due: Math.max(0, newBalance),
              status: newStatus,
            })
            .eq('id', invoice_id);
        }
      }

      // Trigger accounting entry
      accountingResult = await onPaymentReceived(supabase, {
        id: payment.id,
        org_id,
        invoice_id,
        invoice_number: payment.invoice?.invoice_number,
        payment_date: paymentDateValue,
        amount,
        client_id,
        client_name: payment.client?.company_name || payment.client?.name,
        payment_method,
        reference,
      });

    } else {
      // Supplier payment (décaissement)
      if (!supplier_id) {
        return NextResponse.json({
          success: false,
          error: 'supplier_id required for supplier payment',
        }, { status: 400 });
      }

      // Create supplier payment record
      const { data, error } = await supabase
        .from('erp_supplier_payments')
        .insert({
          org_id,
          supplier_invoice_id: invoice_id,
          supplier_id,
          amount,
          payment_date: paymentDateValue,
          payment_method: payment_method || 'bank_transfer',
          reference,
          notes,
        })
        .select(`
          *,
          supplier:erp_suppliers(id, name, company_name),
          invoice:erp_supplier_invoices(id, invoice_number)
        `)
        .single();

      if (error) {
        // Table might not exist yet - create it inline
        if (error.code === '42P01') {
          console.warn('erp_supplier_payments table does not exist');
          return NextResponse.json({
            success: false,
            error: 'Supplier payments table needs to be created. Run migrations.',
          }, { status: 500 });
        }
        console.error('Error creating supplier payment:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      payment = { ...data, payment_type: 'out' };

      // Update supplier invoice balance if linked
      if (invoice_id) {
        const { data: invoice } = await supabase
          .from('erp_supplier_invoices')
          .select('paid_amount, total_ttc, balance_due')
          .eq('id', invoice_id)
          .single();

        if (invoice) {
          const newPaidAmount = (invoice.paid_amount || 0) + amount;
          const newBalance = (invoice.total_ttc || 0) - newPaidAmount;
          const newStatus = newBalance <= 0 ? 'paid' : newBalance < invoice.total_ttc ? 'partial' : invoice.status;

          await supabase
            .from('erp_supplier_invoices')
            .update({
              paid_amount: newPaidAmount,
              balance_due: Math.max(0, newBalance),
              status: newStatus,
            })
            .eq('id', invoice_id);
        }
      }

      // Trigger accounting entry
      accountingResult = await onPaymentSent(supabase, {
        id: payment.id,
        org_id,
        invoice_id,
        invoice_number: payment.invoice?.invoice_number,
        payment_date: paymentDateValue,
        amount,
        supplier_id,
        supplier_name: payment.supplier?.company_name || payment.supplier?.name,
        payment_method,
        reference,
      });
    }

    // Update journal_entry_id on payment if accounting succeeded
    if (accountingResult?.success && accountingResult.entry_id) {
      const table = payment_type === 'in' ? 'erp_payments' : 'erp_supplier_payments';
      await supabase
        .from(table)
        .update({ journal_entry_id: accountingResult.entry_id })
        .eq('id', payment.id);

      payment.journal_entry_id = accountingResult.entry_id;
    }

    return NextResponse.json({
      success: true,
      data: {
        payment,
        accounting_result: accountingResult,
      },
    }, { status: 201 });

  } catch (err: any) {
    console.error('Payment creation error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
