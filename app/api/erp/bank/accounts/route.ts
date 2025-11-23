import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/erp/bank/accounts
 * Liste des comptes bancaires de l'organisation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: accounts, error } = await supabase
      .from('erp_bank_accounts')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('label', { ascending: true });

    if (error) {
      console.error('Error fetching bank accounts:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Récupérer les stats de transactions par compte
    const accountsWithStats = await Promise.all((accounts || []).map(async (account) => {
      const { count: txCount } = await supabase
        .from('erp_bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('bank_account_id', account.id);

      const { count: unmatchedCount } = await supabase
        .from('erp_bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('bank_account_id', account.id)
        .eq('reconciliation_status', 'unmatched');

      return {
        ...account,
        transaction_count: txCount || 0,
        unmatched_count: unmatchedCount || 0,
      };
    }));

    return NextResponse.json({
      success: true,
      data: {
        accounts: accountsWithStats,
        total: accounts?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Bank accounts GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/erp/bank/accounts
 * Créer un nouveau compte bancaire
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, label, bank_name, iban, bic, account_number, account_code, is_default } = body;

    if (!org_id || !label) {
      return NextResponse.json({
        success: false,
        error: 'org_id and label required',
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Si is_default, désactiver les autres comptes par défaut
    if (is_default) {
      await supabase
        .from('erp_bank_accounts')
        .update({ is_default: false })
        .eq('org_id', org_id);
    }

    const { data: account, error } = await supabase
      .from('erp_bank_accounts')
      .insert({
        org_id,
        label,
        bank_name,
        iban: iban?.replace(/\s/g, '').toUpperCase(),
        bic: bic?.toUpperCase(),
        account_number,
        account_code: account_code || '512000',
        is_default: is_default || false,
        currency: 'EUR',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bank account:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Initialiser les règles de réconciliation si premier compte
    const { count } = await supabase
      .from('erp_bank_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id);

    if (count === 1) {
      // Premier compte - initialiser les règles
      await supabase.rpc('init_reconciliation_rules', { p_org_id: org_id });
    }

    return NextResponse.json({
      success: true,
      data: account,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Bank accounts POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
