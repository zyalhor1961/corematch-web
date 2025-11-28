'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, AlertTriangle, HelpCircle, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BankTransaction {
  id: string;
  operation_date: string;
  value_date?: string;
  amount: number;
  direction: 'credit' | 'debit';
  label_raw: string;
  label_clean?: string;
  label_category?: string;
  counterparty_name?: string;
  bank_reference?: string;
  reconciliation_status: 'unmatched' | 'suggested' | 'matched' | 'suspicious' | 'ignored';
  reconciliation_score?: number;
}

interface TransactionRowProps {
  transaction: BankTransaction;
  isSelected?: boolean;
  onClick?: () => void;
}

const statusConfig = {
  unmatched: {
    icon: HelpCircle,
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    label: 'Non rapproché'
  },
  suggested: {
    icon: Link2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    label: 'Suggestion'
  },
  matched: {
    icon: Check,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    label: 'Rapproché'
  },
  suspicious: {
    icon: AlertTriangle,
    color: 'text-rose-400',
    bg: 'bg-rose-500/20',
    label: 'Suspect'
  },
  ignored: {
    icon: HelpCircle,
    color: 'text-slate-500',
    bg: 'bg-slate-500/20',
    label: 'Ignoré'
  },
};

export function TransactionRow({ transaction, isSelected, onClick }: TransactionRowProps) {
  const status = statusConfig[transaction.reconciliation_status];
  const StatusIcon = status.icon;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      signDisplay: 'never'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border transition-all cursor-pointer",
        isSelected
          ? "bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10"
          : "bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r" />
      )}

      <div className="flex items-center gap-4">
        {/* Direction Icon */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          transaction.direction === 'credit'
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-rose-500/20 text-rose-400"
        )}>
          {transaction.direction === 'credit'
            ? <ArrowDownLeft size={18} />
            : <ArrowUpRight size={18} />
          }
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">
              {transaction.counterparty_name || transaction.label_clean || transaction.label_raw}
            </span>
            {transaction.label_category && (
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 uppercase">
                {transaction.label_category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <span>{formatDate(transaction.operation_date)}</span>
            {transaction.bank_reference && (
              <>
                <span className="text-slate-600">|</span>
                <span className="font-mono truncate max-w-[150px]">{transaction.bank_reference}</span>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        <div className={cn(
          "px-2 py-1 rounded-full flex items-center gap-1",
          status.bg
        )}>
          <StatusIcon size={12} className={status.color} />
          {transaction.reconciliation_score !== undefined && transaction.reconciliation_score > 0 && (
            <span className={cn("text-[10px] font-medium", status.color)}>
              {Math.round(transaction.reconciliation_score * 100)}%
            </span>
          )}
        </div>

        {/* Amount */}
        <div className={cn(
          "text-right font-mono font-semibold",
          transaction.direction === 'credit' ? "text-emerald-400" : "text-rose-400"
        )}>
          <span className="text-xs mr-1">
            {transaction.direction === 'credit' ? '+' : '-'}
          </span>
          {formatCurrency(transaction.amount)}
        </div>
      </div>
    </div>
  );
}

export default TransactionRow;
