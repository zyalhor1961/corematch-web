/**
 * Moteur Comptable Corematch
 * Génère automatiquement les écritures comptables à partir des événements métier
 *
 * Conforme PCG français - Partie double obligatoire
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  AccountingEventData,
  AccountingEventType,
  AccountingRule,
  CreateEntryInput,
  CreateLineInput,
  GenerationResult,
  JournalEntry,
  JournalLine,
  SourceType,
  ExpenseAccountMapping,
} from './types';

/**
 * Classe principale du moteur comptable
 */
export class AccountingEngine {
  private supabase: SupabaseClient;
  private orgId: string;

  constructor(supabase: SupabaseClient, orgId: string) {
    this.supabase = supabase;
    this.orgId = orgId;
  }

  /**
   * Point d'entrée principal : génère une écriture à partir d'un événement
   */
  async generateFromEvent(eventData: AccountingEventData): Promise<GenerationResult> {
    try {
      // 1. Trouver la règle applicable
      const rule = await this.findApplicableRule(eventData.event_type);
      if (!rule) {
        return {
          success: false,
          error: `Aucune règle de comptabilisation trouvée pour l'événement ${eventData.event_type}`,
        };
      }

      // 2. Vérifier que la période est ouverte
      const periodOpen = await this.isPeriodOpen(eventData.source.date);
      if (!periodOpen) {
        return {
          success: false,
          error: `La période comptable pour la date ${eventData.source.date} est clôturée`,
        };
      }

      // 3. Résoudre le compte de charge si nécessaire
      if (eventData.source.category) {
        const expenseAccount = await this.resolveExpenseAccount(eventData.source.category);
        eventData.source.expense_account = expenseAccount;
      }

      // 4. Générer les lignes d'écriture à partir du template
      const lines = await this.generateLinesFromTemplate(rule, eventData);

      // 5. Valider l'équilibre débit/crédit
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return {
          success: false,
          error: `Écriture non équilibrée: Débit ${totalDebit.toFixed(2)} != Crédit ${totalCredit.toFixed(2)}`,
        };
      }

      // 6. Créer l'écriture
      const entryInput: CreateEntryInput = {
        org_id: this.orgId,
        journal_code: rule.journal_code,
        source_type: this.eventTypeToSourceType(eventData.event_type),
        source_id: eventData.source.id,
        source_ref: eventData.source.ref,
        entry_date: eventData.source.date,
        document_date: eventData.source.date,
        description: this.generateDescription(rule, eventData),
        lines,
        auto_post: true, // Auto-valider les écritures automatiques
      };

      const result = await this.createEntry(entryInput);

      return result;
    } catch (error: any) {
      console.error('AccountingEngine.generateFromEvent error:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la génération de l\'écriture',
      };
    }
  }

  /**
   * Crée une écriture comptable avec ses lignes
   */
  async createEntry(input: CreateEntryInput): Promise<GenerationResult> {
    try {
      // Récupérer le journal
      const { data: journal, error: journalError } = await this.supabase
        .from('erp_journals')
        .select('id, journal_code, sequence_prefix, next_sequence_number')
        .eq('org_id', input.org_id)
        .eq('journal_code', input.journal_code)
        .single();

      if (journalError || !journal) {
        return { success: false, error: `Journal ${input.journal_code} non trouvé` };
      }

      // Générer le numéro d'écriture
      const year = new Date(input.entry_date).getFullYear();
      const prefix = journal.sequence_prefix || journal.journal_code;
      const seq = journal.next_sequence_number;
      const entryNumber = `${prefix}-${year}-${String(seq).padStart(6, '0')}`;

      // Calculer les totaux
      const totalDebit = input.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = input.lines.reduce((sum, l) => sum + l.credit, 0);

      // Créer l'écriture
      const { data: entry, error: entryError } = await this.supabase
        .from('erp_journal_entries')
        .insert({
          org_id: input.org_id,
          entry_number: entryNumber,
          journal_id: journal.id,
          source_type: input.source_type,
          source_id: input.source_id,
          source_ref: input.source_ref,
          entry_date: input.entry_date,
          document_date: input.document_date,
          description: input.description,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status: input.auto_post ? 'posted' : 'draft',
          posted_at: input.auto_post ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (entryError || !entry) {
        console.error('Entry creation error:', entryError);
        return { success: false, error: entryError?.message || 'Erreur création écriture' };
      }

      // Créer les lignes
      const linesData = input.lines.map((line, index) => ({
        entry_id: entry.id,
        account_code: line.account_code,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        partner_type: line.partner_type,
        partner_id: line.partner_id,
        partner_name: line.partner_name,
        analytic_account: line.analytic_account,
        line_number: index + 1,
      }));

      const { error: linesError } = await this.supabase
        .from('erp_journal_lines')
        .insert(linesData);

      if (linesError) {
        // Rollback: supprimer l'écriture
        await this.supabase.from('erp_journal_entries').delete().eq('id', entry.id);
        return { success: false, error: linesError.message };
      }

      // Mettre à jour la séquence du journal
      await this.supabase
        .from('erp_journals')
        .update({ next_sequence_number: seq + 1 })
        .eq('id', journal.id);

      // Logger l'action
      await this.logAudit(entry.id, null, 'created', null, entry);

      return {
        success: true,
        entry_id: entry.id,
        entry_number: entryNumber,
        entry: entry,
      };
    } catch (error: any) {
      console.error('AccountingEngine.createEntry error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Annule une écriture (crée une écriture d'extourne)
   */
  async reverseEntry(entryId: string, reversalDate: string, reason?: string): Promise<GenerationResult> {
    try {
      // Récupérer l'écriture originale avec ses lignes
      const { data: original, error } = await this.supabase
        .from('erp_journal_entries')
        .select(`
          *,
          journal:erp_journals(*),
          lines:erp_journal_lines(*)
        `)
        .eq('id', entryId)
        .single();

      if (error || !original) {
        return { success: false, error: 'Écriture non trouvée' };
      }

      if (original.status === 'reversed') {
        return { success: false, error: 'Cette écriture est déjà annulée' };
      }

      if (original.status === 'locked') {
        return { success: false, error: 'Cette écriture est verrouillée' };
      }

      // Vérifier que la période est ouverte
      const periodOpen = await this.isPeriodOpen(reversalDate);
      if (!periodOpen) {
        return { success: false, error: 'La période comptable est clôturée' };
      }

      // Créer les lignes inversées (débits <-> crédits)
      const reversedLines: CreateLineInput[] = original.lines.map((line: any) => ({
        account_code: line.account_code,
        debit: line.credit,    // Inverser
        credit: line.debit,    // Inverser
        description: `[EXTOURNE] ${line.description || ''}`,
        partner_type: line.partner_type,
        partner_id: line.partner_id,
        partner_name: line.partner_name,
      }));

      // Créer l'écriture d'extourne
      const reversalInput: CreateEntryInput = {
        org_id: this.orgId,
        journal_code: original.journal.journal_code,
        source_type: 'manual_adjustment',
        source_id: entryId,
        source_ref: `EXTOURNE ${original.entry_number}`,
        entry_date: reversalDate,
        description: `Extourne de ${original.entry_number}${reason ? ` - ${reason}` : ''}`,
        lines: reversedLines,
        auto_post: true,
      };

      const reversalResult = await this.createEntry(reversalInput);

      if (!reversalResult.success) {
        return reversalResult;
      }

      // Marquer l'écriture originale comme annulée
      await this.supabase
        .from('erp_journal_entries')
        .update({
          status: 'reversed',
          reversed_by: reversalResult.entry_id,
          reversal_date: reversalDate,
        })
        .eq('id', entryId);

      // Mettre à jour l'écriture d'extourne avec la référence à l'original
      await this.supabase
        .from('erp_journal_entries')
        .update({ reversal_of: entryId })
        .eq('id', reversalResult.entry_id);

      return {
        success: true,
        entry_id: reversalResult.entry_id,
        entry_number: reversalResult.entry_number,
        warnings: [`Écriture ${original.entry_number} annulée par ${reversalResult.entry_number}`],
      };
    } catch (error: any) {
      console.error('AccountingEngine.reverseEntry error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Valide (poste) une écriture en brouillon
   */
  async postEntry(entryId: string): Promise<GenerationResult> {
    try {
      const { data: entry, error } = await this.supabase
        .from('erp_journal_entries')
        .select('*, lines:erp_journal_lines(*)')
        .eq('id', entryId)
        .single();

      if (error || !entry) {
        return { success: false, error: 'Écriture non trouvée' };
      }

      if (entry.status !== 'draft') {
        return { success: false, error: `L'écriture est déjà en statut ${entry.status}` };
      }

      // Vérifier l'équilibre
      const totalDebit = entry.lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
      const totalCredit = entry.lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return { success: false, error: 'Écriture non équilibrée' };
      }

      // Vérifier que la période est ouverte
      const periodOpen = await this.isPeriodOpen(entry.entry_date);
      if (!periodOpen) {
        return { success: false, error: 'La période comptable est clôturée' };
      }

      // Valider
      await this.supabase
        .from('erp_journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      await this.logAudit(entryId, null, 'posted', { status: 'draft' }, { status: 'posted' });

      return { success: true, entry_id: entryId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Recherche une écriture par source
   */
  async findEntryBySource(sourceType: SourceType, sourceId: string): Promise<JournalEntry | null> {
    const { data, error } = await this.supabase
      .from('erp_journal_entries')
      .select('*, lines:erp_journal_lines(*)')
      .eq('org_id', this.orgId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .neq('status', 'reversed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as JournalEntry;
  }

  // ========================================
  // MÉTHODES PRIVÉES
  // ========================================

  /**
   * Trouve la règle applicable pour un type d'événement
   */
  private async findApplicableRule(eventType: AccountingEventType): Promise<AccountingRule | null> {
    const { data, error } = await this.supabase
      .from('erp_accounting_rules')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as AccountingRule;
  }

  /**
   * Vérifie si la période est ouverte
   */
  private async isPeriodOpen(date: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('erp_fiscal_periods')
      .select('status')
      .eq('org_id', this.orgId)
      .lte('start_date', date)
      .gte('end_date', date)
      .single();

    // Pas de période définie = ouvert
    if (!data) return true;
    return data.status === 'open' || data.status === 'closing';
  }

  /**
   * Résout le compte de charge pour une catégorie de dépense
   */
  private async resolveExpenseAccount(category: string): Promise<string> {
    const { data } = await this.supabase
      .from('erp_expense_account_mapping')
      .select('account_code')
      .eq('org_id', this.orgId)
      .eq('expense_category', category)
      .single();

    return data?.account_code || '671000'; // Charges exceptionnelles par défaut
  }

  /**
   * Génère les lignes d'écriture à partir du template
   */
  private async generateLinesFromTemplate(
    rule: AccountingRule,
    eventData: AccountingEventData
  ): Promise<CreateLineInput[]> {
    const lines: CreateLineInput[] = [];

    for (const template of rule.line_templates) {
      // Résoudre le compte
      const accountCode = this.resolveExpression(template.account_expression, eventData);
      if (!accountCode) continue;

      // Résoudre les montants
      const debit = this.evaluateAmount(template.debit_expression, eventData);
      const credit = this.evaluateAmount(template.credit_expression, eventData);

      // Skip si montant = 0
      if (debit === 0 && credit === 0) continue;

      // Résoudre le tiers
      let partnerId: string | undefined;
      let partnerName: string | undefined;
      let partnerType: 'client' | 'supplier' | 'employee' | undefined;

      if (template.partner_expression) {
        const partnerIdValue = this.resolveExpression(template.partner_expression, eventData);
        if (partnerIdValue) {
          partnerId = partnerIdValue;
          // Déterminer le type de tiers selon le compte
          if (accountCode.startsWith('411')) {
            partnerType = 'client';
            partnerName = eventData.source.client_name;
          } else if (accountCode.startsWith('401')) {
            partnerType = 'supplier';
            partnerName = eventData.source.supplier_name;
          }
        }
      }

      // Générer la description
      const description = this.interpolateTemplate(template.description_template, eventData);

      lines.push({
        account_code: accountCode,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        description,
        partner_type: partnerType,
        partner_id: partnerId,
        partner_name: partnerName,
      });
    }

    return lines;
  }

  /**
   * Résout une expression en valeur
   */
  private resolveExpression(expression: string, eventData: AccountingEventData): string {
    // Expression directe (compte fixe)
    if (/^\d{6}$/.test(expression)) {
      return expression;
    }

    // Expression dynamique
    if (expression === 'expense_account') {
      return eventData.source.expense_account || '671000';
    }

    // Expression de chemin (source.xxx)
    if (expression.startsWith('source.')) {
      const path = expression.substring(7);
      return String(eventData.source[path] || '');
    }

    return expression;
  }

  /**
   * Évalue une expression de montant
   */
  private evaluateAmount(expression: string, eventData: AccountingEventData): number {
    if (expression === '0') return 0;

    // Expression de chemin
    if (expression.startsWith('source.')) {
      const path = expression.substring(7);
      const value = eventData.source[path];
      return typeof value === 'number' ? value : parseFloat(value) || 0;
    }

    return parseFloat(expression) || 0;
  }

  /**
   * Interpole un template avec les données
   */
  private interpolateTemplate(template: string, eventData: AccountingEventData): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      // Mappings spéciaux
      const mappings: Record<string, string> = {
        partner_name: eventData.source.client_name || eventData.source.supplier_name || '',
        source_ref: eventData.source.ref || '',
        description: eventData.source.description || '',
        supplier_name: eventData.source.supplier_name || '',
        client_name: eventData.source.client_name || '',
      };

      if (key in mappings) {
        return mappings[key];
      }

      // Chemin dans source
      if (key.startsWith('source.')) {
        return String(eventData.source[key.substring(7)] || '');
      }

      return match;
    });
  }

  /**
   * Génère la description de l'écriture
   */
  private generateDescription(rule: AccountingRule, eventData: AccountingEventData): string {
    const ref = eventData.source.ref || eventData.source.id?.substring(0, 8);
    const partner = eventData.source.client_name || eventData.source.supplier_name || '';

    switch (rule.event_type) {
      case 'customer_invoice_validated':
        return `Facture client ${ref}${partner ? ` - ${partner}` : ''}`;
      case 'supplier_invoice_validated':
        return `Facture fournisseur ${ref}${partner ? ` - ${partner}` : ''}`;
      case 'payment_received':
        return `Encaissement ${ref}${partner ? ` - ${partner}` : ''}`;
      case 'payment_sent':
        return `Décaissement ${ref}${partner ? ` - ${partner}` : ''}`;
      case 'expense_recorded':
        return `Dépense ${eventData.source.description || ref}`;
      default:
        return `${rule.rule_name} - ${ref}`;
    }
  }

  /**
   * Convertit un type d'événement en type de source
   */
  private eventTypeToSourceType(eventType: AccountingEventType): SourceType {
    const mapping: Record<AccountingEventType, SourceType> = {
      customer_invoice_validated: 'customer_invoice',
      supplier_invoice_validated: 'supplier_invoice',
      payment_received: 'payment_in',
      payment_sent: 'payment_out',
      expense_recorded: 'expense',
      manual_entry: 'manual_adjustment',
    };
    return mapping[eventType] || 'manual_adjustment';
  }

  /**
   * Logger l'audit
   */
  private async logAudit(
    entryId: string | null,
    lineId: string | null,
    action: string,
    oldValues: any,
    newValues: any
  ): Promise<void> {
    try {
      await this.supabase.from('erp_accounting_audit_log').insert({
        org_id: this.orgId,
        entry_id: entryId,
        line_id: lineId,
        action,
        old_values: oldValues,
        new_values: newValues,
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
}

// ========================================
// FONCTIONS UTILITAIRES EXPORTÉES
// ========================================

/**
 * Initialise le plan comptable et les journaux pour une nouvelle organisation
 */
export async function initializeOrganizationAccounting(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Appeler les fonctions SQL d'initialisation
    await supabase.rpc('init_pcg_accounts', { p_org_id: orgId });
    await supabase.rpc('init_journals', { p_org_id: orgId });
    await supabase.rpc('init_accounting_rules', { p_org_id: orgId });
    await supabase.rpc('init_expense_mapping', { p_org_id: orgId });

    return { success: true };
  } catch (error: any) {
    console.error('initializeOrganizationAccounting error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Crée une instance du moteur comptable
 */
export function createAccountingEngine(supabase: SupabaseClient, orgId: string): AccountingEngine {
  return new AccountingEngine(supabase, orgId);
}
