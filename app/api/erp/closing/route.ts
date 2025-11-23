import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';

/**
 * GET /api/erp/closing
 * Récupère les périodes fiscales et leur statut de clôture
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;
    const searchParams = request.nextUrl.searchParams;
    const fiscalYear = searchParams.get('fiscal_year');

    let query = supabaseAdmin
      .from('erp_fiscal_periods')
      .select('*')
      .eq('org_id', orgId)
      .order('fiscal_year', { ascending: false })
      .order('period_number', { ascending: true });

    if (fiscalYear) {
      query = query.eq('fiscal_year', parseInt(fiscalYear));
    }

    const { data: periods, error } = await query;

    if (error) {
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    // Récupérer les écritures de clôture
    const { data: closingEntries } = await supabaseAdmin
      .from('erp_closing_entries')
      .select('*')
      .eq('org_id', orgId);

    return NextResponse.json({
      success: true,
      data: {
        periods: periods || [],
        closing_entries: closingEntries || [],
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/closing [GET]');
  }
}

/**
 * POST /api/erp/closing
 * Actions de clôture : create_period, close_period, create_closing_entries, reopen_period
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    // Vérifier les droits admin pour les actions de clôture
    if (!['org_admin', 'org_manager'].includes(userOrg.role)) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'Admin rights required for closing operations');
    }

    const orgId = userOrg.org_id;
    const body = await request.json();
    const { action, fiscal_year, period_number, period_type = 'annual' } = body;

    switch (action) {
      case 'create_period': {
        // Créer une nouvelle période fiscale
        if (!fiscal_year) {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'fiscal_year is required');
        }

        // Calculer les dates de la période
        const year = parseInt(fiscal_year);
        let periodStart: string;
        let periodEnd: string;

        if (period_type === 'annual') {
          periodStart = `${year}-01-01`;
          periodEnd = `${year}-12-31`;
        } else if (period_type === 'monthly' && period_number) {
          const month = parseInt(period_number);
          periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          periodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        } else {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'Invalid period configuration');
        }

        const { data: period, error } = await supabaseAdmin
          .from('erp_fiscal_periods')
          .insert({
            org_id: orgId,
            fiscal_year: year,
            period_number: period_number || 1,
            period_type,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'open',
          })
          .select()
          .single();

        if (error) {
          throw new AppError(ErrorType.DATABASE_ERROR, error.message);
        }

        return NextResponse.json({
          success: true,
          data: period,
          message: 'Période fiscale créée',
        });
      }

      case 'close_period': {
        // Clôturer une période fiscale
        const { period_id } = body;

        if (!period_id) {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'period_id is required');
        }

        // Vérifier que la période existe et est ouverte
        const { data: period, error: periodError } = await supabaseAdmin
          .from('erp_fiscal_periods')
          .select('*')
          .eq('id', period_id)
          .eq('org_id', orgId)
          .single();

        if (periodError || !period) {
          throw new AppError(ErrorType.NOT_FOUND, 'Period not found');
        }

        if (period.status === 'closed' || period.status === 'locked') {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'Period is already closed');
        }

        // Vérifier l'équilibre comptable
        const balanceCheck = await checkAccountingBalance(supabaseAdmin, orgId, period.period_end);
        if (!balanceCheck.balanced) {
          throw new AppError(
            ErrorType.VALIDATION_ERROR,
            `Accounting is not balanced. Difference: ${balanceCheck.difference.toFixed(2)}€`
          );
        }

        // Générer les écritures de clôture
        const closingResult = await generateClosingEntries(
          supabaseAdmin,
          orgId,
          period.id,
          period.period_start,
          period.period_end,
          user!.id
        );

        // Mettre à jour le statut de la période
        const { error: updateError } = await supabaseAdmin
          .from('erp_fiscal_periods')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: user!.id,
            closing_balance: closingResult.result,
          })
          .eq('id', period_id);

        if (updateError) {
          throw new AppError(ErrorType.DATABASE_ERROR, updateError.message);
        }

        return NextResponse.json({
          success: true,
          data: {
            period_id,
            closing_entries: closingResult.entries,
            result: closingResult.result,
          },
          message: 'Période clôturée avec succès',
        });
      }

      case 'create_opening_entries': {
        // Créer les écritures d'ouverture (À-Nouveaux)
        const { period_id, previous_period_id } = body;

        if (!period_id || !previous_period_id) {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'period_id and previous_period_id are required');
        }

        // Récupérer la période précédente
        const { data: prevPeriod } = await supabaseAdmin
          .from('erp_fiscal_periods')
          .select('*')
          .eq('id', previous_period_id)
          .eq('org_id', orgId)
          .single();

        if (!prevPeriod || prevPeriod.status !== 'closed') {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'Previous period must be closed');
        }

        // Récupérer la nouvelle période
        const { data: newPeriod } = await supabaseAdmin
          .from('erp_fiscal_periods')
          .select('*')
          .eq('id', period_id)
          .eq('org_id', orgId)
          .single();

        if (!newPeriod) {
          throw new AppError(ErrorType.NOT_FOUND, 'New period not found');
        }

        // Générer les écritures d'ouverture
        const openingResult = await generateOpeningEntries(
          supabaseAdmin,
          orgId,
          newPeriod.id,
          prevPeriod.period_end,
          newPeriod.period_start,
          user!.id
        );

        return NextResponse.json({
          success: true,
          data: openingResult,
          message: 'Écritures d\'ouverture créées',
        });
      }

      case 'lock_period': {
        // Verrouiller définitivement une période
        const { period_id } = body;

        const { error } = await supabaseAdmin
          .from('erp_fiscal_periods')
          .update({
            status: 'locked',
            locked_at: new Date().toISOString(),
            locked_by: user!.id,
          })
          .eq('id', period_id)
          .eq('org_id', orgId)
          .eq('status', 'closed');

        if (error) {
          throw new AppError(ErrorType.DATABASE_ERROR, error.message);
        }

        return NextResponse.json({
          success: true,
          message: 'Période verrouillée',
        });
      }

      default:
        throw new AppError(ErrorType.VALIDATION_ERROR, 'Invalid action');
    }

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/closing [POST]');
  }
}

/**
 * Vérifie l'équilibre comptable
 */
