import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';

/**
 * GET /api/erp/reports
 * États financiers : Bilan, Compte de Résultat, Grand Livre, Balance
 *
 * Query params:
 * - type: 'balance_sheet' | 'income_statement' | 'general_ledger' | 'trial_balance' | 'vat_statement'
 * - period_start: Date de début (YYYY-MM-DD)
 * - period_end: Date de fin (YYYY-MM-DD)
 * - account_code: Code compte (pour grand livre)
 * - format: 'json' | 'summary'
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
    const reportType = searchParams.get('type') || 'trial_balance';
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end') || new Date().toISOString().split('T')[0];
    const accountCode = searchParams.get('account_code');

    let result: any;

    switch (reportType) {
      case 'balance_sheet':
        result = await generateBalanceSheet(supabaseAdmin, orgId, periodEnd);
        break;

      case 'income_statement':
        result = await generateIncomeStatement(supabaseAdmin, orgId, periodStart, periodEnd);
        break;

      case 'general_ledger':
        if (!accountCode) {
          throw new AppError(ErrorType.VALIDATION_ERROR, 'account_code is required for general_ledger');
        }
        result = await generateGeneralLedger(supabaseAdmin, orgId, accountCode, periodStart, periodEnd);
        break;

      case 'trial_balance':
        result = await generateTrialBalance(supabaseAdmin, orgId, periodEnd);
        break;

      case 'vat_statement':
        result = await generateVATStatement(supabaseAdmin, orgId, periodStart, periodEnd);
        break;

      default:
        throw new AppError(ErrorType.VALIDATION_ERROR, 'Invalid report type');
    }

    return NextResponse.json({
      success: true,
      data: {
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        generated_at: new Date().toISOString(),
        ...result,
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/reports [GET]');
  }
}

/**
 * Génère le Bilan (Balance Sheet)
 * Actif = Passif + Capitaux Propres
 */
