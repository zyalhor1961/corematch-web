'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Sparkles, ArrowRightLeft, FileText, Calculator, Search,
  Save, AlertCircle, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIRule } from './AIRulesCard';

interface RuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Partial<AIRule>) => Promise<void>;
  rule?: AIRule | null;
}

const ruleTypes = [
  { value: 'matching', label: 'Rapprochement', icon: ArrowRightLeft, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  { value: 'categorization', label: 'Catégorisation', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { value: 'account_suggestion', label: 'Compte comptable', icon: Calculator, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { value: 'anomaly_detection', label: 'Détection anomalies', icon: Search, color: 'text-amber-400', bg: 'bg-amber-500/20' },
] as const;

const triggerFields = [
  { value: 'counterparty_name', label: 'Nom du tiers' },
  { value: 'label_raw', label: 'Libellé transaction' },
  { value: 'label_clean', label: 'Libellé nettoyé' },
  { value: 'amount', label: 'Montant' },
  { value: 'bank_reference', label: 'Référence bancaire' },
  { value: 'direction', label: 'Sens (crédit/débit)' },
];

const operators = [
  { value: 'contains', label: 'contient', forText: true },
  { value: 'equals', label: 'égal à', forText: true },
  { value: 'starts_with', label: 'commence par', forText: true },
  { value: 'ends_with', label: 'termine par', forText: true },
  { value: 'regex', label: 'expression régulière', forText: true },
  { value: 'amount_range', label: 'entre (montant)', forText: false },
];

const actionTypes = [
  { value: 'set_account', label: 'Affecter un compte', needsValue: true },
  { value: 'set_category', label: 'Définir une catégorie', needsValue: true },
  { value: 'suggest_match', label: 'Suggérer rapprochement', needsConfidence: true },
  { value: 'flag_review', label: 'Marquer pour révision', needsValue: false },
  { value: 'auto_approve', label: 'Approuver automatiquement', needsValue: false },
];

// Common PCG accounts for suggestions
const commonAccounts = [
  { code: '401000', label: 'Fournisseurs' },
  { code: '411000', label: 'Clients' },
  { code: '512000', label: 'Banque' },
  { code: '606100', label: 'Fournitures non stockables - Eau, électricité' },
  { code: '606400', label: 'Fournitures administratives' },
  { code: '613200', label: 'Locations immobilières' },
  { code: '622600', label: 'Honoraires' },
  { code: '625100', label: 'Voyages et déplacements' },
  { code: '626000', label: 'Frais postaux et télécommunications' },
  { code: '627000', label: 'Services bancaires' },
];

export function RuleEditorModal({ isOpen, onClose, onSave, rule }: RuleEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleType, setRuleType] = useState<AIRule['type']>('account_suggestion');
  const [triggerField, setTriggerField] = useState('counterparty_name');
  const [triggerOperator, setTriggerOperator] = useState('contains');
  const [triggerValue, setTriggerValue] = useState('');
  const [triggerValueMin, setTriggerValueMin] = useState('');
  const [triggerValueMax, setTriggerValueMax] = useState('');
  const [actionType, setActionType] = useState('set_account');
  const [actionValue, setActionValue] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [priority, setPriority] = useState(10);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Populate form if editing
      if (rule) {
        setName(rule.name);
        setDescription(rule.description || '');
        setRuleType(rule.type);
        setTriggerField(rule.trigger.field);
        setTriggerOperator(rule.trigger.operator);
        if (rule.trigger.operator === 'amount_range' && Array.isArray(rule.trigger.value)) {
          setTriggerValueMin(String(rule.trigger.value[0]));
          setTriggerValueMax(String(rule.trigger.value[1]));
        } else {
          setTriggerValue(String(rule.trigger.value));
        }
        setActionType(rule.action.type);
        setActionValue(rule.action.value || '');
        setConfidenceThreshold((rule.action.confidence_threshold || 0.8) * 100);
        setPriority(rule.priority);
      } else {
        // Reset form for new rule
        setName('');
        setDescription('');
        setRuleType('account_suggestion');
        setTriggerField('counterparty_name');
        setTriggerOperator('contains');
        setTriggerValue('');
        setTriggerValueMin('');
        setTriggerValueMax('');
        setActionType('set_account');
        setActionValue('');
        setConfidenceThreshold(80);
        setPriority(10);
      }
      setError(null);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, rule]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Le nom de la règle est requis');
      return;
    }

    if (triggerOperator === 'amount_range') {
      if (!triggerValueMin || !triggerValueMax) {
        setError('Veuillez spécifier les deux bornes du montant');
        return;
      }
    } else if (!triggerValue.trim()) {
      setError('La valeur du déclencheur est requise');
      return;
    }

    const selectedAction = actionTypes.find(a => a.value === actionType);
    if (selectedAction?.needsValue && !actionValue.trim()) {
      setError('La valeur de l\'action est requise');
      return;
    }

    setIsSubmitting(true);
    try {
      const triggerValueFinal = triggerOperator === 'amount_range'
        ? [parseFloat(triggerValueMin), parseFloat(triggerValueMax)]
        : triggerValue;

      await onSave({
        id: rule?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        type: ruleType,
        trigger: {
          field: triggerField,
          operator: triggerOperator as AIRule['trigger']['operator'],
          value: triggerValueFinal,
        },
        action: {
          type: actionType as AIRule['action']['type'],
          value: actionValue.trim() || undefined,
          confidence_threshold: actionType === 'suggest_match' ? confidenceThreshold / 100 : undefined,
        },
        priority,
        is_active: rule?.is_active ?? true,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAction = actionTypes.find(a => a.value === actionType);
  const isAmountOperator = triggerOperator === 'amount_range';

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl my-8 backdrop-blur-xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Neural accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
              <Sparkles size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {rule ? 'Modifier la règle' : 'Nouvelle règle IA'}
              </h2>
              <p className="text-sm text-slate-400">
                Configurez le déclencheur et l'action automatique
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nom de la règle *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Amazon → Fournitures bureau"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description (optionnel)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description de ce que fait cette règle..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Rule Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Type de règle
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ruleTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = ruleType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setRuleType(type.value)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all flex items-center gap-3",
                      isSelected
                        ? `${type.bg} border-white/20`
                        : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
                    )}
                  >
                    <Icon size={18} className={isSelected ? type.color : "text-slate-400"} />
                    <span className={isSelected ? "text-white" : "text-slate-300"}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trigger */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <HelpCircle size={14} />
              Déclencheur : SI...
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Champ</label>
                <select
                  value={triggerField}
                  onChange={(e) => setTriggerField(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {triggerFields.map(field => (
                    <option key={field.value} value={field.value}>{field.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Opérateur</label>
                <select
                  value={triggerOperator}
                  onChange={(e) => setTriggerOperator(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {operators.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Valeur</label>
                {isAmountOperator ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={triggerValueMin}
                      onChange={(e) => setTriggerValueMin(e.target.value)}
                      placeholder="Min"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <input
                      type="number"
                      value={triggerValueMax}
                      onChange={(e) => setTriggerValueMax(e.target.value)}
                      placeholder="Max"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    placeholder="Valeur..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <Sparkles size={14} />
              Action : ALORS...
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Action</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {actionTypes.map(action => (
                    <option key={action.value} value={action.value}>{action.label}</option>
                  ))}
                </select>
              </div>

              {selectedAction?.needsValue && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {actionType === 'set_account' ? 'Compte PCG' : 'Valeur'}
                  </label>
                  {actionType === 'set_account' ? (
                    <select
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="">Sélectionner...</option>
                      {commonAccounts.map(acc => (
                        <option key={acc.code} value={acc.code}>
                          {acc.code} - {acc.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder="Valeur..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  )}
                </div>
              )}

              {selectedAction?.needsConfidence && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Seuil de confiance: {confidenceThreshold}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Priorité (1 = plus haute)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-32 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">
              Les règles sont évaluées par ordre de priorité croissant
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? 'Enregistrement...' : (rule ? 'Mettre à jour' : 'Créer la règle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default RuleEditorModal;
