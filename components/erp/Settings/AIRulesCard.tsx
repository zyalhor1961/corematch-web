'use client';

import React, { useState } from 'react';
import {
  Sparkles, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Zap, Search, Calculator, FileText, CreditCard, ArrowRightLeft,
  ChevronDown, ChevronUp, GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AIRule {
  id: string;
  name: string;
  description?: string;
  type: 'matching' | 'categorization' | 'account_suggestion' | 'anomaly_detection';
  trigger: {
    field: string;
    operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'amount_range';
    value: string | number | [number, number];
  };
  action: {
    type: 'set_account' | 'set_category' | 'suggest_match' | 'flag_review' | 'auto_approve';
    value?: string;
    confidence_threshold?: number;
  };
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  match_count?: number;
}

interface AIRulesCardProps {
  rules: AIRule[];
  onAdd: () => void;
  onEdit: (rule: AIRule) => void;
  onDelete: (ruleId: string) => Promise<void>;
  onToggle: (ruleId: string, isActive: boolean) => Promise<void>;
  onReorder: (ruleIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

const ruleTypeConfig = {
  matching: {
    icon: ArrowRightLeft,
    label: 'Rapprochement',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    description: 'Match automatique banque/factures',
  },
  categorization: {
    icon: FileText,
    label: 'Catégorisation',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    description: 'Classification des transactions',
  },
  account_suggestion: {
    icon: Calculator,
    label: 'Compte comptable',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    description: 'Suggestion de comptes PCG',
  },
  anomaly_detection: {
    icon: Search,
    label: 'Détection anomalies',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    description: 'Alertes sur transactions suspectes',
  },
};

const operatorLabels: Record<string, string> = {
  contains: 'contient',
  equals: 'égal à',
  starts_with: 'commence par',
  ends_with: 'termine par',
  regex: 'expression régulière',
  amount_range: 'montant entre',
};

export function AIRulesCard({
  rules,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onReorder,
  isLoading,
}: AIRulesCardProps) {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [deletingRule, setDeletingRule] = useState<string | null>(null);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);

  const toggleExpand = (ruleId: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleToggle = async (rule: AIRule) => {
    setTogglingRule(rule.id);
    try {
      await onToggle(rule.id, !rule.is_active);
    } finally {
      setTogglingRule(null);
    }
  };

  const handleDelete = async (ruleId: string) => {
    setDeletingRule(ruleId);
    try {
      await onDelete(ruleId);
    } finally {
      setDeletingRule(null);
    }
  };

  const formatTriggerValue = (trigger: AIRule['trigger']) => {
    if (trigger.operator === 'amount_range' && Array.isArray(trigger.value)) {
      return `${trigger.value[0]}€ - ${trigger.value[1]}€`;
    }
    return String(trigger.value);
  };

  // Group rules by type
  const rulesByType = rules.reduce((acc, rule) => {
    if (!acc[rule.type]) {
      acc[rule.type] = [];
    }
    acc[rule.type].push(rule);
    return acc;
  }, {} as Record<string, AIRule[]>);

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeRules = rules.filter(r => r.is_active).length;
  const totalMatches = rules.reduce((sum, r) => sum + (r.match_count || 0), 0);

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Sparkles size={20} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Règles IA</h3>
            <p className="text-sm text-slate-400">
              {activeRules} règle{activeRules > 1 ? 's' : ''} active{activeRules > 1 ? 's' : ''}
              {totalMatches > 0 && ` • ${totalMatches.toLocaleString('fr-FR')} correspondances`}
            </p>
          </div>
        </div>

        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nouvelle règle
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-px bg-white/5">
        {Object.entries(ruleTypeConfig).map(([type, config]) => {
          const count = rulesByType[type]?.length || 0;
          const Icon = config.icon;
          return (
            <div key={type} className="p-4 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Icon size={14} className={config.color} />
                <span className="text-sm text-slate-400">{config.label}</span>
              </div>
              <div className="text-2xl font-bold text-white mt-1">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Rules List */}
      <div className="divide-y divide-white/5">
        {rules.length > 0 ? (
          rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => {
              const config = ruleTypeConfig[rule.type];
              const TypeIcon = config.icon;
              const isExpanded = expandedRules.has(rule.id);
              const isDeleting = deletingRule === rule.id;
              const isToggling = togglingRule === rule.id;

              return (
                <div
                  key={rule.id}
                  className={cn(
                    "transition-all",
                    !rule.is_active && "opacity-60",
                    isDeleting && "opacity-30"
                  )}
                >
                  {/* Rule Header */}
                  <div className="p-4 flex items-center gap-4">
                    {/* Drag Handle */}
                    <div className="cursor-grab text-slate-600 hover:text-slate-400">
                      <GripVertical size={16} />
                    </div>

                    {/* Type Icon */}
                    <div className={cn("p-2 rounded-lg shrink-0", config.bg)}>
                      <TypeIcon size={16} className={config.color} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{rule.name}</span>
                        {rule.match_count !== undefined && rule.match_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                            {rule.match_count} match{rule.match_count > 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-sm text-slate-500 truncate mt-0.5">{rule.description}</p>
                      )}
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={isToggling}
                      className={cn(
                        "p-1 rounded transition-colors",
                        rule.is_active ? "text-emerald-400" : "text-slate-500"
                      )}
                    >
                      {rule.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>

                    {/* Expand */}
                    <button
                      onClick={() => toggleExpand(rule.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(rule)}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={isDeleting}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-16 space-y-3">
                      {/* Trigger */}
                      <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                        <div className="text-xs text-slate-500 mb-1">Déclencheur</div>
                        <div className="text-sm text-white font-mono">
                          <span className="text-cyan-400">{rule.trigger.field}</span>
                          {' '}
                          <span className="text-slate-500">{operatorLabels[rule.trigger.operator]}</span>
                          {' '}
                          <span className="text-emerald-400">"{formatTriggerValue(rule.trigger)}"</span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                        <div className="text-xs text-slate-500 mb-1">Action</div>
                        <div className="text-sm text-white">
                          {rule.action.type === 'set_account' && (
                            <>Affecter au compte <span className="font-mono text-emerald-400">{rule.action.value}</span></>
                          )}
                          {rule.action.type === 'set_category' && (
                            <>Catégoriser comme <span className="text-purple-400">{rule.action.value}</span></>
                          )}
                          {rule.action.type === 'suggest_match' && (
                            <>Suggérer un rapprochement (confiance min: {(rule.action.confidence_threshold || 0.8) * 100}%)</>
                          )}
                          {rule.action.type === 'flag_review' && (
                            <>Marquer pour révision</>
                          )}
                          {rule.action.type === 'auto_approve' && (
                            <>Approuver automatiquement</>
                          )}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Priorité: {rule.priority}</span>
                        <span>Modifié: {new Date(rule.updated_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Zap size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 mb-1">Aucune règle configurée</p>
            <p className="text-sm text-slate-500 mb-4">
              Créez des règles pour automatiser le traitement de vos transactions
            </p>
            <button
              onClick={onAdd}
              className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
              Créer ma première règle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIRulesCard;