async function generateBalanceSheet(supabase: any, orgId: string, periodEnd: string) {
  // Récupérer tous les soldes de comptes
  const { data: entries, error } = await supabase
    .from('erp_journal_lines')
    .select(`
      account_code,
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

  // Calculer les soldes par compte
  const balances: Record<string, { code: string; debit: number; credit: number; balance: number }> = {};

  for (const entry of entries || []) {
    const code = entry.account_code;
    if (!balances[code]) {
      balances[code] = { code, debit: 0, credit: 0, balance: 0 };
    }
    balances[code].debit += parseFloat(entry.debit) || 0;
    balances[code].credit += parseFloat(entry.credit) || 0;
  }

  // Calculer les balances
  Object.values(balances).forEach((b) => {
    b.balance = b.debit - b.credit;
  });

  // Récupérer les libellés des comptes
  const { data: accounts } = await supabase
    .from('erp_chart_of_accounts')
    .select('code, label, account_type, category')
    .eq('org_id', orgId);

  const accountMap = new Map(accounts?.map((a: any) => [a.code, a]) || []);

  // Classer par section du bilan
  const actifImmobilise: any[] = [];
  const actifCirculant: any[] = [];
  const tresorerie: any[] = [];
  const capitauxPropres: any[] = [];
  const provisions: any[] = [];
  const dettes: any[] = [];

  Object.values(balances).forEach((b) => {
    const account = accountMap.get(b.code) as any;
    const classe = b.code.charAt(0);
    const item = {
      code: b.code,
      label: account?.label || b.code,
      balance: b.balance,
    };

    switch (classe) {
      case '2': // Immobilisations
        if (b.code.startsWith('28') || b.code.startsWith('29')) {
          item.balance = -b.balance; // Amortissements sont négatifs
        }
        actifImmobilise.push(item);
        break;
      case '3': // Stocks
      case '4': // Tiers (certains)
        if (b.code.startsWith('41') || b.code.startsWith('42') || b.code.startsWith('44') || b.code.startsWith('46') || b.code.startsWith('48')) {
          if (b.balance > 0) actifCirculant.push(item);
          else dettes.push({ ...item, balance: -b.balance });
        } else if (b.code.startsWith('40')) {
          dettes.push({ ...item, balance: -b.balance });
        } else {
          actifCirculant.push(item);
        }
        break;
      case '5': // Trésorerie
        if (b.code.startsWith('51') || b.code.startsWith('53')) {
          tresorerie.push(item);
        }
        break;
      case '1': // Capitaux
        if (b.code.startsWith('15')) {
          provisions.push({ ...item, balance: -b.balance });
        } else if (b.code.startsWith('16') || b.code.startsWith('17')) {
          dettes.push({ ...item, balance: -b.balance });
        } else {
          capitauxPropres.push({ ...item, balance: -b.balance });
        }
        break;
    }
  });

  // Calcul du résultat (Classe 7 - Classe 6)
  let produits = 0;
  let charges = 0;
  Object.values(balances).forEach((b) => {
    if (b.code.startsWith('7')) produits += b.credit - b.debit;
    if (b.code.startsWith('6')) charges += b.debit - b.credit;
  });
  const resultat = produits - charges;

  // Ajouter le résultat aux capitaux propres
  if (resultat !== 0) {
    capitauxPropres.push({
      code: resultat > 0 ? '120' : '129',
      label: resultat > 0 ? 'Résultat de l\'exercice (bénéfice)' : 'Résultat de l\'exercice (perte)',
      balance: resultat,
    });
  }

  // Totaux
  const totalActifImmobilise = actifImmobilise.reduce((s, a) => s + a.balance, 0);
  const totalActifCirculant = actifCirculant.reduce((s, a) => s + a.balance, 0);
  const totalTresorerie = tresorerie.reduce((s, a) => s + a.balance, 0);
  const totalActif = totalActifImmobilise + totalActifCirculant + totalTresorerie;

  const totalCapitauxPropres = capitauxPropres.reduce((s, a) => s + a.balance, 0);
  const totalProvisions = provisions.reduce((s, a) => s + a.balance, 0);
  const totalDettes = dettes.reduce((s, a) => s + a.balance, 0);
  const totalPassif = totalCapitauxPropres + totalProvisions + totalDettes;

  return {
    actif: {
      actif_immobilise: {
        items: actifImmobilise,
        total: totalActifImmobilise,
      },
      actif_circulant: {
        items: actifCirculant,
        total: totalActifCirculant,
      },
      tresorerie: {
        items: tresorerie,
        total: totalTresorerie,
      },
      total_actif: totalActif,
    },
    passif: {
      capitaux_propres: {
        items: capitauxPropres,
        total: totalCapitauxPropres,
      },
      provisions: {
        items: provisions,
        total: totalProvisions,
      },
      dettes: {
        items: dettes,
        total: totalDettes,
      },
      total_passif: totalPassif,
    },
    equilibre: Math.abs(totalActif - totalPassif) < 0.01,
    ecart: totalActif - totalPassif,
  };
}

/**
 * Génère le Compte de Résultat (Income Statement / P&L)
 */
async function generateIncomeStatement(
  supabase: any,
  orgId: string,
  periodStart: string | null,
  periodEnd: string
) {
  // Récupérer les mouvements des comptes 6 et 7
  let query = supabase
    .from('erp_journal_lines')
    .select(`
      account_code,
      debit,
      credit,
      entry:erp_journal_entries!inner(org_id, entry_date, status)
    `)
    .eq('entry.org_id', orgId)
    .eq('entry.status', 'posted')
    .lte('entry.entry_date', periodEnd);

  if (periodStart) {
    query = query.gte('entry.entry_date', periodStart);
  }

  const { data: entries, error } = await query;

  if (error) {
    throw new AppError(ErrorType.DATABASE_ERROR, error.message);
  }

  // Calculer les soldes par compte
  const balances: Record<string, { code: string; debit: number; credit: number }> = {};

  for (const entry of entries || []) {
    const code = entry.account_code;
    if (!code.startsWith('6') && !code.startsWith('7')) continue;

    if (!balances[code]) {
      balances[code] = { code, debit: 0, credit: 0 };
    }
    balances[code].debit += parseFloat(entry.debit) || 0;
    balances[code].credit += parseFloat(entry.credit) || 0;
  }

  // Récupérer les libellés
  const { data: accounts } = await supabase
    .from('erp_chart_of_accounts')
    .select('code, label, category')
    .eq('org_id', orgId);

  const accountMap = new Map(accounts?.map((a: any) => [a.code, a]) || []);

  // Catégoriser
  const produitsExploitation: any[] = [];
  const chargesExploitation: any[] = [];
  const produitsFinanciers: any[] = [];
  const chargesFinancieres: any[] = [];
  const produitsExceptionnels: any[] = [];
  const chargesExceptionnelles: any[] = [];
  const impots: any[] = [];

  Object.values(balances).forEach((b) => {
    const account = accountMap.get(b.code) as any;
    const montant = b.code.startsWith('7') ? b.credit - b.debit : b.debit - b.credit;

    const item = {
      code: b.code,
      label: account?.label || b.code,
      montant,
    };

    // Classe 7 - Produits
    if (b.code.startsWith('70') || b.code.startsWith('71') || b.code.startsWith('72') ||
        b.code.startsWith('74') || b.code.startsWith('75') || b.code.startsWith('78') || b.code.startsWith('79')) {
      if (b.code.startsWith('76')) {
        produitsFinanciers.push(item);
      } else if (b.code.startsWith('77')) {
        produitsExceptionnels.push(item);
      } else {
        produitsExploitation.push(item);
      }
    }

    // Classe 6 - Charges
    if (b.code.startsWith('6')) {
      if (b.code.startsWith('66')) {
        chargesFinancieres.push(item);
      } else if (b.code.startsWith('67')) {
        chargesExceptionnelles.push(item);
      } else if (b.code.startsWith('69')) {
        impots.push(item);
      } else {
        chargesExploitation.push(item);
      }
    }
  });

  // Calculs
  const totalProduitsExploitation = produitsExploitation.reduce((s, p) => s + p.montant, 0);
  const totalChargesExploitation = chargesExploitation.reduce((s, c) => s + c.montant, 0);
  const resultatExploitation = totalProduitsExploitation - totalChargesExploitation;

  const totalProduitsFinanciers = produitsFinanciers.reduce((s, p) => s + p.montant, 0);
  const totalChargesFinancieres = chargesFinancieres.reduce((s, c) => s + c.montant, 0);
  const resultatFinancier = totalProduitsFinanciers - totalChargesFinancieres;

  const resultatCourant = resultatExploitation + resultatFinancier;

  const totalProduitsExceptionnels = produitsExceptionnels.reduce((s, p) => s + p.montant, 0);
  const totalChargesExceptionnelles = chargesExceptionnelles.reduce((s, c) => s + c.montant, 0);
  const resultatExceptionnel = totalProduitsExceptionnels - totalChargesExceptionnelles;

  const totalImpots = impots.reduce((s, i) => s + i.montant, 0);
  const resultatNet = resultatCourant + resultatExceptionnel - totalImpots;

  return {
    exploitation: {
      produits: {
        items: produitsExploitation,
        total: totalProduitsExploitation,
      },
      charges: {
        items: chargesExploitation,
        total: totalChargesExploitation,
      },
      resultat: resultatExploitation,
    },
    financier: {
      produits: {
        items: produitsFinanciers,
        total: totalProduitsFinanciers,
      },
      charges: {
        items: chargesFinancieres,
        total: totalChargesFinancieres,
      },
      resultat: resultatFinancier,
    },
    resultat_courant: resultatCourant,
    exceptionnel: {
      produits: {
        items: produitsExceptionnels,
        total: totalProduitsExceptionnels,
      },
      charges: {
        items: chargesExceptionnelles,
        total: totalChargesExceptionnelles,
      },
      resultat: resultatExceptionnel,
    },
    impots: {
      items: impots,
      total: totalImpots,
    },
    resultat_net: resultatNet,
  };
}

/**
 * Génère le Grand Livre pour un compte
 */
async function generateGeneralLedger(
  supabase: any,
  orgId: string,
  accountCode: string,
  periodStart: string | null,
  periodEnd: string
) {
  let query = supabase
    .from('erp_journal_lines')
    .select(`
      id,
      account_code,
      debit,
      credit,
      description,
      line_order,
      entry:erp_journal_entries!inner(
        id,
        org_id,
        entry_number,
        entry_date,
        reference,
        description,
        status,
        journal:erp_accounting_journals(code, name)
      )
    `)
    .eq('entry.org_id', orgId)
    .eq('entry.status', 'posted')
    .like('account_code', `${accountCode}%`)
    .lte('entry.entry_date', periodEnd)
    .order('entry.entry_date', { ascending: true });

  if (periodStart) {
    query = query.gte('entry.entry_date', periodStart);
  }

  const { data: lines, error } = await query;

  if (error) {
    throw new AppError(ErrorType.DATABASE_ERROR, error.message);
  }

  // Récupérer le compte
  const { data: account } = await supabase
    .from('erp_chart_of_accounts')
    .select('code, label, account_type')
    .eq('org_id', orgId)
    .eq('code', accountCode)
    .single();

  // Calculer le solde progressif
  let soldeProgressif = 0;
  const entries = (lines || []).map((line: any) => {
    const debit = parseFloat(line.debit) || 0;
    const credit = parseFloat(line.credit) || 0;
    soldeProgressif += debit - credit;

    return {
      date: line.entry.entry_date,
      entry_number: line.entry.entry_number,
      journal: line.entry.journal?.code || '-',
      reference: line.entry.reference,
      description: line.description || line.entry.description,
      debit,
      credit,
      solde: soldeProgressif,
    };
  });

  const totalDebit = entries.reduce((s: number, e: any) => s + e.debit, 0);
  const totalCredit = entries.reduce((s: number, e: any) => s + e.credit, 0);

  return {
    account: {
      code: accountCode,
      label: account?.label || accountCode,
      type: account?.account_type,
    },
    entries,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      solde: totalDebit - totalCredit,
    },
    count: entries.length,
  };
}

/**
 * Génère la Balance Générale (Trial Balance)
 */
async function generateTrialBalance(supabase: any, orgId: string, periodEnd: string) {
  // Récupérer tous les mouvements
  const { data: entries, error } = await supabase
    .from('erp_journal_lines')
    .select(`
      account_code,
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

  // Agréger par compte
  const balances: Record<string, { debit: number; credit: number }> = {};

  for (const entry of entries || []) {
    const code = entry.account_code;
    if (!balances[code]) {
      balances[code] = { debit: 0, credit: 0 };
    }
    balances[code].debit += parseFloat(entry.debit) || 0;
    balances[code].credit += parseFloat(entry.credit) || 0;
  }

  // Récupérer les comptes
  const { data: accounts } = await supabase
    .from('erp_chart_of_accounts')
    .select('code, label, account_type')
    .eq('org_id', orgId);

  const accountMap = new Map(accounts?.map((a: any) => [a.code, a]) || []);

  // Construire la balance
  const balance = Object.entries(balances)
    .map(([code, b]) => {
      const account = accountMap.get(code) as any;
      const soldeDebiteur = b.debit > b.credit ? b.debit - b.credit : 0;
      const soldeCrediteur = b.credit > b.debit ? b.credit - b.debit : 0;

      return {
        code,
        label: account?.label || code,
        type: account?.account_type,
        mouvement_debit: b.debit,
        mouvement_credit: b.credit,
        solde_debiteur: soldeDebiteur,
        solde_crediteur: soldeCrediteur,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  // Totaux
  const totals = balance.reduce(
    (acc, b) => ({
      mouvement_debit: acc.mouvement_debit + b.mouvement_debit,
      mouvement_credit: acc.mouvement_credit + b.mouvement_credit,
      solde_debiteur: acc.solde_debiteur + b.solde_debiteur,
      solde_crediteur: acc.solde_crediteur + b.solde_crediteur,
    }),
    { mouvement_debit: 0, mouvement_credit: 0, solde_debiteur: 0, solde_crediteur: 0 }
  );

  return {
    balance,
    totals,
    equilibre: Math.abs(totals.mouvement_debit - totals.mouvement_credit) < 0.01 &&
               Math.abs(totals.solde_debiteur - totals.solde_crediteur) < 0.01,
    count: balance.length,
  };
}

/**
 * Génère la Déclaration de TVA
 */
async function generateVATStatement(
  supabase: any,
  orgId: string,
  periodStart: string | null,
  periodEnd: string
) {
  // Comptes TVA
  const tvaCollecteePrefix = '4457'; // TVA collectée
  const tvaDeductiblePrefix = '4456'; // TVA déductible

  let query = supabase
    .from('erp_journal_lines')
    .select(`
      account_code,
      debit,
      credit,
      entry:erp_journal_entries!inner(org_id, entry_date, status)
    `)
    .eq('entry.org_id', orgId)
    .eq('entry.status', 'posted')
    .lte('entry.entry_date', periodEnd);

  if (periodStart) {
    query = query.gte('entry.entry_date', periodStart);
  }

  const { data: entries, error } = await query;

  if (error) {
    throw new AppError(ErrorType.DATABASE_ERROR, error.message);
  }

  // Calculer les TVA
  let tvaCollectee = 0;
  let tvaDeductibleImmo = 0;
  let tvaDeductibleAutres = 0;
  const detailCollectee: any[] = [];
  const detailDeductible: any[] = [];

  for (const entry of entries || []) {
    const code = entry.account_code;
    const credit = parseFloat(entry.credit) || 0;
    const debit = parseFloat(entry.debit) || 0;

    if (code.startsWith(tvaCollecteePrefix)) {
      const montant = credit - debit;
      tvaCollectee += montant;
      detailCollectee.push({ code, montant });
    }

    if (code.startsWith(tvaDeductiblePrefix)) {
      const montant = debit - credit;
      if (code.startsWith('44562')) {
        tvaDeductibleImmo += montant;
      } else {
        tvaDeductibleAutres += montant;
      }
      detailDeductible.push({ code, montant });
    }
  }

  const tvaDeductibleTotal = tvaDeductibleImmo + tvaDeductibleAutres;
  const tvaAPayer = tvaCollectee - tvaDeductibleTotal;

  return {
    tva_collectee: {
      total: tvaCollectee,
      detail: detailCollectee,
    },
    tva_deductible: {
      immobilisations: tvaDeductibleImmo,
      autres_biens_services: tvaDeductibleAutres,
      total: tvaDeductibleTotal,
      detail: detailDeductible,
    },
    tva_a_payer: tvaAPayer > 0 ? tvaAPayer : 0,
    credit_tva: tvaAPayer < 0 ? -tvaAPayer : 0,
    solde: tvaAPayer,
  };
}
