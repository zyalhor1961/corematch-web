import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Liste des écritures comptables
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const journalCode = searchParams.get('journal_code');
    const status = searchParams.get('status');
    const sourceType = searchParams.get('source_type');
    const sourceId = searchParams.get('source_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('erp_journal_entries')
      .select(`
        *,
        journal:erp_journals(id, journal_code, journal_name, journal_type),
        lines:erp_journal_lines(
          id,
          account_code,
          debit,
          credit,
          description,
          partner_type,
          partner_name,
          line_number
        )
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Filtres
    if (journalCode) {
      const { data: journal } = await supabase
        .from('erp_journals')
        .select('id')
        .eq('org_id', orgId)
        .eq('journal_code', journalCode)
        .single();
      if (journal) {
        query = query.eq('journal_id', journal.id);
      }
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    if (startDate) {
      query = query.gte('entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: entries, error, count } = await query;

    if (error) {
      console.error('Error fetching entries:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        entries: entries || [],
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (err: any) {
    console.error('Entries API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST - Créer une écriture manuelle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, journal_code, entry_date, description, lines, auto_post } = body;

    if (!org_id || !journal_code || !entry_date || !lines || !Array.isArray(lines)) {
      return NextResponse.json({
        success: false,
        error: 'org_id, journal_code, entry_date, and lines are required',
      }, { status: 400 });
    }

    // Valider l'équilibre
    const totalDebit = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({
        success: false,
        error: `Écriture non équilibrée: Débit ${totalDebit.toFixed(2)} ≠ Crédit ${totalCredit.toFixed(2)}`,
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Import dynamique du moteur
    const { createAccountingEngine } = await import('@/lib/accounting');
    const engine = createAccountingEngine(supabase, org_id);

    const result = await engine.createEntry({
      org_id,
      journal_code,
      source_type: 'manual_adjustment',
      entry_date,
      description: description || 'Écriture manuelle',
      lines: lines.map((l: any) => ({
        account_code: l.account_code,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
        partner_type: l.partner_type,
        partner_id: l.partner_id,
        partner_name: l.partner_name,
      })),
      auto_post: auto_post ?? false,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        entry_id: result.entry_id,
        entry_number: result.entry_number,
      },
    });
  } catch (err: any) {
    console.error('Create entry error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
