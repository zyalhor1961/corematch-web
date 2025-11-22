import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Liste des journaux comptables
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: journals, error } = await supabase
      .from('erp_journals')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('journal_code', { ascending: true });

    if (error) {
      console.error('Error fetching journals:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Compter les écritures par journal
    const journalsWithStats = await Promise.all((journals || []).map(async (journal) => {
      const { count } = await supabase
        .from('erp_journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('journal_id', journal.id)
        .eq('status', 'posted');

      return {
        ...journal,
        entry_count: count || 0,
      };
    }));

    return NextResponse.json({
      success: true,
      data: {
        journals: journalsWithStats,
        total: journals?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Journals API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
