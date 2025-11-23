/**
 * Moteur de Réconciliation Bancaire et Lettrage
 * Architecture 3 niveaux : Déterministe + Scoring + IA
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  BankTransaction,
  MatchCandidate,
  ReconciliationResult,
  ReconciliationRule,
  MatchConditions,
  ScoreWeights,
  AIExtractionResult,
  ReconciliationStats,
} from './types';

export class ReconciliationEngine {
  private supabase: SupabaseClient;
  private orgId: string;
  private rules: ReconciliationRule[] = [];

  constructor(supabase: SupabaseClient, orgId: string) {
    this.supabase = supabase;
    this.orgId = orgId;
  }

  /**
   * Charge les règles de réconciliation de l'organisation
   */
  async loadRules(): Promise<void> {
    const { data, error } = await this.supabase
      .from('erp_reconciliation_rules')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error loading reconciliation rules:', error);
      this.rules = [];
      return;
    }

    this.rules = data || [];
  }

  /**
   * Point d'entrée principal : réconcilie une transaction bancaire
   */
  async reconcileTransaction(transaction: BankTransaction): Promise<ReconciliationResult> {
    if (this.rules.length === 0) {
      await this.loadRules();
    }

    const candidates: MatchCandidate[] = [];

    // Chercher les candidats potentiels
    const potentialMatches = await this.findPotentialMatches(transaction);

    if (potentialMatches.length === 0) {
      return {
        success: true,
        transaction_id: transaction.id,
        matches: [],
        auto_matched: false,
      };
    }

    // Niveau 1: Règles déterministes
    const level1Rules = this.rules.filter(r => r.match_level === 1);
    for (const rule of level1Rules) {
      const matches = await this.applyDeterministicRule(transaction, potentialMatches, rule);
      candidates.push(...matches);
    }

    // Si pas de match niveau 1, passer au niveau 2
    if (candidates.length === 0) {
      // Niveau 2: Scoring algorithmique
      const level2Rules = this.rules.filter(r => r.match_level === 2);
      for (const rule of level2Rules) {
        const matches = await this.applyScoringRule(transaction, potentialMatches, rule);
        candidates.push(...matches);
      }
    }

    // Trier par score décroissant et dédupliquer
    const uniqueCandidates = this.deduplicateCandidates(candidates);
    uniqueCandidates.sort((a, b) => b.score - a.score);

    // Déterminer si auto-match
    const bestMatch = uniqueCandidates[0];
    const autoMatched = bestMatch && bestMatch.score >= 0.9;

    // Créer le match si auto-match
    let matchId: string | undefined;
    if (autoMatched && bestMatch) {
      matchId = await this.createMatch(transaction, bestMatch, true);
    }

    return {
      success: true,
      transaction_id: transaction.id,
      matches: uniqueCandidates.slice(0, 5), // Top 5
      best_match: bestMatch,
      auto_matched: autoMatched,
      match_id: matchId,
    };
  }

  /**
   * Trouve tous les candidats potentiels (factures, paiements, dépenses)
   */
  private async findPotentialMatches(transaction: BankTransaction): Promise<MatchCandidate[]> {
    const candidates: MatchCandidate[] = [];
    const isCredit = transaction.direction === 'credit';
    const dateWindow = 30; // jours
    const startDate = new Date(transaction.operation_date);
    startDate.setDate(startDate.getDate() - dateWindow);
    const endDate = new Date(transaction.operation_date);
    endDate.setDate(endDate.getDate() + 7); // Petite marge future

    if (isCredit) {
      // Crédit = encaissement = chercher factures clients ouvertes
      const { data: invoices } = await this.supabase
        .from('erp_invoices')
        .select(`
          id, invoice_number, total_ttc, balance_due, invoice_date, due_date,
          client:erp_clients(id, name, company_name, iban)
        `)
        .eq('org_id', this.orgId)
        .in('status', ['sent', 'validated', 'partial'])
        .gt('balance_due', 0)
        .gte('invoice_date', startDate.toISOString().split('T')[0])
        .lte('invoice_date', endDate.toISOString().split('T')[0]);

      for (const inv of invoices || []) {
        candidates.push({
          type: 'invoice',
          entity_id: inv.id,
          entity_ref: inv.invoice_number,
          amount: inv.total_ttc,
          date: inv.invoice_date,
          partner_id: inv.client?.id,
          partner_name: inv.client?.company_name || inv.client?.name,
          partner_iban: inv.client?.iban,
          open_amount: inv.balance_due,
          score: 0,
          match_reasons: [],
        });
      }
    } else {
      // Débit = décaissement = chercher factures fournisseurs ouvertes
      const { data: supplierInvoices } = await this.supabase
        .from('erp_supplier_invoices')
        .select(`
          id, invoice_number, total_ttc, balance_due, invoice_date, due_date,
          supplier:erp_suppliers(id, name, company_name, iban)
        `)
        .eq('org_id', this.orgId)
        .in('status', ['received', 'validated', 'approved', 'partial'])
        .gt('balance_due', 0);

      for (const inv of supplierInvoices || []) {
        candidates.push({
          type: 'supplier_invoice',
          entity_id: inv.id,
          entity_ref: inv.invoice_number,
          amount: inv.total_ttc,
          date: inv.invoice_date,
          partner_id: inv.supplier?.id,
          partner_name: inv.supplier?.company_name || inv.supplier?.name,
          partner_iban: inv.supplier?.iban,
          open_amount: inv.balance_due,
          score: 0,
          match_reasons: [],
        });
      }

      // Chercher aussi les dépenses non rapprochées
      const { data: expenses } = await this.supabase
        .from('erp_expenses')
        .select(`
          id, description, amount, expense_date, reference,
          supplier:erp_suppliers(id, name, company_name)
        `)
        .eq('org_id', this.orgId)
        .eq('status', 'validated')
        .gte('expense_date', startDate.toISOString().split('T')[0]);

      for (const exp of expenses || []) {
        candidates.push({
          type: 'expense',
          entity_id: exp.id,
          entity_ref: exp.reference || exp.description?.substring(0, 30),
          amount: exp.amount,
          date: exp.expense_date,
          partner_id: exp.supplier?.id,
          partner_name: exp.supplier?.company_name || exp.supplier?.name,
          score: 0,
          match_reasons: [],
        });
      }
    }

    return candidates;
  }

  /**
   * Niveau 1: Applique une règle déterministe
   */
  private async applyDeterministicRule(
    transaction: BankTransaction,
    candidates: MatchCandidate[],
    rule: ReconciliationRule
  ): Promise<MatchCandidate[]> {
    const conditions = rule.conditions as MatchConditions;
    const matches: MatchCandidate[] = [];

    for (const candidate of candidates) {
      const reasons: string[] = [];
      let isMatch = true;

      // Vérifier montant
      const amountTolerance = conditions.amount_tolerance || 0;
      const amountDiff = Math.abs(transaction.amount - (candidate.open_amount || candidate.amount));
      const amountRatio = amountDiff / transaction.amount;

      if (amountRatio > amountTolerance) {
        isMatch = false;
      } else if (amountRatio === 0) {
        reasons.push('Montant exact');
      } else {
        reasons.push(`Montant proche (${(amountRatio * 100).toFixed(1)}% d'écart)`);
      }

      // Vérifier IBAN si requis
      if (conditions.require_iban_match && isMatch) {
        if (transaction.counterparty_iban && candidate.partner_iban) {
          if (transaction.counterparty_iban === candidate.partner_iban) {
            reasons.push('IBAN correspondant');
          } else {
            isMatch = false;
          }
        } else if (conditions.require_iban_match) {
          isMatch = false; // IBAN requis mais non disponible
        }
      }

      // Vérifier référence facture dans libellé
      if (conditions.require_invoice_ref && isMatch) {
        const labelUpper = (transaction.label_raw || '').toUpperCase();
        const refUpper = (candidate.entity_ref || '').toUpperCase();
        if (labelUpper.includes(refUpper)) {
          reasons.push('Référence trouvée dans libellé');
        } else {
          isMatch = false;
        }
      }

      // Vérifier nom si requis
      if (conditions.require_name_match && isMatch) {
        const minSimilarity = conditions.name_similarity_min || 0.7;
        const similarity = this.calculateNameSimilarity(
          transaction.counterparty_name || transaction.label_raw,
          candidate.partner_name || ''
        );
        if (similarity >= minSimilarity) {
          reasons.push(`Nom correspondant (${(similarity * 100).toFixed(0)}%)`);
        } else {
          isMatch = false;
        }
      }

      // Vérifier fenêtre de dates
      if (conditions.date_window_days && isMatch) {
        const txDate = new Date(transaction.operation_date);
        const candDate = new Date(candidate.date);
        const daysDiff = Math.abs((txDate.getTime() - candDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > conditions.date_window_days) {
          isMatch = false;
        } else {
          reasons.push(`Date dans la fenêtre (${Math.round(daysDiff)} jours)`);
        }
      }

      if (isMatch && reasons.length > 0) {
        matches.push({
          ...candidate,
          score: 1.0, // Match déterministe = score parfait
          match_reasons: reasons,
        });
      }
    }

    return matches;
  }

  /**
   * Niveau 2: Applique une règle de scoring
   */
  private async applyScoringRule(
    transaction: BankTransaction,
    candidates: MatchCandidate[],
    rule: ReconciliationRule
  ): Promise<MatchCandidate[]> {
    const conditions = rule.conditions as MatchConditions;
    const weights = (rule.score_weights || {}) as ScoreWeights;
    const matches: MatchCandidate[] = [];

    for (const candidate of candidates) {
      let totalScore = 0;
      const reasons: string[] = [];

      // Score montant
      if (weights.exact_amount) {
        const amountTolerance = conditions.amount_tolerance || 0.05;
        const targetAmount = candidate.open_amount || candidate.amount;
        const amountDiff = Math.abs(transaction.amount - targetAmount);
        const amountRatio = amountDiff / transaction.amount;

        if (amountRatio === 0) {
          totalScore += weights.exact_amount;
          reasons.push('Montant exact');
        } else if (amountRatio <= amountTolerance) {
          const amountScore = (1 - amountRatio / amountTolerance) * weights.exact_amount;
          totalScore += amountScore;
          reasons.push(`Montant proche (${(amountRatio * 100).toFixed(1)}%)`);
        }
      }

      // Score proximité date
      if (weights.date_proximity) {
        const txDate = new Date(transaction.operation_date);
        const candDate = new Date(candidate.date);
        const daysDiff = Math.abs((txDate.getTime() - candDate.getTime()) / (1000 * 60 * 60 * 24));
        const maxDays = conditions.date_window_days || 30;

        if (daysDiff <= maxDays) {
          const dateScore = (1 - daysDiff / maxDays) * weights.date_proximity;
          totalScore += dateScore;
          reasons.push(`Proximité date (${Math.round(daysDiff)}j)`);
        }
      }

      // Score similarité nom
      if (weights.name_similarity) {
        const similarity = this.calculateNameSimilarity(
          transaction.counterparty_name || transaction.label_raw,
          candidate.partner_name || ''
        );
        if (similarity > 0.3) {
          totalScore += similarity * weights.name_similarity;
          reasons.push(`Nom similaire (${(similarity * 100).toFixed(0)}%)`);
        }
      }

      // Score IBAN
      if (weights.iban_match) {
        if (transaction.counterparty_iban && candidate.partner_iban &&
            transaction.counterparty_iban === candidate.partner_iban) {
          totalScore += weights.iban_match;
          reasons.push('IBAN correspondant');
        }
      }

      // Score référence facture trouvée
      if (weights.invoice_ref_found) {
        const labelUpper = (transaction.label_raw || '').toUpperCase();
        const refUpper = (candidate.entity_ref || '').toUpperCase();
        if (refUpper && labelUpper.includes(refUpper)) {
          totalScore += weights.invoice_ref_found;
          reasons.push('Référence dans libellé');
        }
      }

      // Ajouter si score suffisant
      if (totalScore >= rule.suggestion_threshold) {
        matches.push({
          ...candidate,
          score: Math.min(totalScore, 1),
          match_reasons: reasons,
        });
      }
    }

    return matches;
  }

  /**
   * Niveau 3: Extraction IA du libellé bancaire
   */
  async extractWithAI(transaction: BankTransaction): Promise<AIExtractionResult> {
    // Import dynamique pour éviter les erreurs si le module n'est pas disponible
    try {
      const { analyzeWithAI } = await import('../ai/analyze');

      const prompt = `Analyse ce libellé bancaire et extrais les informations structurées.
Libellé: "${transaction.label_raw}"
Montant: ${transaction.amount} ${transaction.currency}
Type: ${transaction.direction === 'credit' ? 'Encaissement' : 'Décaissement'}

Extrais au format JSON:
{
  "invoice_ref": "référence de facture si présente (FAC-XXXX, INV-XXXX, etc.)",
  "client_name": "nom du client si c'est un encaissement",
  "supplier_name": "nom du fournisseur si c'est un décaissement",
  "operation_type": "virement|prélèvement|carte|chèque|espèces|frais_bancaires|salaire|impot|autre",
  "confidence": 0.0-1.0
}

Réponds uniquement avec le JSON, sans explication.`;

      const response = await analyzeWithAI(prompt);

      try {
        const parsed = JSON.parse(response);
        return {
          invoice_ref: parsed.invoice_ref,
          client_name: parsed.client_name,
          supplier_name: parsed.supplier_name,
          operation_type: parsed.operation_type,
          confidence: parsed.confidence || 0.5,
          raw_analysis: response,
        };
      } catch {
        return { confidence: 0 };
      }
    } catch {
      // Si pas d'IA disponible, retourner résultat vide
      return { confidence: 0 };
    }
  }

  /**
   * Crée un match dans la base de données
   */
  async createMatch(
    transaction: BankTransaction,
    candidate: MatchCandidate,
    isAuto: boolean
  ): Promise<string | undefined> {
    const matchType = candidate.type === 'invoice' ? 'customer_invoice' :
                      candidate.type === 'supplier_invoice' ? 'supplier_invoice' :
                      candidate.type === 'expense' ? 'expense' : 'other';

    const matchData: Record<string, any> = {
      org_id: this.orgId,
      bank_transaction_id: transaction.id,
      match_type: matchType,
      matched_amount: candidate.open_amount || candidate.amount,
      remaining_amount: Math.max(0, transaction.amount - (candidate.open_amount || candidate.amount)),
      confidence_score: candidate.score,
      is_auto_match: isAuto,
      status: isAuto ? 'accepted' : 'suggested',
      match_rule: candidate.match_reasons.join(', '),
    };

    // Lier à l'entité appropriée
    if (candidate.type === 'invoice') {
      matchData.matched_invoice_id = candidate.entity_id;
    } else if (candidate.type === 'supplier_invoice') {
      matchData.matched_supplier_invoice_id = candidate.entity_id;
    } else if (candidate.type === 'expense') {
      matchData.matched_expense_id = candidate.entity_id;
    }

    const { data, error } = await this.supabase
      .from('erp_reconciliation_matches')
      .insert(matchData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating match:', error);
      return undefined;
    }

    // Mettre à jour le statut de la transaction
    await this.supabase
      .from('erp_bank_transactions')
      .update({
        reconciliation_status: isAuto ? 'matched' : 'suggested',
        reconciliation_score: candidate.score,
      })
      .eq('id', transaction.id);

    return data?.id;
  }

  /**
   * Valide un match suggéré
   */
  async acceptMatch(matchId: string, userId: string): Promise<boolean> {
    const { data: match, error: fetchError } = await this.supabase
      .from('erp_reconciliation_matches')
      .select('*, bank_transaction:erp_bank_transactions(*)')
      .eq('id', matchId)
      .single();

    if (fetchError || !match) {
      return false;
    }

    // Mettre à jour le match
    const { error: updateError } = await this.supabase
      .from('erp_reconciliation_matches')
      .update({
        status: 'accepted',
        validated_by: userId,
        validated_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (updateError) {
      return false;
    }

    // Mettre à jour la transaction
    await this.supabase
      .from('erp_bank_transactions')
      .update({ reconciliation_status: 'matched' })
      .eq('id', match.bank_transaction_id);

    // Mettre à jour la facture/paiement si applicable
    if (match.matched_invoice_id) {
      // Créer le paiement et mettre à jour la facture
      await this.createPaymentFromMatch(match);
    }

    return true;
  }

  /**
   * Rejette un match suggéré
   */
  async rejectMatch(matchId: string, userId: string, reason?: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('erp_reconciliation_matches')
      .update({
        status: 'rejected',
        validated_by: userId,
        validated_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', matchId);

    return !error;
  }

  /**
   * Crée un paiement à partir d'un match validé
   */
  private async createPaymentFromMatch(match: any): Promise<void> {
    // Créer le paiement dans erp_payments ou erp_supplier_payments
    if (match.match_type === 'customer_invoice') {
      await this.supabase
        .from('erp_payments')
        .insert({
          org_id: this.orgId,
          invoice_id: match.matched_invoice_id,
          amount: match.matched_amount,
          payment_date: match.bank_transaction?.operation_date,
          payment_method: 'bank_transfer',
          reference: match.bank_transaction?.bank_reference,
        });

      // Mettre à jour la facture
      const { data: invoice } = await this.supabase
        .from('erp_invoices')
        .select('paid_amount, total_ttc')
        .eq('id', match.matched_invoice_id)
        .single();

      if (invoice) {
        const newPaid = (invoice.paid_amount || 0) + match.matched_amount;
        const newStatus = newPaid >= invoice.total_ttc ? 'paid' : 'partial';
        await this.supabase
          .from('erp_invoices')
          .update({
            paid_amount: newPaid,
            balance_due: Math.max(0, invoice.total_ttc - newPaid),
            status: newStatus,
          })
          .eq('id', match.matched_invoice_id);
      }
    }
  }

  /**
   * Calcule la similarité entre deux noms
   */
  private calculateNameSimilarity(name1: string | null, name2: string | null): number {
    if (!name1 || !name2) return 0;

    const clean1 = name1.toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim();
    const clean2 = name2.toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim();

    if (clean1 === clean2) return 1;

    const words1 = clean1.split(/\s+/).filter(w => w.length > 2);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    let matches = 0;
    for (const word of words1) {
      if (words2.some(w => w.includes(word) || word.includes(w))) {
        matches++;
      }
    }

    return matches / Math.max(words1.length, words2.length);
  }

  /**
   * Déduplique les candidats par entity_id
   */
  private deduplicateCandidates(candidates: MatchCandidate[]): MatchCandidate[] {
    const seen = new Map<string, MatchCandidate>();
    for (const c of candidates) {
      const key = `${c.type}:${c.entity_id}`;
      const existing = seen.get(key);
      if (!existing || c.score > existing.score) {
        seen.set(key, c);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Obtient les statistiques de réconciliation
   */
  async getStats(): Promise<ReconciliationStats> {
    const { data, error } = await this.supabase
      .from('erp_bank_transactions')
      .select('reconciliation_status, amount, direction')
      .eq('org_id', this.orgId);

    if (error || !data) {
      return {
        total_transactions: 0,
        unmatched: 0,
        suggested: 0,
        matched: 0,
        suspicious: 0,
        ignored: 0,
        auto_match_rate: 0,
        total_amount_matched: 0,
        total_amount_unmatched: 0,
      };
    }

    const stats = {
      total_transactions: data.length,
      unmatched: 0,
      suggested: 0,
      matched: 0,
      suspicious: 0,
      ignored: 0,
      total_amount_matched: 0,
      total_amount_unmatched: 0,
    };

    for (const tx of data) {
      const amount = Math.abs(tx.amount);
      switch (tx.reconciliation_status) {
        case 'unmatched':
          stats.unmatched++;
          stats.total_amount_unmatched += amount;
          break;
        case 'suggested':
          stats.suggested++;
          break;
        case 'matched':
          stats.matched++;
          stats.total_amount_matched += amount;
          break;
        case 'suspicious':
          stats.suspicious++;
          break;
        case 'ignored':
          stats.ignored++;
          break;
      }
    }

    stats.auto_match_rate = stats.total_transactions > 0
      ? stats.matched / stats.total_transactions
      : 0;

    return stats;
  }
}

/**
 * Factory function
 */
export function createReconciliationEngine(supabase: SupabaseClient, orgId: string): ReconciliationEngine {
  return new ReconciliationEngine(supabase, orgId);
}