async function checkAccountingBalance(
  supabase: any,
  orgId: string,
  periodEnd: string
): Promise<{ balanced: boolean; totalDebit: number; totalCredit: number; difference: number }> {
  const { data: totals, error } = await supabase
    .from('erp_journal_lines')
    .select(`
      debit,
      credit,
      entry:erp_journal_entries!inner(org_id, entry_date, status)
    `)
    .eq('entry.org_id', orgId)
    .eq('entry.status', 'posted')
    .lte('entry.entry_date', periodEnd);

  if (error) {
    throw new AppError(ErrorType.DATABASE_ERROR, error.message);
  }

  const totalDebit = (totals || []).reduce((sum: number, t: any) => sum + (parseFloat(t.debit) || 0), 0);
  const totalCredit = (totals || []).reduce((sum: number, t: any) => sum + (parseFloat(t.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  return {
    balanced: difference < 0.01,
    totalDebit,
    totalCredit,
    difference,
  };
}

/**
 * Génère les écritures de clôture
 */
async function generateClosingEntries(
  supabase: any,
  orgId: string,
  periodId: string,
  periodStart: string,
  periodEnd: string,
  userId: string
): Promise<{ entries: any[]; result: number }> {
  // Calculer les soldes des comptes de charges et produits
  const { data: lines } = await supabase
    .from('erp_journal_lines')
    .select(`
      account_code,
      debit,
      credit,
      entry:erp_journal_entries!inner(org_id, entry_date, status)
    `)
    .eq('entry.org_id', orgId)
    .eq('entry.status', 'posted')
    .gte('entry.entry_date', periodStart)
    .lte('entry.entry_date', periodEnd);

  // Agréger par compte
  const balances: Record<string, { debit: number; credit: number }> = {};
  for (const line of lines || []) {
    const code = line.account_code;
    if (!code.startsWith('6') && !code.startsWith('7')) continue;

    if (!balances[code]) {
      balances[code] = { debit: 0, credit: 0 };
    }
    balances[code].debit += parseFloat(line.debit) || 0;
    balances[code].credit += parseFloat(line.credit) || 0;
  }

  // Calculer le résultat
  let totalCharges = 0;
  let totalProduits = 0;

  Object.entries(balances).forEach(([code, b]) => {
    if (code.startsWith('6')) {
      totalCharges += b.debit - b.credit;
    } else if (code.startsWith('7')) {
      totalProduits += b.credit - b.debit;
    }
  });

  const resultat = totalProduits - totalCharges;
  const isBenefice = resultat >= 0;

  // Récupérer le journal OD
  const { data: journal } = await supabase
    .from('erp_accounting_journals')
    .select('id')
    .eq('org_id', orgId)
    .eq('code', 'OD')
    .single();

  if (!journal) {
    throw new AppError(ErrorType.NOT_FOUND, 'Journal OD not found');
  }

  const closingEntries: any[] = [];

  // Créer l'écriture de virement des charges et produits au résultat
  const entryLines: any[] = [];

  // Solder les comptes de charges (classe 6)
  Object.entries(balances).forEach(([code, b]) => {
    if (code.startsWith('6')) {
      const solde = b.debit - b.credit;
      if (Math.abs(solde) > 0.01) {
        entryLines.push({
          account_code: code,
          debit: 0,
          credit: solde,
          description: `Clôture compte ${code}`,
        });
      }
    }
  });

  // Solder les comptes de produits (classe 7)
  Object.entries(balances).forEach(([code, b]) => {
    if (code.startsWith('7')) {
      const solde = b.credit - b.debit;
      if (Math.abs(solde) > 0.01) {
        entryLines.push({
          account_code: code,
          debit: solde,
          credit: 0,
          description: `Clôture compte ${code}`,
        });
      }
    }
  });

  // Contrepartie au compte de résultat
  if (Math.abs(resultat) > 0.01) {
    const compteResultat = isBenefice ? '120' : '129';
    entryLines.push({
      account_code: compteResultat,
      debit: isBenefice ? 0 : Math.abs(resultat),
      credit: isBenefice ? resultat : 0,
      description: isBenefice ? 'Bénéfice de l\'exercice' : 'Perte de l\'exercice',
    });
  }

  // Créer l'écriture de clôture
  if (entryLines.length > 0) {
    const { data: entry, error: entryError } = await supabase
      .from('erp_journal_entries')
      .insert({
        org_id: orgId,
        journal_id: journal.id,
        entry_date: periodEnd,
        reference: `CLOTURE-${periodEnd.substring(0, 4)}`,
        description: `Écritures de clôture exercice ${periodEnd.substring(0, 4)}`,
        status: 'posted',
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        total_debit: entryLines.reduce((s, l) => s + l.debit, 0),
        total_credit: entryLines.reduce((s, l) => s + l.credit, 0),
        source_type: 'closing',
      })
      .select()
      .single();

    if (entryError) {
      throw new AppError(ErrorType.DATABASE_ERROR, entryError.message);
    }

    // Créer les lignes
    const linesToInsert = entryLines.map((l, idx) => ({
      entry_id: entry.id,
      account_code: l.account_code,
      debit: l.debit,
      credit: l.credit,
      description: l.description,
      line_order: idx,
    }));

    await supabase.from('erp_journal_lines').insert(linesToInsert);

    closingEntries.push(entry);

    // Enregistrer dans la table des écritures de clôture
    await supabase.from('erp_closing_entries').insert({
      org_id: orgId,
      fiscal_period_id: periodId,
      closing_type: 'income_expense',
      journal_entry_id: entry.id,
      total_amount: resultat,
      description: 'Virement des charges et produits au résultat',
      created_by: userId,
    });
  }

  return {
    entries: closingEntries,
    result: resultat,
  };
}

/**
 * Génère les écritures d'ouverture (À-Nouveaux)
 */
async function generateOpeningEntries(
  supabase: any,
  orgId: string,
  periodId: string,
  previousPeriodEnd: string,
  newPeriodStart: string,
  userId: string
): Promise<{ entry: any; lines_count: number }> {
  // Récupérer les soldes des comptes de bilan (classes 1 à 5)
  const { data: lines } = await supabase
    .from('erp_journal_lines')
    .select(`
      account_code,
      debit,
      credit,
      entry:erp_journal_entries!inner(org_id, entry_date, status)
    `)
    .eq('entry.org_id', orgId)
    .eq('entry.status', 'posted')
    .lte('entry.entry_date', previousPeriodEnd);

  // Agréger par compte (uniquement classes 1-5)
  const balances: Record<string, number> = {};
  for (const line of lines || []) {
    const code = line.account_code;
    const classe = code.charAt(0);
    if (!['1', '2', '3', '4', '5'].includes(classe)) continue;

    if (!balances[code]) {
      balances[code] = 0;
    }
    balances[code] += (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
  }

  // Récupérer le journal AN (À-Nouveaux)
  let { data: journal } = await supabase
    .from('erp_accounting_journals')
    .select('id')
    .eq('org_id', orgId)
    .eq('code', 'AN')
    .single();

  // Créer le journal AN s'il n'existe pas
  if (!journal) {
    const { data: newJournal } = await supabase
      .from('erp_accounting_journals')
      .insert({
        org_id: orgId,
        code: 'AN',
        name: 'À-Nouveaux',
        journal_type: 'general',
        is_active: true,
      })
      .select()
      .single();
    journal = newJournal;
  }

  // Créer les lignes d'ouverture
  const entryLines: any[] = [];

  Object.entries(balances).forEach(([code, solde]) => {
    if (Math.abs(solde) > 0.01) {
      entryLines.push({
        account_code: code,
        debit: solde > 0 ? solde : 0,
        credit: solde < 0 ? Math.abs(solde) : 0,
        description: `Report à nouveau ${code}`,
      });
    }
  });

  if (entryLines.length === 0) {
    return { entry: null, lines_count: 0 };
  }

  // Créer l'écriture d'ouverture
  const { data: entry, error: entryError } = await supabase
    .from('erp_journal_entries')
    .insert({
      org_id: orgId,
      journal_id: journal.id,
      entry_date: newPeriodStart,
      reference: `AN-${newPeriodStart.substring(0, 4)}`,
      description: `Écritures d'ouverture exercice ${newPeriodStart.substring(0, 4)}`,
      status: 'posted',
      posted_at: new Date().toISOString(),
      posted_by: userId,
      created_by: userId,
      total_debit: entryLines.reduce((s, l) => s + l.debit, 0),
      total_credit: entryLines.reduce((s, l) => s + l.credit, 0),
      source_type: 'opening',
    })
    .select()
    .single();

  if (entryError) {
    throw new AppError(ErrorType.DATABASE_ERROR, entryError.message);
  }

  // Créer les lignes
  const linesToInsert = entryLines.map((l, idx) => ({
    entry_id: entry.id,
    account_code: l.account_code,
    debit: l.debit,
    credit: l.credit,
    description: l.description,
    line_order: idx,
  }));

  await supabase.from('erp_journal_lines').insert(linesToInsert);

  // Enregistrer dans la table des écritures de clôture
  await supabase.from('erp_closing_entries').insert({
    org_id: orgId,
    fiscal_period_id: periodId,
    closing_type: 'opening',
    journal_entry_id: entry.id,
    total_amount: entryLines.reduce((s, l) => s + l.debit, 0),
    description: 'Écritures d\'ouverture - À-Nouveaux',
    created_by: userId,
  });

  return {
    entry,
    lines_count: entryLines.length,
  };
}
