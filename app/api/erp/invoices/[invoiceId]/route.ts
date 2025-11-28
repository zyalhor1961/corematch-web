import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import {
  onCustomerInvoiceValidated,
  reverseEntriesForSource,
  regenerateEntriesForInvoice
} from '@/lib/accounting';

interface RouteParams {
  params: Promise<{ invoiceId: string }>;
}

/**
 * GET /api/erp/invoices/[invoiceId]
 * Get a single invoice with its lines and accounting entries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let userId: string | undefined;

  try {
    const { invoiceId } = await params;
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    // Fetch invoice with lines and client (unified table with outbound filter)
    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        client:erp_clients(id, name, email, company_name, address, city, postal_code, country),
        lines:invoice_lines(*)
      `)
      .eq('id', invoiceId)
      .eq('org_id', userOrg.org_id)
      .eq('invoice_type', 'outbound')
      .single();

    if (error || !invoice) {
      throw new AppError(ErrorType.NOT_FOUND, 'Invoice not found');
    }

    // Fetch linked accounting entries
    const { data: accountingEntries } = await supabaseAdmin
      .from('erp_journal_entries')
      .select(`
        id,
        entry_number,
        entry_date,
        description,
        total_debit,
        total_credit,
        status,
        journal:erp_journals(journal_code, journal_name)
      `)
      .eq('org_id', userOrg.org_id)
      .eq('source_type', 'customer_invoice')
      .eq('source_id', invoiceId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        accounting_entries: accountingEntries || [],
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/invoices/[invoiceId] [GET]');
  }
}

/**
 * PATCH /api/erp/invoices/[invoiceId]
 * Update an invoice - handles status changes with accounting triggers
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  let userId: string | undefined;

  try {
    const { invoiceId } = await params;
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;
    const body = await request.json();

    // Fetch current invoice (unified table)
    const { data: currentInvoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        client:erp_clients(id, name, company_name),
        lines:invoice_lines(*)
      `)
      .eq('id', invoiceId)
      .eq('org_id', orgId)
      .eq('invoice_type', 'outbound')
      .single();

    if (fetchError || !currentInvoice) {
      throw new AppError(ErrorType.NOT_FOUND, 'Invoice not found');
    }

    const oldStatus = currentInvoice.status;
    const newStatus = body.status;

    // Prepare update data
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'client_id', 'reference', 'invoice_date', 'due_date',
      'notes', 'payment_terms', 'footer', 'status',
      'discount_type', 'discount_value'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Calculate totals if lines were updated
    if (body.lines && Array.isArray(body.lines)) {
      // Delete existing lines (unified table)
      await supabaseAdmin
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoiceId);

      // Insert new lines (unified schema)
      const lines = body.lines.map((line: any, index: number) => {
        const taxRate = line.vat_rate ?? line.tax_rate ?? 20;
        const amountHt = line.quantity * line.unit_price;
        const amountTax = amountHt * (taxRate / 100);
        const amountTtc = amountHt + amountTax;

        return {
          invoice_id: invoiceId,
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          tax_rate: taxRate,
          amount_ht: amountHt,
          amount_tax: amountTax,
          amount_ttc: amountTtc,
          line_number: index,
        };
      });

      if (lines.length > 0) {
        await supabaseAdmin
          .from('invoice_lines')
          .insert(lines);
      }

      // Recalculate invoice totals (unified column names)
      const subtotalHt = lines.reduce((sum: number, l: any) => sum + l.amount_ht, 0);
      const totalTax = lines.reduce((sum: number, l: any) => sum + l.amount_tax, 0);
      const totalTtc = lines.reduce((sum: number, l: any) => sum + l.amount_ttc, 0);

      updateData.subtotal_ht = subtotalHt;
      updateData.total_tax = totalTax;
      updateData.total_ttc = totalTtc;
      updateData.balance_due = totalTtc - (currentInvoice.paid_amount || 0);
    }

    // Update invoice (unified table)
    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('invoice_type', 'outbound')
      .select(`
        *,
        client:erp_clients(id, name, company_name),
        lines:invoice_lines(*)
      `)
      .single();

    if (updateError) {
      throw new AppError(ErrorType.DATABASE_ERROR, updateError.message);
    }

    let accountingResult = null;

    // Handle status change for accounting
    if (newStatus && newStatus !== oldStatus) {
      // VALIDATION: Trigger accounting entry generation
      if ((newStatus === 'sent' || newStatus === 'validated' || newStatus === 'approved') &&
          oldStatus === 'draft') {

        // Calculate totals from lines (unified column names)
        const lines = updatedInvoice.lines || [];
        const totalHt = lines.reduce((sum: number, l: any) => sum + (l.amount_ht || l.total_ht || 0), 0);
        const totalTva = lines.reduce((sum: number, l: any) => sum + (l.amount_tax || l.total_vat || 0), 0);
        const totalTtc = lines.reduce((sum: number, l: any) => sum + (l.amount_ttc || l.total_ttc || 0), 0);

        const result = await onCustomerInvoiceValidated(supabaseAdmin, {
          id: invoiceId,
          org_id: orgId,
          invoice_number: updatedInvoice.invoice_number,
          invoice_date: updatedInvoice.invoice_date,
          total_ht: totalHt || updatedInvoice.subtotal_ht || 0,
          total_tva: totalTva || updatedInvoice.total_tax || 0,
          total_ttc: totalTtc || updatedInvoice.total_ttc || 0,
          client_id: updatedInvoice.client_id,
          client_name: updatedInvoice.client?.company_name || updatedInvoice.client?.name,
        });

        accountingResult = result;

        if (!result.success) {
          console.warn('[Invoice] Accounting entry generation warning:', result.error);
        }
      }

      // MODIFICATION of validated invoice: Reverse and regenerate
      if (oldStatus !== 'draft' && body.lines &&
          (oldStatus === 'sent' || oldStatus === 'validated' || oldStatus === 'approved')) {

        const lines = updatedInvoice.lines || [];
        const totalHt = lines.reduce((sum: number, l: any) => sum + (l.amount_ht || l.total_ht || 0), 0);
        const totalTva = lines.reduce((sum: number, l: any) => sum + (l.amount_tax || l.total_vat || 0), 0);
        const totalTtc = lines.reduce((sum: number, l: any) => sum + (l.amount_ttc || l.total_ttc || 0), 0);

        const result = await regenerateEntriesForInvoice(supabaseAdmin, {
          id: invoiceId,
          org_id: orgId,
          type: 'customer',
          invoice_number: updatedInvoice.invoice_number,
          invoice_date: updatedInvoice.invoice_date,
          total_ht: totalHt || updatedInvoice.subtotal_ht || 0,
          total_tva: totalTva || updatedInvoice.total_tax || 0,
          total_ttc: totalTtc || updatedInvoice.total_ttc || 0,
          client_id: updatedInvoice.client_id,
          client_name: updatedInvoice.client?.company_name || updatedInvoice.client?.name,
        });

        accountingResult = result;
      }

      // CANCELLATION: Reverse accounting entries
      if (newStatus === 'cancelled' &&
          (oldStatus === 'sent' || oldStatus === 'validated')) {

        const result = await reverseEntriesForSource(
          supabaseAdmin,
          orgId,
          'customer_invoice',
          invoiceId,
          new Date().toISOString().split('T')[0],
          'Annulation de la facture'
        );

        accountingResult = { reversals: result };
      }
    }

    // Fetch accounting entries for response
    const { data: accountingEntries } = await supabaseAdmin
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
      .eq('org_id', orgId)
      .eq('source_type', 'customer_invoice')
      .eq('source_id', invoiceId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedInvoice,
        accounting_entries: accountingEntries || [],
        accounting_result: accountingResult,
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/invoices/[invoiceId] [PATCH]');
  }
}

/**
 * DELETE /api/erp/invoices/[invoiceId]
 * Delete an invoice (only if draft)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let userId: string | undefined;

  try {
    const { invoiceId } = await params;
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    // Check invoice exists and is draft (unified table)
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .eq('org_id', userOrg.org_id)
      .eq('invoice_type', 'outbound')
      .single();

    if (fetchError || !invoice) {
      throw new AppError(ErrorType.NOT_FOUND, 'Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Seules les factures en brouillon peuvent être supprimées. Pour annuler une facture validée, utilisez le statut "cancelled".'
      );
    }

    // Delete lines first (unified table)
    await supabaseAdmin
      .from('invoice_lines')
      .delete()
      .eq('invoice_id', invoiceId);

    // Delete invoice (unified table)
    const { error: deleteError } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('invoice_type', 'outbound');

    if (deleteError) {
      throw new AppError(ErrorType.DATABASE_ERROR, deleteError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Facture supprimée avec succès',
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/invoices/[invoiceId] [DELETE]');
  }
}
