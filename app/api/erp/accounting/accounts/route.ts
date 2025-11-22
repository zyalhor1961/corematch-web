import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Liste des comptes (plan comptable)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const accountClass = searchParams.get('class');
    const accountType = searchParams.get('type');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('active_only') !== 'false';

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_accounts')
      .select('*')
      .eq('org_id', orgId)
      .order('account_code', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (accountClass) {
      query = query.eq('account_class', accountClass);
    }

    if (accountType) {
      query = query.eq('account_type', accountType);
    }

    if (search) {
      query = query.or(`account_code.ilike.%${search}%,account_name.ilike.%${search}%`);
    }

    const { data: accounts, error } = await query;

    if (error) {
      console.error('Error fetching accounts:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Grouper par classe
    const byClass = (accounts || []).reduce((acc: Record<string, any[]>, account) => {
      const cls = account.account_class;
      if (!acc[cls]) acc[cls] = [];
      acc[cls].push(account);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        accounts: accounts || [],
        by_class: byClass,
        total: accounts?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Accounts API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST - Créer un compte (ou initialiser le plan comptable)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, action, account_code, account_name, account_class, account_type } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Action spéciale: initialiser le plan comptable
    if (action === 'initialize') {
      const { initializeOrganizationAccounting } = await import('@/lib/accounting');
      const result = await initializeOrganizationAccounting(supabase, org_id);

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Plan comptable initialisé avec succès',
      });
    }

    // Créer un compte individuel
    if (!account_code || !account_name || !account_class || !account_type) {
      return NextResponse.json({
        success: false,
        error: 'account_code, account_name, account_class, and account_type are required',
      }, { status: 400 });
    }

    const { data: account, error } = await supabase
      .from('erp_accounts')
      .insert({
        org_id,
        account_code,
        account_name,
        account_class,
        account_type,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: account });
  } catch (err: any) {
    console.error('Create account error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
