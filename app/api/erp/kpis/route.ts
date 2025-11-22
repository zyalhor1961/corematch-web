import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { ERPDashboardKPIs, TopClient, TopSupplier, MonthlyRevenue } from '@/lib/erp/types';

/**
 * GET /api/erp/kpis
 * Get ERP dashboard KPIs
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

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // Revenue MTD
    const { data: revenueMTD } = await supabaseAdmin
      .from('erp_invoices')
      .select('total_ttc')
      .eq('org_id', orgId)
      .gte('invoice_date', startOfMonth)
      .in('status', ['paid', 'partial', 'sent', 'overdue']);

    const totalRevenueMTD = revenueMTD?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;

    // Revenue last month (for comparison)
    const { data: revenueLastMonth } = await supabaseAdmin
      .from('erp_invoices')
      .select('total_ttc')
      .eq('org_id', orgId)
      .gte('invoice_date', startOfLastMonth)
      .lte('invoice_date', endOfLastMonth)
      .in('status', ['paid', 'partial', 'sent', 'overdue']);

    const totalRevenueLastMonth = revenueLastMonth?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;

    // Revenue YTD
    const { data: revenueYTD } = await supabaseAdmin
      .from('erp_invoices')
      .select('total_ttc')
      .eq('org_id', orgId)
      .gte('invoice_date', startOfYear)
      .in('status', ['paid', 'partial', 'sent', 'overdue']);

    const totalRevenueYTD = revenueYTD?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;

    // Expenses MTD
    const { data: expensesMTD } = await supabaseAdmin
      .from('erp_expenses')
      .select('amount')
      .eq('org_id', orgId)
      .gte('expense_date', startOfMonth)
      .eq('status', 'validated');

    const totalExpensesMTD = expensesMTD?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

    // Expenses last month
    const { data: expensesLastMonth } = await supabaseAdmin
      .from('erp_expenses')
      .select('amount')
      .eq('org_id', orgId)
      .gte('expense_date', startOfLastMonth)
      .lte('expense_date', endOfLastMonth)
      .eq('status', 'validated');

    const totalExpensesLastMonth = expensesLastMonth?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

    // Expenses YTD
    const { data: expensesYTD } = await supabaseAdmin
      .from('erp_expenses')
      .select('amount')
      .eq('org_id', orgId)
      .gte('expense_date', startOfYear)
      .eq('status', 'validated');

    const totalExpensesYTD = expensesYTD?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

    // Add supplier invoices to expenses
    const { data: supplierInvoicesMTD } = await supabaseAdmin
      .from('erp_supplier_invoices')
      .select('total_ttc')
      .eq('org_id', orgId)
      .gte('invoice_date', startOfMonth);

    const supplierExpensesMTD = supplierInvoicesMTD?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;

    const { data: supplierInvoicesYTD } = await supabaseAdmin
      .from('erp_supplier_invoices')
      .select('total_ttc')
      .eq('org_id', orgId)
      .gte('invoice_date', startOfYear);

    const supplierExpensesYTD = supplierInvoicesYTD?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;

    // Receivables (unpaid client invoices)
    const { data: receivables } = await supabaseAdmin
      .from('erp_invoices')
      .select('balance_due, due_date')
      .eq('org_id', orgId)
      .in('status', ['sent', 'partial', 'overdue'])
      .gt('balance_due', 0);

    const totalReceivables = receivables?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
    const overdueReceivables = receivables?.filter(inv => inv.due_date < today).reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

    // Payables (unpaid supplier invoices)
    const { data: payables } = await supabaseAdmin
      .from('erp_supplier_invoices')
      .select('balance_due, due_date')
      .eq('org_id', orgId)
      .in('status', ['unpaid', 'partial', 'overdue'])
      .gt('balance_due', 0);

    const totalPayables = payables?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;
    const overduePayables = payables?.filter(inv => inv.due_date && inv.due_date < today).reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

    // Top clients
    const { data: topClients } = await supabaseAdmin
      .from('erp_clients')
      .select('id, name, total_invoiced, invoice_count')
      .eq('org_id', orgId)
      .gt('total_invoiced', 0)
      .order('total_invoiced', { ascending: false })
      .limit(5);

    // Top suppliers
    const { data: topSuppliers } = await supabaseAdmin
      .from('erp_suppliers')
      .select('id, name, total_purchased, invoice_count')
      .eq('org_id', orgId)
      .gt('total_purchased', 0)
      .order('total_purchased', { ascending: false })
      .limit(5);

    // Monthly revenue (last 12 months)
    const monthlyRevenue: MonthlyRevenue[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = date.toISOString().split('T')[0];
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: monthInvoices } = await supabaseAdmin
        .from('erp_invoices')
        .select('total_ttc')
        .eq('org_id', orgId)
        .gte('invoice_date', monthStart)
        .lte('invoice_date', monthEnd)
        .in('status', ['paid', 'partial', 'sent', 'overdue']);

      const { data: monthExpenses } = await supabaseAdmin
        .from('erp_expenses')
        .select('amount')
        .eq('org_id', orgId)
        .gte('expense_date', monthStart)
        .lte('expense_date', monthEnd)
        .eq('status', 'validated');

      const revenue = monthInvoices?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0;
      const expenses = monthExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      monthlyRevenue.push({
        month: date.toLocaleString('fr-FR', { month: 'short' }),
        year: date.getFullYear(),
        revenue,
        expenses,
        profit: revenue - expenses,
      });
    }

    // Calculate change percentages
    const revenueChange = totalRevenueLastMonth > 0
      ? ((totalRevenueMTD - totalRevenueLastMonth) / totalRevenueLastMonth) * 100
      : 0;

    const expensesChange = totalExpensesLastMonth > 0
      ? ((totalExpensesMTD - totalExpensesLastMonth) / totalExpensesLastMonth) * 100
      : 0;

    const kpis: ERPDashboardKPIs = {
      total_revenue_mtd: totalRevenueMTD,
      total_revenue_ytd: totalRevenueYTD,
      revenue_change_percent: Math.round(revenueChange * 10) / 10,

      total_expenses_mtd: totalExpensesMTD + supplierExpensesMTD,
      total_expenses_ytd: totalExpensesYTD + supplierExpensesYTD,
      expenses_change_percent: Math.round(expensesChange * 10) / 10,

      profit_mtd: totalRevenueMTD - (totalExpensesMTD + supplierExpensesMTD),
      profit_ytd: totalRevenueYTD - (totalExpensesYTD + supplierExpensesYTD),

      total_receivables: totalReceivables,
      overdue_receivables: overdueReceivables,
      receivables_count: receivables?.length || 0,

      total_payables: totalPayables,
      overdue_payables: overduePayables,
      payables_count: payables?.length || 0,

      estimated_cash_balance: totalReceivables - totalPayables,
      cashflow_30days: totalReceivables - totalPayables,
    };

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        topClients: topClients?.map(c => ({
          client_id: c.id,
          client_name: c.name,
          total_invoiced: c.total_invoiced,
          invoice_count: c.invoice_count,
        })) || [],
        topSuppliers: topSuppliers?.map(s => ({
          supplier_id: s.id,
          supplier_name: s.name,
          total_purchased: s.total_purchased,
          invoice_count: s.invoice_count,
        })) || [],
        monthlyRevenue,
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/kpis [GET]');
  }
}
