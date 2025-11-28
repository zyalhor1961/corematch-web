'use client';

import React from 'react';
import { FileText, User, Truck, Check, X, Sparkles, Link2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BankTransaction } from './TransactionRow';

export interface MatchSuggestion {
  id: string;
  match_type: 'customer_invoice' | 'supplier_invoice' | 'expense' | 'other';
  confidence_score: number;
  match_rule?: string;
  matched_entity?: {
    id: string;
    type: 'invoice' | 'supplier_invoice' | 'expense';
    reference: string;
    date: string;
    amount: number;
    counterparty_name?: string;
  };
}

interface MatchSuggestionCardProps {
  transaction: BankTransaction;
  suggestions: MatchSuggestion[];
  onMatch: (transactionId: string, suggestionId: string) => void;
  onReject: (transactionId: string, suggestionId: string) => void;
  onIgnore: (transactionId: string) => void;
  isLoading?: boolean;
}

const matchTypeConfig = {
  customer_invoice: {
    icon: User,
    label: 'Facture client',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
  },
  supplier_invoice: {
    icon: Truck,
    label: 'Facture fournisseur',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
  },
  expense: {
    icon: FileText,
    label: 'Dépense',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
  },
  other: {
    icon: FileText,
    label: 'Autre',
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
  },
};

export function MatchSuggestionCard({
  transaction,
  suggestions,
  onMatch,
  onReject,
  onIgnore,
  isLoading,
}: MatchSuggestionCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-emerald-400';
    if (score >= 0.7) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Recherche de correspondances...</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="text-center py-8">
          <AlertTriangle size={32} className="mx-auto mb-3 text-slate-500" />
          <h4 className="text-white font-medium mb-1">Aucune correspondance trouvée</h4>
          <p className="text-sm text-slate-400 mb-4">
            L'IA n'a pas trouvé de facture correspondante pour cette transaction.
          </p>
          <button
            onClick={() => onIgnore(transaction.id)}
            className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors text-sm"
          >
            Ignorer cette transaction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Transaction Summary */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Sparkles size={14} className="text-cyan-400" />
          Suggestions IA pour cette transaction
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white font-medium truncate">
            {transaction.counterparty_name || transaction.label_clean || transaction.label_raw}
          </span>
          <span className={cn(
            "font-mono font-semibold",
            transaction.direction === 'credit' ? "text-emerald-400" : "text-rose-400"
          )}>
            {transaction.direction === 'credit' ? '+' : '-'}
            {formatCurrency(transaction.amount)}
          </span>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.map((suggestion, index) => {
        const config = matchTypeConfig[suggestion.match_type] || matchTypeConfig.other;
        const TypeIcon = config.icon;
        const entity = suggestion.matched_entity;

        return (
          <div
            key={suggestion.id}
            className={cn(
              "relative backdrop-blur-xl bg-white/5 border rounded-2xl p-5 transition-all",
              index === 0 ? "border-cyan-500/30 shadow-lg shadow-cyan-500/10" : "border-white/10"
            )}
          >
            {/* Best match badge */}
            {index === 0 && suggestion.confidence_score >= 0.8 && (
              <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-cyan-500 text-white text-[10px] font-medium">
                Meilleure correspondance
              </div>
            )}

            {/* Match Type & Confidence */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn("p-2 rounded-lg", config.bg)}>
                  <TypeIcon size={16} className={config.color} />
                </div>
                <span className="text-sm text-slate-300">{config.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Confiance:</span>
                <span className={cn("font-mono font-bold", getConfidenceColor(suggestion.confidence_score))}>
                  {Math.round(suggestion.confidence_score * 100)}%
                </span>
              </div>
            </div>

            {/* Matched Entity Details */}
            {entity && (
              <div className="bg-slate-900/50 rounded-xl p-4 mb-4 border border-white/5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-white font-medium">{entity.reference}</div>
                    {entity.counterparty_name && (
                      <div className="text-sm text-slate-400 mt-1">{entity.counterparty_name}</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">{formatDate(entity.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-white">
                      {formatCurrency(entity.amount)}
                    </div>
                    {Math.abs(entity.amount - transaction.amount) > 0.01 && (
                      <div className="text-xs text-amber-400 mt-1">
                        Diff: {formatCurrency(Math.abs(entity.amount - transaction.amount))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Rule */}
                {suggestion.match_rule && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-slate-500">
                    <Link2 size={12} />
                    Règle: {suggestion.match_rule}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onMatch(transaction.id, suggestion.id)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2"
              >
                <Check size={16} />
                Valider
              </button>
              <button
                onClick={() => onReject(transaction.id, suggestion.id)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Ignore Action */}
      <button
        onClick={() => onIgnore(transaction.id)}
        className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Aucune correspondance - Ignorer cette transaction
      </button>
    </div>
  );
}

export default MatchSuggestionCard;
