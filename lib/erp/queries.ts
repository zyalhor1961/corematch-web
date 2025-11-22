import { SupabaseClient } from '@supabase/supabase-js';

export interface ERPStats {
  cashFlow30Days: number;
  unpaidInvoices: { count: number; amount: number };
  invoicesThisMonth: { count: number; amount: number };
  paymentsReceived: { count: number; amount: number };
  expenses: { count: number; amount: number };
}

export interface ModuleStats {
  clients: { count: number; newThisMonth: number };
  quotes: { count: number; amount: number };
  invoices: { count: number; amount: number };
  suppliers: { count: number; newThisMonth: number };
  purchases: { count: number; amount: number };
  expenses: { count: number; amount: number };
}

export interface RecentActivity {
  id: string;
  type: 'invoice_created' | 'payment_received' | 'invoice_overdue' | 'expense_added' | 'supplier_purchase';
  title: string;
  detail: string;
  amount?: number;
  timestamp: string;
}

// Get the start of current month
function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// Get date 30 days ago
function get30DaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

export async function fetchERPStats(supabase: SupabaseClient, orgId: string): Promise<ERPStats> {
  const monthStart = getMonthStart();
  const thirtyDaysAgo = get30DaysAgo();

  try {
    // Fetch unpaid invoices
    const { data: unpaidInvoices } = await supabase
      .from('erp_invoices')
      .select('id, balance_due')
      .eq('org_id', orgId)
      .in('status', ['sent', 'partial', 'overdue']);

    // Fetch invoices this month
    const { data: monthInvoices } = await supabase
      .from('erp_invoices')
      .select('id, total_ttc')
      .eq('org_id', orgId)
      .gte('invoice_date', monthStart);

    // Fetch payments received this month
    const { data: payments } = await supabase
      .from('erp_payments')
      .select('id, amount')
      .eq('org_id', orgId)
      .gte('payment_date', monthStart);

    // Fetch expenses this month
    const { data: expenses } = await supabase
      .from('erp_expenses')
      .select('id, amount_ttc')
      .eq('org_id', orgId)
      .gte('expense_date', monthStart);

    // Calculate cash flow (payments received - expenses)
    const totalPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_ttc || 0), 0) || 0;

    return {
      cashFlow30Days: totalPayments - totalExpenses,
      unpaidInvoices: {
        count: unpaidInvoices?.length || 0,
        amount: unpaidInvoices?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0,
      },
      invoicesThisMonth: {
        count: monthInvoices?.length || 0,
        amount: monthInvoices?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0,
      },
      paymentsReceived: {
        count: payments?.length || 0,
        amount: totalPayments,
      },
      expenses: {
        count: expenses?.length || 0,
        amount: totalExpenses,
      },
    };
  } catch (error) {
    console.error('Error fetching ERP stats:', error);
    return {
      cashFlow30Days: 0,
      unpaidInvoices: { count: 0, amount: 0 },
      invoicesThisMonth: { count: 0, amount: 0 },
      paymentsReceived: { count: 0, amount: 0 },
      expenses: { count: 0, amount: 0 },
    };
  }
}

