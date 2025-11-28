'use client';

import React, { useState } from 'react';
import {
  BookOpen, Plus, Trash2, Check, AlertCircle, Calculator,
  ChevronDown, ChevronUp, Calendar, FileText, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JournalLine {
  id: string;
  account_code: string;
  account_name: string;
  label: string;
  debit: number;
  credit: number;
  analytic_axis_id?: string;
  analytic_value_id?: string;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  journal_code: string;
  journal_name: string;
  entry_date: string;
  piece_ref?: string;
  label: string;
  lines: JournalLine[];
  status: 'draft' | 'validated' | 'posted';
  created_at: string;
  validated_at?: string;
  created_by?: string;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEdit?: (entry: JournalEntry) => void;
  onValidate?: (entryId: string) => Promise<void>;
  onDelete?: (entryId: string) => Promise<void>;
  onDuplicate?: (entry: JournalEntry) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const journalColors: Record<string, { bg: string; text: string; border: string }> = {
  AC: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  VE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  BQ: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  CA: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  OD: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  AN: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

const statusConfig = {
  draft: { label: 'Brouillon', color: 'bg-slate-500/20 text-slate-400' },
  validated: { label: 'Validée', color: 'bg-amber-500/20 text-amber-400' },
  posted: { label: 'Comptabilisée', color: 'bg-emerald-500/20 text-emerald-400' },
};

export function JournalEntryCard({
  entry,
  onEdit,
  onValidate,
  onDelete,
  onDuplicate,
  isExpanded = false,
  onToggleExpand,
}: JournalEntryCardProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const journalStyle = journalColors[entry.journal_code] || journalColors.OD;
  const status = statusConfig[entry.status];

  const handleValidate = async () => {
    if (!onValidate || !isBalanced) return;
    setIsValidating(true);
    try {
      await onValidate(entry.id);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn(
      "backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all",
      isDeleting && "opacity-50"
    )}>
      {/* Header */}
      <div
        className={cn(
          "p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors",
          isExpanded && "border-b border-white/10"
        )}
        onClick={onToggleExpand}
      >
        {/* Journal Badge */}
        <div className={cn(
          "px-2 py-1 rounded-lg border text-xs font-mono font-bold",
          journalStyle.bg, journalStyle.text, journalStyle.border
        )}>
          {entry.journal_code}
        </div>

        {/* Entry Number & Date */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm text-slate-400">{entry.entry_number}</span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar size={12} />
            {formatDate(entry.entry_date)}
          </div>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-white truncate">{entry.label}</p>
          {entry.piece_ref && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <FileText size={10} />
              {entry.piece_ref}
            </div>
          )}
        </div>

        {/* Amounts */}
        <div className="text-right">
          <p className="font-mono text-white font-medium">{formatCurrency(totalDebit)}</p>
          <p className={cn(
            "text-xs",
            isBalanced ? "text-emerald-400" : "text-rose-400"
          )}>
            {isBalanced ? "Équilibrée" : `Écart: ${formatCurrency(totalDebit - totalCredit)}`}
          </p>
        </div>

        {/* Status */}
        <div className={cn("px-2 py-1 rounded-full text-xs font-medium", status.color)}>
          {status.label}
        </div>

        {/* Expand Icon */}
        <div className="text-slate-500">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Lines Table */}
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-xs text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">Compte</th>
                  <th className="px-3 py-2 text-left font-medium">Libellé</th>
                  <th className="px-3 py-2 text-right font-medium">Débit</th>
                  <th className="px-3 py-2 text-right font-medium">Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entry.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-white/5">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-cyan-400">{line.account_code}</span>
                        <span className="text-xs text-slate-500">{line.account_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-300">{line.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      {line.debit > 0 ? (
                        <span className="text-emerald-400">{formatCurrency(line.debit)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      {line.credit > 0 ? (
                        <span className="text-rose-400">{formatCurrency(line.credit)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-medium">
                  <td colSpan={2} className="px-3 py-2 text-sm text-slate-400">Total</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-emerald-400">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-rose-400">
                    {formatCurrency(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Warning */}
          {!isBalanced && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-sm">
              <AlertCircle size={16} />
              L'écriture n'est pas équilibrée. Écart de {formatCurrency(Math.abs(totalDebit - totalCredit))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              Créée le {formatDate(entry.created_at)}
              {entry.created_by && ` par ${entry.created_by}`}
            </div>

            <div className="flex items-center gap-2">
              {entry.status === 'draft' && onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-sm transition-colors flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              )}

              {onDuplicate && (
                <button
                  onClick={() => onDuplicate(entry)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm transition-colors"
                >
                  Dupliquer
                </button>
              )}

              {entry.status === 'draft' && onEdit && (
                <button
                  onClick={() => onEdit(entry)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm transition-colors"
                >
                  Modifier
                </button>
              )}

              {entry.status === 'draft' && onValidate && isBalanced && (
                <button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center gap-1"
                >
                  {isValidating ? (
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Valider
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalEntryCard;
