import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/erp/lettrage
 * Liste les écritures non lettrées pour un compte (411 ou 401)
 * et les lettrages existants
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const accountType = searchParams.get('account_type'); // 'client' ou 'supplier'
    const entityId = searchParams.get('entity_id'); // client_id ou supplier_id
    const status = searchParams.get('status'); // 'unmatched', 'partial', 'matched'
    const getStats = searchParams.get('stats') === 'true';

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Si demande de stats uniquement
    if (getStats) {
      const stats = await getLettrageStats(supabase, orgId, accountType);
      return NextResponse.json({ success: true, data: { stats } });
    }

    // Déterminer le compte à analyser
    const accountPrefix = accountType === 'supplier' ? '401' : '411';

    // Récupérer les écritures non lettrées
    let query = supabase
      .from('erp_journal_entries')
      .select(`
        id,
        journal_id,
        entry_date,
        piece_number,
        piece_date,
        account_code,
        account_label,
        label,
        debit,
        credit,
        is_lettred,
        lettrage_code,
        reference_type,
        reference_id,
        journal:erp_accounting_journals(code, name)
      `)
      .eq('org_id', orgId)
      .like('account_code', `${accountPrefix}%`)
      .order('entry_date', { ascending: false });

    if (status === 'unmatched') {
      query = query.eq('is_lettred', false);
    } else if (status === 'matched') {
      query = query.eq('is_lettred', true);
    }

    // Filtrer par entité si spécifié
    if (entityId) {
      const refType = accountType === 'supplier' ? 'supplier' : 'client';
      query = query.eq('reference_type', refType).eq('reference_id', entityId);
    }

    const { data: entries, error } = await query.limit(200);

    if (error) {
      console.error('Error fetching entries:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Récupérer les lettrages existants
    const { data: lettrages, error: lettrageError } = await supabase
      .from('erp_account_lettrage')
      .select(`
        *,
        lines:erp_account_lettrage_lines(
          id,
          entry_id,
          amount
        )
      `)
      .eq('org_id', orgId)
      .eq('account_type', accountType || 'client')
      .order('created_at', { ascending: false })
      .limit(50);

    if (lettrageError) {
      console.error('Error fetching lettrages:', lettrageError);
    }

    // Grouper les écritures non lettrées par tiers
    const groupedEntries = groupEntriesByEntity(entries || [], accountType || 'client');

    return NextResponse.json({
      success: true,
      data: {
        entries: entries || [],
        grouped: groupedEntries,
        lettrages: lettrages || [],
        total: entries?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('Lettrage GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/erp/lettrage
 * Actions de lettrage : create, auto_suggest, validate, cancel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, action, account_type, entity_id, entry_ids, user_id } = body;

    if (!org_id) {
      return NextResponse.json({ success: false, error: 'org_id required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'create': {
        // Créer un lettrage manuel
        if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length < 2) {
          return NextResponse.json({
            success: false,
            error: 'At least 2 entry_ids required',
          }, { status: 400 });
        }

        // Récupérer les écritures sélectionnées
        const { data: entries, error: entriesError } = await supabase
          .from('erp_journal_entries')
          .select('*')
          .in('id', entry_ids)
          .eq('org_id', org_id);

        if (entriesError || !entries || entries.length < 2) {
          return NextResponse.json({
            success: false,
            error: 'Could not find entries',
          }, { status: 404 });
        }

        // Vérifier que les écritures ne sont pas déjà lettrées
        const alreadyLettred = entries.filter((e) => e.is_lettred);
        if (alreadyLettred.length > 0) {
          return NextResponse.json({
            success: false,
            error: 'Some entries are already lettred',
          }, { status: 400 });
        }

        // Calculer le solde
        const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
        const balance = Math.abs(totalDebit - totalCredit);

        // Déterminer le type de lettrage
        const lettrageStatus = balance < 0.01 ? 'balanced' : 'partial';

        // Générer le code de lettrage
        const { data: codeResult } = await supabase.rpc('generate_next_lettrage_code', {
          p_org_id: org_id,
          p_account_type: account_type || 'client',
        });

        const lettrageCode = codeResult || `L${Date.now()}`;

        // Créer le lettrage
        const { data: lettrage, error: lettrageError } = await supabase
          .from('erp_account_lettrage')
          .insert({
            org_id,
            lettrage_code: lettrageCode,
            account_type: account_type || 'client',
            entity_id,
            total_debit: totalDebit,
            total_credit: totalCredit,
            balance,
            status: lettrageStatus,
            created_by: user_id,
          })
          .select()
          .single();

        if (lettrageError) {
          console.error('Error creating lettrage:', lettrageError);
          return NextResponse.json({ success: false, error: lettrageError.message }, { status: 500 });
        }

        // Créer les lignes de lettrage
        const lines = entries.map((e) => ({
          lettrage_id: lettrage.id,
          entry_id: e.id,
          amount: e.debit || e.credit || 0,
        }));

        await supabase.from('erp_account_lettrage_lines').insert(lines);

        // Mettre à jour les écritures
        await supabase
          .from('erp_journal_entries')
          .update({
            is_lettred: true,
            lettrage_code: lettrageCode,
          })
          .in('id', entry_ids);

        return NextResponse.json({
          success: true,
          data: {
            lettrage,
            code: lettrageCode,
            status: lettrageStatus,
            balance,
          },
        });
      }

      case 'auto_suggest': {
        // Suggérer automatiquement des lettrages
        const suggestions = await suggestLettrages(supabase, org_id, account_type || 'client', entity_id);

        return NextResponse.json({
          success: true,
          data: { suggestions },
        });
      }

      case 'auto_lettrage': {
        // Exécuter le lettrage automatique pour les suggestions parfaites
        const results = await executeAutoLettrage(supabase, org_id, account_type || 'client', user_id);

        return NextResponse.json({
          success: true,
          data: results,
        });
      }

      case 'cancel': {
        // Annuler un lettrage
        const { lettrage_id } = body;

        if (!lettrage_id) {
          return NextResponse.json({
            success: false,
            error: 'lettrage_id required',
          }, { status: 400 });
        }

        // Récupérer le lettrage
        const { data: lettrage, error: lettrageError } = await supabase
          .from('erp_account_lettrage')
          .select('*, lines:erp_account_lettrage_lines(entry_id)')
          .eq('id', lettrage_id)
          .eq('org_id', org_id)
          .single();

        if (lettrageError || !lettrage) {
          return NextResponse.json({ success: false, error: 'Lettrage not found' }, { status: 404 });
        }

        // Délettrer les écritures
        const entryIds = lettrage.lines.map((l: any) => l.entry_id);
        await supabase
          .from('erp_journal_entries')
          .update({
            is_lettred: false,
            lettrage_code: null,
          })
          .in('id', entryIds);

        // Supprimer les lignes et le lettrage
        await supabase.from('erp_account_lettrage_lines').delete().eq('lettrage_id', lettrage_id);
        await supabase.from('erp_account_lettrage').delete().eq('id', lettrage_id);

        return NextResponse.json({
          success: true,
          message: 'Lettrage cancelled',
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: create, auto_suggest, auto_lettrage, cancel',
        }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Lettrage POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * Statistiques de lettrage
 */
async function getLettrageStats(supabase: any, orgId: string, accountType?: string | null) {
  const accountPrefix = accountType === 'supplier' ? '401' : '411';

  // Écritures non lettrées
  const { count: unmatchedCount } = await supabase
    .from('erp_journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .like('account_code', `${accountPrefix}%`)
    .eq('is_lettred', false);

  // Écritures lettrées
  const { count: matchedCount } = await supabase
    .from('erp_journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .like('account_code', `${accountPrefix}%`)
    .eq('is_lettred', true);

  // Somme des non lettrées
  const { data: unmatchedSums } = await supabase
    .from('erp_journal_entries')
    .select('debit, credit')
    .eq('org_id', orgId)
    .like('account_code', `${accountPrefix}%`)
    .eq('is_lettred', false);

  const totalUnmatchedDebit = (unmatchedSums || []).reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
  const totalUnmatchedCredit = (unmatchedSums || []).reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

  // Nombre de lettrages
  const { count: lettrageCount } = await supabase
    .from('erp_account_lettrage')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('account_type', accountType || 'client');

  return {
    unmatched_entries: unmatchedCount || 0,
    matched_entries: matchedCount || 0,
    total_unmatched_debit: totalUnmatchedDebit,
    total_unmatched_credit: totalUnmatchedCredit,
    balance: totalUnmatchedDebit - totalUnmatchedCredit,
    lettrage_count: lettrageCount || 0,
  };
}

/**
 * Grouper les écritures par entité (client ou fournisseur)
 */
function groupEntriesByEntity(entries: any[], accountType: string) {
  const groups: Record<string, {
    entity_id: string | null;
    entity_name: string;
    account_code: string;
    entries: any[];
    total_debit: number;
    total_credit: number;
    balance: number;
  }> = {};

  for (const entry of entries) {
    const key = entry.reference_id || entry.account_code;

    if (!groups[key]) {
      groups[key] = {
        entity_id: entry.reference_id,
        entity_name: entry.account_label || entry.account_code,
        account_code: entry.account_code,
        entries: [],
        total_debit: 0,
        total_credit: 0,
        balance: 0,
      };
    }

    groups[key].entries.push(entry);
    groups[key].total_debit += entry.debit || 0;
    groups[key].total_credit += entry.credit || 0;
    groups[key].balance = groups[key].total_debit - groups[key].total_credit;
  }

  return Object.values(groups).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

/**
 * Suggérer des lettrages automatiques
 */
async function suggestLettrages(
  supabase: any,
  orgId: string,
  accountType: string,
  entityId?: string
) {
  const accountPrefix = accountType === 'supplier' ? '401' : '411';

  // Récupérer les écritures non lettrées
  let query = supabase
    .from('erp_journal_entries')
    .select('*')
    .eq('org_id', orgId)
    .like('account_code', `${accountPrefix}%`)
    .eq('is_lettred', false)
    .order('entry_date', { ascending: true });

  if (entityId) {
    const refType = accountType === 'supplier' ? 'supplier' : 'client';
    query = query.eq('reference_type', refType).eq('reference_id', entityId);
  }

  const { data: entries } = await query.limit(500);

  if (!entries || entries.length < 2) {
    return [];
  }

  const suggestions: Array<{
    entry_ids: string[];
    total_debit: number;
    total_credit: number;
    balance: number;
    confidence: number;
    reason: string;
  }> = [];

  // Stratégie 1: Match exact débit/crédit sur même référence
  const byReference: Record<string, any[]> = {};
  for (const entry of entries) {
    if (entry.reference_id) {
      const key = `${entry.reference_type}_${entry.reference_id}`;
      if (!byReference[key]) byReference[key] = [];
      byReference[key].push(entry);
    }
  }

  for (const [, refEntries] of Object.entries(byReference)) {
    if (refEntries.length >= 2) {
      const debits = refEntries.filter((e) => e.debit > 0);
      const credits = refEntries.filter((e) => e.credit > 0);

      for (const debit of debits) {
        for (const credit of credits) {
          if (Math.abs(debit.debit - credit.credit) < 0.01) {
            suggestions.push({
              entry_ids: [debit.id, credit.id],
              total_debit: debit.debit,
              total_credit: credit.credit,
              balance: 0,
              confidence: 1.0,
              reason: 'Montant exact sur même référence',
            });
          }
        }
      }
    }
  }

  // Stratégie 2: Match exact montant sans référence
  const usedIds = new Set(suggestions.flatMap((s) => s.entry_ids));
  const remaining = entries.filter((e) => !usedIds.has(e.id));

  const debits = remaining.filter((e) => e.debit > 0);
  const credits = remaining.filter((e) => e.credit > 0);

  for (const debit of debits) {
    for (const credit of credits) {
      if (Math.abs(debit.debit - credit.credit) < 0.01) {
        // Vérifier si dates proches (moins de 60 jours)
        const daysDiff = Math.abs(
          (new Date(debit.entry_date).getTime() - new Date(credit.entry_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysDiff <= 60) {
          suggestions.push({
            entry_ids: [debit.id, credit.id],
            total_debit: debit.debit,
            total_credit: credit.credit,
            balance: 0,
            confidence: daysDiff <= 7 ? 0.9 : daysDiff <= 30 ? 0.8 : 0.7,
            reason: `Montant exact, ${Math.round(daysDiff)} jours d'écart`,
          });
        }
      }
    }
  }

  // Trier par confiance décroissante
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 50);
}

/**
 * Exécuter le lettrage automatique pour les suggestions à haute confiance
 */
async function executeAutoLettrage(
  supabase: any,
  orgId: string,
  accountType: string,
  userId?: string
) {
  const suggestions = await suggestLettrages(supabase, orgId, accountType);
  const highConfidence = suggestions.filter((s) => s.confidence >= 0.9 && s.balance === 0);

  let created = 0;
  const results: Array<{ code: string; entry_ids: string[] }> = [];
  const usedIds = new Set<string>();

  for (const suggestion of highConfidence) {
    // Éviter les doublons
    if (suggestion.entry_ids.some((id) => usedIds.has(id))) {
      continue;
    }

    // Générer le code
    const { data: codeResult } = await supabase.rpc('generate_next_lettrage_code', {
      p_org_id: orgId,
      p_account_type: accountType,
    });

    const lettrageCode = codeResult || `L${Date.now()}`;

    // Créer le lettrage
    const { data: lettrage, error } = await supabase
      .from('erp_account_lettrage')
      .insert({
        org_id: orgId,
        lettrage_code: lettrageCode,
        account_type: accountType,
        total_debit: suggestion.total_debit,
        total_credit: suggestion.total_credit,
        balance: 0,
        status: 'balanced',
        is_auto: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error || !lettrage) continue;

    // Créer les lignes
    const lines = suggestion.entry_ids.map((entryId, idx) => ({
      lettrage_id: lettrage.id,
      entry_id: entryId,
      amount: idx === 0 ? suggestion.total_debit : suggestion.total_credit,
    }));

    await supabase.from('erp_account_lettrage_lines').insert(lines);

    // Mettre à jour les écritures
    await supabase
      .from('erp_journal_entries')
      .update({
        is_lettred: true,
        lettrage_code: lettrageCode,
      })
      .in('id', suggestion.entry_ids);

    suggestion.entry_ids.forEach((id) => usedIds.add(id));
    created++;
    results.push({ code: lettrageCode, entry_ids: suggestion.entry_ids });
  }

  return {
    suggestions_found: suggestions.length,
    high_confidence: highConfidence.length,
    created,
    results,
  };
}