export async function fetchModuleStats(supabase: SupabaseClient, orgId: string): Promise<ModuleStats> {
  const monthStart = getMonthStart();

  try {
    // Clients
    const { count: clientsTotal } = await supabase
      .from('erp_clients')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);

    const { count: clientsNew } = await supabase
      .from('erp_clients')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', monthStart);

    // Quotes (Devis)
    const { data: quotes } = await supabase
      .from('erp_estimates')
      .select('id, total_ttc')
      .eq('org_id', orgId)
      .gte('created_at', monthStart);

    // Invoices
    const { data: invoices } = await supabase
      .from('erp_invoices')
      .select('id, total_ttc')
      .eq('org_id', orgId)
      .gte('created_at', monthStart);

    // Suppliers
    const { count: suppliersTotal } = await supabase
      .from('erp_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);

    const { count: suppliersNew } = await supabase
      .from('erp_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', monthStart);

    // Supplier Invoices (Purchases)
    const { data: purchases } = await supabase
      .from('erp_supplier_invoices')
      .select('id, total_ttc')
      .eq('org_id', orgId)
      .gte('created_at', monthStart);

    // Expenses
    const { data: expenses } = await supabase
      .from('erp_expenses')
      .select('id, amount_ttc')
      .eq('org_id', orgId)
      .gte('created_at', monthStart);

    return {
      clients: { count: clientsTotal || 0, newThisMonth: clientsNew || 0 },
      quotes: {
        count: quotes?.length || 0,
        amount: quotes?.reduce((sum, q) => sum + (q.total_ttc || 0), 0) || 0,
      },
      invoices: {
        count: invoices?.length || 0,
        amount: invoices?.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0) || 0,
      },
      suppliers: { count: suppliersTotal || 0, newThisMonth: suppliersNew || 0 },
      purchases: {
        count: purchases?.length || 0,
        amount: purchases?.reduce((sum, p) => sum + (p.total_ttc || 0), 0) || 0,
      },
      expenses: {
        count: expenses?.length || 0,
        amount: expenses?.reduce((sum, e) => sum + (e.amount_ttc || 0), 0) || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching module stats:', error);
    return {
      clients: { count: 0, newThisMonth: 0 },
      quotes: { count: 0, amount: 0 },
      invoices: { count: 0, amount: 0 },
      suppliers: { count: 0, newThisMonth: 0 },
      purchases: { count: 0, amount: 0 },
      expenses: { count: 0, amount: 0 },
    };
  }
}

export async function fetchRecentActivity(supabase: SupabaseClient, orgId: string): Promise<RecentActivity[]> {
  const activities: RecentActivity[] = [];

  try {
    // Recent invoices
    const { data: recentInvoices } = await supabase
      .from('erp_invoices')
      .select('id, invoice_number, total_ttc, status, created_at, client:erp_clients(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);

    recentInvoices?.forEach((inv: any) => {
      if (inv.status === 'overdue') {
        activities.push({
          id: `inv-overdue-${inv.id}`,
          type: 'invoice_overdue',
          title: 'Facture en retard',
          detail: `${inv.invoice_number} - ${inv.client?.name || 'Client'}`,
          amount: inv.total_ttc,
          timestamp: inv.created_at,
        });
      } else {
        activities.push({
          id: `inv-${inv.id}`,
          type: 'invoice_created',
          title: 'Nouvelle facture créée',
          detail: `${inv.invoice_number} - ${inv.client?.name || 'Client'}`,
          amount: inv.total_ttc,
          timestamp: inv.created_at,
        });
      }
    });

    // Recent payments
    const { data: recentPayments } = await supabase
      .from('erp_payments')
      .select('id, amount, payment_date, invoice:erp_invoices(invoice_number, client:erp_clients(name))')
      .eq('org_id', orgId)
      .order('payment_date', { ascending: false })
      .limit(5);

    recentPayments?.forEach((pay: any) => {
      activities.push({
        id: `pay-${pay.id}`,
        type: 'payment_received',
        title: 'Paiement reçu',
        detail: `${pay.invoice?.invoice_number || 'Facture'} - ${pay.invoice?.client?.name || 'Client'}`,
        amount: pay.amount,
        timestamp: pay.payment_date,
      });
    });

    // Recent expenses
    const { data: recentExpenses } = await supabase
      .from('erp_expenses')
      .select('id, description, amount_ttc, expense_date, supplier:erp_suppliers(name)')
      .eq('org_id', orgId)
      .order('expense_date', { ascending: false })
      .limit(5);

    recentExpenses?.forEach((exp: any) => {
      activities.push({
        id: `exp-${exp.id}`,
        type: 'expense_added',
        title: 'Dépense ajoutée',
        detail: exp.description || exp.supplier?.name || 'Dépense',
        amount: exp.amount_ttc,
        timestamp: exp.expense_date,
      });
    });

    // Recent supplier invoices
    const { data: recentPurchases } = await supabase
      .from('erp_supplier_invoices')
      .select('id, invoice_number, total_ttc, created_at, supplier:erp_suppliers(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);

    recentPurchases?.forEach((pur: any) => {
      activities.push({
        id: `pur-${pur.id}`,
        type: 'supplier_purchase',
        title: 'Achat fournisseur',
        detail: `${pur.invoice_number || 'Facture'} - ${pur.supplier?.name || 'Fournisseur'}`,
        amount: pur.total_ttc,
        timestamp: pur.created_at,
      });
    });

    // Sort by timestamp and return top 10
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}
