import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createReconciliationEngine } from '@/lib/reconciliation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/erp/bank/reconciliation
 * Obtenir les matches de réconciliation et statistiques
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const transactionId = searchParams.get('transaction_id');
    const status = searchParams.get('status');
    const getStats = searchParams.get('stats') === 'true';

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Si demande de stats uniquement
    if (getStats) {
      const engine = createReconciliationEngine(supabase, orgId);
      const stats = await engine.getStats();
      return NextResponse.json({ success: true, data: { stats } });
    }

    // Récupérer les matches
    let query = supabase
      .from('erp_reconciliation_matches')
      .select(`
        *,
        bank_transaction:erp_bank_transactions(
          id, operation_date, amount, direction, label_raw, counterparty_name,
          bank_account:erp_bank_accounts(label, iban)
        ),
        matched_invoice:erp_invoices(id, invoice_number, total_ttc, client:erp_clients(name, company_name)),
        matched_supplier_invoice:erp_supplier_invoices(id, invoice_number, total_ttc, supplier:erp_suppliers(name, company_name)),
        matched_expense:erp_expenses(id, description, amount)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (transactionId) {
      query = query.eq('bank_transaction_id', transactionId);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: matches, error } = await query;

    if (error) {
      console.error('Error fetching matches:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        matches: matches || [],
        total: matches?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Reconciliation GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/erp/bank/reconciliation
 * Actions de réconciliation : suggest, accept, reject, manual_match
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, action, transaction_id, match_id, user_id, manual_match } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const engine = createReconciliationEngine(supabase, org_id);
    await engine.loadRules();

    switch (action) {
      case 'suggest': {
        // Trouver des matches pour une transaction
        if (!transaction_id) {
          return NextResponse.json({ success: false, error: 'transaction_id required' }, { status: 400 });
        }

        const { data: transaction, error: txError } = await supabase
          .from('erp_bank_transactions')
          .select('*')
          .eq('id', transaction_id)
          .eq('org_id', org_id)
          .single();

        if (txError || !transaction) {
          return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
        }

        const result = await engine.reconcileTransaction(transaction);

        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case 'suggest_all': {
        // Réconcilier toutes les transactions non matchées
        const { data: transactions, error: txError } = await supabase
          .from('erp_bank_transactions')
          .select('*')
          .eq('org_id', org_id)
          .eq('reconciliation_status', 'unmatched')
          .order('operation_date', { ascending: false })
          .limit(100);

        if (txError) {
          return NextResponse.json({ success: false, error: txError.message }, { status: 500 });
        }

        const results = [];
        let autoMatched = 0;
        let suggested = 0;
        let noMatch = 0;

        for (const tx of transactions || []) {
          const result = await engine.reconcileTransaction(tx);
          results.push({
            transaction_id: tx.id,
            label: tx.label_raw?.substring(0, 50),
            amount: tx.amount,
            auto_matched: result.auto_matched,
            suggestions: result.matches.length,
          });

          if (result.auto_matched) {
            autoMatched++;
          } else if (result.matches.length > 0) {
            suggested++;
          } else {
            noMatch++;
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            processed: transactions?.length || 0,
            auto_matched: autoMatched,
            suggested: suggested,
            no_match: noMatch,
            results: results.slice(0, 20), // Top 20 pour l'affichage
          },
        });
      }

      case 'accept': {
        // Valider un match suggéré
        if (!match_id) {
          return NextResponse.json({ success: false, error: 'match_id required' }, { status: 400 });
        }

        const success = await engine.acceptMatch(match_id, user_id || 'system');

        if (!success) {
          return NextResponse.json({ success: false, error: 'Failed to accept match' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Match accepted' });
      }

      case 'reject': {
        // Rejeter un match suggéré
        if (!match_id) {
          return NextResponse.json({ success: false, error: 'match_id required' }, { status: 400 });
        }

        const success = await engine.rejectMatch(match_id, user_id || 'system', body.reason);

        if (!success) {
          return NextResponse.json({ success: false, error: 'Failed to reject match' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Match rejected' });
      }

      case 'manual_match': {
        // Créer un match manuel
        if (!transaction_id || !manual_match) {
          return NextResponse.json({
            success: false,
            error: 'transaction_id and manual_match required',
          }, { status: 400 });
        }

        const { data: transaction, error: txError } = await supabase
          .from('erp_bank_transactions')
          .select('*')
          .eq('id', transaction_id)
          .eq('org_id', org_id)
          .single();

        if (txError || !transaction) {
          return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
        }

        const matchData = {
          org_id,
          bank_transaction_id: transaction_id,
          match_type: manual_match.type,
          matched_invoice_id: manual_match.invoice_id,
          matched_supplier_invoice_id: manual_match.supplier_invoice_id,
          matched_expense_id: manual_match.expense_id,
          matched_amount: manual_match.amount || transaction.amount,
          confidence_score: 1.0, // Manuel = confiance totale
          is_auto_match: false,
          status: 'accepted',
          match_rule: 'manual',
          created_by: user_id,
          validated_by: user_id,
          validated_at: new Date().toISOString(),
        };

        const { data: match, error: matchError } = await supabase
          .from('erp_reconciliation_matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) {
          return NextResponse.json({ success: false, error: matchError.message }, { status: 500 });
        }

        // Mettre à jour la transaction
        await supabase
          .from('erp_bank_transactions')
          .update({
            reconciliation_status: 'matched',
            reconciliation_score: 1.0,
          })
          .eq('id', transaction_id);

        return NextResponse.json({
          success: true,
          data: { match },
        });
      }

      case 'ignore': {
        // Ignorer une transaction (ne pas chercher de match)
        if (!transaction_id) {
          return NextResponse.json({ success: false, error: 'transaction_id required' }, { status: 400 });
        }

        await supabase
          .from('erp_bank_transactions')
          .update({ reconciliation_status: 'ignored' })
          .eq('id', transaction_id);

        return NextResponse.json({ success: true, message: 'Transaction ignored' });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: suggest, suggest_all, accept, reject, manual_match, ignore',
        }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Reconciliation POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
