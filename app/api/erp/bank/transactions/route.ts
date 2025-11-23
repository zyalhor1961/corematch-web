import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createReconciliationEngine } from '@/lib/reconciliation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/erp/bank/transactions
 * Liste des transactions bancaires avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const bankAccountId = searchParams.get('bank_account_id');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const direction = searchParams.get('direction');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_bank_transactions')
      .select(`
        *,
        bank_account:erp_bank_accounts(id, label, bank_name, iban),
        matches:erp_reconciliation_matches(
          id, match_type, matched_amount, confidence_score, status,
          matched_invoice:erp_invoices(id, invoice_number, total_ttc),
          matched_supplier_invoice:erp_supplier_invoices(id, invoice_number, total_ttc)
        )
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .order('operation_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }

    if (status && status !== 'all') {
      query = query.eq('reconciliation_status', status);
    }

    if (direction && direction !== 'all') {
      query = query.eq('direction', direction);
    }

    if (startDate) {
      query = query.gte('operation_date', startDate);
    }

    if (endDate) {
      query = query.lte('operation_date', endDate);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Calculer les stats
    const stats = {
      total: count || 0,
      unmatched: 0,
      suggested: 0,
      matched: 0,
      total_credit: 0,
      total_debit: 0,
    };

    for (const tx of transactions || []) {
      if (tx.direction === 'credit') {
        stats.total_credit += Math.abs(tx.amount);
      } else {
        stats.total_debit += Math.abs(tx.amount);
      }

      switch (tx.reconciliation_status) {
        case 'unmatched': stats.unmatched++; break;
        case 'suggested': stats.suggested++; break;
        case 'matched': stats.matched++; break;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions || [],
        total: count || 0,
        stats,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    console.error('Bank transactions API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/erp/bank/transactions
 * Créer/importer des transactions bancaires
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, bank_account_id, transactions, auto_reconcile } = body;

    if (!org_id || !bank_account_id || !transactions || !Array.isArray(transactions)) {
      return NextResponse.json({
        success: false,
        error: 'org_id, bank_account_id, and transactions array required',
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Préparer les transactions pour l'insertion
    const txData = transactions.map((tx: any) => ({
      org_id,
      bank_account_id,
      operation_date: tx.date || tx.operation_date,
      value_date: tx.value_date,
      amount: Math.abs(tx.amount),
      currency: tx.currency || 'EUR',
      direction: tx.amount >= 0 ? 'credit' : 'debit',
      label_raw: tx.label || tx.label_raw,
      label_clean: tx.label_clean,
      bank_reference: tx.reference || tx.bank_reference,
      counterparty_name: tx.counterparty_name,
      counterparty_iban: tx.counterparty_iban,
      reconciliation_status: 'unmatched',
    }));

    const { data: inserted, error } = await supabase
      .from('erp_bank_transactions')
      .insert(txData)
      .select();

    if (error) {
      console.error('Error inserting transactions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Auto-réconciliation si demandé
    let reconciliationResults = [];
    if (auto_reconcile && inserted) {
      const engine = createReconciliationEngine(supabase, org_id);
      await engine.loadRules();

      for (const tx of inserted) {
        const result = await engine.reconcileTransaction(tx);
        reconciliationResults.push({
          transaction_id: tx.id,
          auto_matched: result.auto_matched,
          best_match: result.best_match,
          match_count: result.matches.length,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported: inserted?.length || 0,
        transactions: inserted || [],
        reconciliation_results: reconciliationResults,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error('Bank transactions POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
