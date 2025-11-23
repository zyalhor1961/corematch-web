import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Liste des comptes du Plan Comptable Général
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const accountClass = searchParams.get('class'); // 1-7
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const systemOnly = searchParams.get('system_only') === 'true';
    const customOnly = searchParams.get('custom_only') === 'true';

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_chart_of_accounts')
      .select('*')
      .eq('org_id', orgId)
      .order('code', { ascending: true });

    if (accountClass) {
      query = query.like('code', `${accountClass}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (systemOnly) {
      query = query.eq('is_system', true);
    }

    if (customOnly) {
      query = query.eq('is_system', false);
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,label.ilike.%${search}%`);
    }

    const { data: accounts, error } = await query;

    if (error) {
      console.error('Error fetching chart of accounts:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Grouper par classe (premier chiffre du code)
    const byClass: Record<string, { label: string; accounts: any[] }> = {
      '1': { label: 'Comptes de capitaux', accounts: [] },
      '2': { label: 'Comptes d\'immobilisations', accounts: [] },
      '3': { label: 'Comptes de stocks', accounts: [] },
      '4': { label: 'Comptes de tiers', accounts: [] },
      '5': { label: 'Comptes financiers', accounts: [] },
      '6': { label: 'Comptes de charges', accounts: [] },
      '7': { label: 'Comptes de produits', accounts: [] },
    };

    (accounts || []).forEach(account => {
      const cls = account.code?.charAt(0);
      if (cls && byClass[cls]) {
        byClass[cls].accounts.push(account);
      }
    });

    // Stats
    const stats = {
      total: accounts?.length || 0,
      system: accounts?.filter(a => a.is_system).length || 0,
      custom: accounts?.filter(a => !a.is_system).length || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        accounts: accounts || [],
        by_class: byClass,
        stats,
      },
    });
  } catch (err: any) {
    console.error('Chart of accounts API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST - Créer un nouveau compte ou initialiser le PCG
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, action } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Action: Initialiser le PCG 2025
    if (action === 'initialize_pcg') {
      const { data, error } = await supabase.rpc('init_pcg_2025', { p_org_id: org_id });

      if (error) {
        console.error('Error initializing PCG:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Plan Comptable Général 2025 initialisé: ${data} comptes créés`,
        count: data,
      });
    }

    // Créer un compte personnalisé
    const { code, label, account_type, category, parent_code } = body;

    if (!code || !label || !account_type) {
      return NextResponse.json({
        success: false,
        error: 'code, label et account_type sont requis',
      }, { status: 400 });
    }

    // Vérifier que le code n'existe pas déjà
    const { data: existing } = await supabase
      .from('erp_chart_of_accounts')
      .select('id')
      .eq('org_id', org_id)
      .eq('code', code)
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `Le compte ${code} existe déjà`,
      }, { status: 400 });
    }

    // Déterminer le niveau (basé sur la longueur du code)
    const level = code.length <= 2 ? 1 : code.length <= 3 ? 2 : code.length <= 4 ? 3 : 4;

    const { data: account, error } = await supabase
      .from('erp_chart_of_accounts')
      .insert({
        org_id,
        code,
        label,
        account_type,
        category: category || 'other',
        parent_code,
        level,
        is_system: false, // Comptes personnalisés
        accounting_standard: 'PCG',
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

/**
 * PUT - Modifier un compte (uniquement les comptes personnalisés)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, org_id, label, category, is_active } = body;

    if (!id || !org_id) {
      return NextResponse.json({ success: false, error: 'id et org_id requis' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier que le compte n'est pas système
    const { data: existing } = await supabase
      .from('erp_chart_of_accounts')
      .select('is_system')
      .eq('id', id)
      .eq('org_id', org_id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Compte non trouvé' }, { status: 404 });
    }

    if (existing.is_system) {
      return NextResponse.json({
        success: false,
        error: 'Les comptes système du PCG ne peuvent pas être modifiés',
      }, { status: 403 });
    }

    const updates: any = {};
    if (label !== undefined) updates.label = label;
    if (category !== undefined) updates.category = category;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: account, error } = await supabase
      .from('erp_chart_of_accounts')
      .update(updates)
      .eq('id', id)
      .eq('org_id', org_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating account:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: account });
  } catch (err: any) {
    console.error('Update account error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE - Supprimer un compte personnalisé
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const orgId = searchParams.get('org_id');

    if (!id || !orgId) {
      return NextResponse.json({ success: false, error: 'id et org_id requis' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier que le compte n'est pas système et n'a pas d'écritures
    const { data: existing } = await supabase
      .from('erp_chart_of_accounts')
      .select('code, is_system')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Compte non trouvé' }, { status: 404 });
    }

    if (existing.is_system) {
      return NextResponse.json({
        success: false,
        error: 'Les comptes système du PCG ne peuvent pas être supprimés',
      }, { status: 403 });
    }

    // Vérifier qu'il n'y a pas d'écritures sur ce compte
    const { count } = await supabase
      .from('erp_journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('account_code', existing.code);

    if (count && count > 0) {
      return NextResponse.json({
        success: false,
        error: `Ce compte a ${count} écriture(s). Impossible de le supprimer.`,
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('erp_chart_of_accounts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('Error deleting account:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Compte supprimé' });
  } catch (err: any) {
    console.error('Delete account error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
