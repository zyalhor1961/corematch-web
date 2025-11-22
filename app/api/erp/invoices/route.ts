import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { Invoice, InvoiceInput } from '@/lib/erp/types';

/**
 * GET /api/erp/invoices
 * List all invoices for the organization
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;

  try {
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const client_id = searchParams.get('client_id');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseAdmin
      .from('erp_invoices')
      .select(`
        *,
        client:erp_clients(id, name, email, company_name)
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (client_id) {
      query = query.eq('client_id', client_id);
    }

    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('invoice_date', dateTo);
    }

    const { data: invoices, error, count } = await query;

    if (error) {
      console.error('[ERP Invoices] Error:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoices || [],
        total: count || 0,
        limit,
        offset,
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/invoices [GET]');
  }
}

/**
 * POST /api/erp/invoices
 * Create a new invoice
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;

  try {
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
    const body: InvoiceInput = await request.json();

    // Get next invoice number
    const { data: invoiceNumber } = await supabaseAdmin.rpc('get_next_invoice_number', {
      p_org_id: orgId,
    });

    // Calculate due date
    const invoiceDate = body.invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = body.due_date || new Date(
      new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('erp_invoices')
      .insert({
        org_id: orgId,
        created_by: user!.id,
        client_id: body.client_id,
        estimate_id: body.estimate_id,
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        reference: body.reference,
        invoice_date: invoiceDate,
        due_date: dueDate,
        notes: body.notes,
        payment_terms: body.payment_terms,
        footer: body.footer,
        discount_type: body.discount_type || 'percent',
        discount_value: body.discount_value || 0,
        status: 'draft',
        currency: 'EUR',
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('[ERP Invoices] Create error:', invoiceError);
      throw new AppError(ErrorType.DATABASE_ERROR, invoiceError.message);
    }

    // Create invoice lines if provided
    if (body.lines && body.lines.length > 0) {
      const lines = body.lines.map((line, index) => {
        const vatRate = line.vat_rate ?? 20;
        const totalHt = line.quantity * line.unit_price;
        const totalVat = totalHt * (vatRate / 100);
        const totalTtc = totalHt + totalVat;

        return {
          invoice_id: invoice.id,
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          vat_rate: vatRate,
          total_ht: totalHt,
          total_vat: totalVat,
          total_ttc: totalTtc,
          line_order: index,
        };
      });

      const { error: linesError } = await supabaseAdmin
        .from('erp_invoice_lines')
        .insert(lines);

      if (linesError) {
        console.error('[ERP Invoices] Lines error:', linesError);
        // Don't fail, invoice is created
      }
    }

    // Fetch complete invoice with lines
    const { data: completeInvoice } = await supabaseAdmin
      .from('erp_invoices')
      .select(`
        *,
        client:erp_clients(id, name, email, company_name),
        lines:erp_invoice_lines(*)
      `)
      .eq('id', invoice.id)
      .single();

    return NextResponse.json({
      success: true,
      data: completeInvoice || invoice,
    }, { status: 201 });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/invoices [POST]');
  }
}
