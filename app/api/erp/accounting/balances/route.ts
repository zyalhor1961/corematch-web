import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Soldes des comptes (balance)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const accountCode = searchParams.get('account_code');
    const accountClass = searchParams.get('class');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Requête pour calculer les soldes
    let balanceQuery = `
      SELECT
        a.account_code,
        a.account_name,
        a.account_class,
        a.account_type,
        COALESCE(SUM(l.debit), 0) as total_debit,
        COALESCE(SUM(l.credit), 0) as total_credit,
        COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as balance
      FROM erp_accounts a
      LEFT JOIN erp_journal_lines l ON l.account_code = a.account_code
      LEFT JOIN erp_journal_entries e ON e.id = l.entry_id
        AND e.org_id = a.org_id
        AND e.status = 'posted'
    `;

    const params: any[] = [orgId];
    let paramIndex = 2;

    // Filtres de date sur les écritures
    if (startDate) {
      balanceQuery += ` AND (e.entry_date >= $${paramIndex} OR e.id IS NULL)`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      balanceQuery += ` AND (e.entry_date <= $${paramIndex} OR e.id IS NULL)`;
      params.push(endDate);
      paramIndex++;
    }

    balanceQuery += `
      WHERE a.org_id = $1 AND a.is_active = true
    `;

    if (accountCode) {
      balanceQuery += ` AND a.account_code = $${paramIndex}`;
      params.push(accountCode);
      paramIndex++;
    }

    if (accountClass) {
      balanceQuery += ` AND a.account_class = $${paramIndex}`;
      params.push(accountClass);
      paramIndex++;
    }

    balanceQuery += `
      GROUP BY a.account_code, a.account_name, a.account_class, a.account_type
      ORDER BY a.account_code
    `;

    const { data: balances, error } = await supabase.rpc('exec_sql', {
      sql_query: balanceQuery,
      sql_params: params,
    });

    // Fallback si la fonction RPC n'existe pas
    if (error) {
      // Utiliser une approche alternative
      const { data: accounts } = await supabase
        .from('erp_accounts')
        .select('account_code, account_name, account_class, account_type')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('account_code');

      const balancesAlt = await Promise.all((accounts || []).map(async (account) => {
        let query = supabase
          .from('erp_journal_lines')
          .select('debit, credit')
          .eq('account_code', account.account_code);

        // Joindre les entries pour filtrer par org et status
        const { data: lines } = await supabase
          .from('erp_journal_lines')
          .select(`
            debit,
            credit,
            entry:erp_journal_entries!inner(
              org_id,
              status,
              entry_date
            )
          `)
          .eq('account_code', account.account_code)
          .eq('entry.org_id', orgId)
          .eq('entry.status', 'posted');

        let filteredLines = lines || [];

        // Filtrer par date
        if (startDate) {
          filteredLines = filteredLines.filter((l: any) => l.entry.entry_date >= startDate);
        }
        if (endDate) {
          filteredLines = filteredLines.filter((l: any) => l.entry.entry_date <= endDate);
        }

        const totalDebit = filteredLines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
        const totalCredit = filteredLines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);

        return {
          ...account,
          total_debit: totalDebit,
          total_credit: totalCredit,
          balance: totalDebit - totalCredit,
        };
      }));

      // Filtrer les comptes sans mouvement si demandé
      const filteredBalances = balancesAlt.filter(b =>
        b.total_debit > 0 || b.total_credit > 0
      );

      // Calculer les totaux par classe
      const byClass = filteredBalances.reduce((acc: Record<string, any>, b) => {
        const cls = b.account_class;
        if (!acc[cls]) {
          acc[cls] = { total_debit: 0, total_credit: 0, balance: 0, accounts: [] };
        }
        acc[cls].total_debit += b.total_debit;
        acc[cls].total_credit += b.total_credit;
        acc[cls].balance += b.balance;
        acc[cls].accounts.push(b);
        return acc;
      }, {});

      // Totaux généraux
      const totals = {
        total_debit: filteredBalances.reduce((sum, b) => sum + b.total_debit, 0),
        total_credit: filteredBalances.reduce((sum, b) => sum + b.total_credit, 0),
      };

      return NextResponse.json({
        success: true,
        data: {
          balances: filteredBalances,
          by_class: byClass,
          totals,
          period: { start_date: startDate, end_date: endDate },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        balances: balances || [],
        period: { start_date: startDate, end_date: endDate },
      },
    });
  } catch (err: any) {
    console.error('Balances API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
