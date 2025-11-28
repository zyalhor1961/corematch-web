'use client';

import React, { useState, useMemo } from 'react';
import {
  BookText, Search, Calendar, Download, ChevronDown,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LedgerEntry {
  id: string;
  entry_date: string;
  journal_code: string;
  entry_number: string;
  piece_ref?: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
  counterpart_accounts?: string[];
}

export interface AccountInfo {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  opening_balance: number;
}

interface AccountLedgerCardProps {
  account: AccountInfo;
  entries: LedgerEntry[];
  onExport?: () => void;
  isLoading?: boolean;
}

const accountTypeLabels = {
  asset: { label: 'Actif', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  liability: { label: 'Passif', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  equity: { label: 'Capitaux', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  revenue: { label: 'Produit', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  expense: { label: 'Charge', color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

const journalColors: Record<string, string> = {
  AC: 'text-blue-400',
  VE: 'text-emerald-400',
  BQ: 'text-cyan-400',
  CA: 'text-amber-400',
  OD: 'text-purple-400',
  AN: 'text-rose-400',
};

export function AccountLedgerCard({
  account,
  entries,
  onExport,
  isLoading,
}: AccountLedgerCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('year');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const periodOptions = [
    { value: 'month', label: 'Ce mois' },
    { value: 'quarter', label: 'Ce trimestre' },
    { value: 'year', label: 'Cette année' },
    { value: 'all', label: 'Tout' },
  ];

  const typeConfig = accountTypeLabels[account.type];

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

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          entry.label.toLowerCase().includes(query) ||
          entry.entry_number.toLowerCase().includes(query) ||
          entry.piece_ref?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [entries, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebit = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = filteredEntries.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = account.opening_balance + totalDebit - totalCredit;
    return { totalDebit, totalCredit, closingBalance };
  }, [filteredEntries, account.opening_balance]);

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-white/10 rounded w-64" />
            <div className="h-8 bg-white/10 rounded w-32" />
          </div>
          <div className="h-12 bg-white/5 rounded-lg" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
              <BookText size={24} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg text-cyan-400 font-bold">{account.code}</span>
                <h2 className="text-xl font-semibold text-white">{account.name}</h2>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeConfig.bg, typeConfig.color)}>
                  {typeConfig.label}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {filteredEntries.length} mouvement{filteredEntries.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Filter */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                <Calendar size={14} />
                {periodOptions.find(p => p.value === selectedPeriod)?.label}
                <ChevronDown size={14} />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 z-10 mt-1 w-36 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {periodOptions.map(p => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setSelectedPeriod(p.value);
                        setShowPeriodDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                        p.value === selectedPeriod ? "bg-white/10 text-white" : "text-slate-300"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {onExport && (
              <button
                onClick={onExport}
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Exporter
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Solde initial</p>
            <p className="text-lg font-bold text-white font-mono">
              {formatCurrency(account.opening_balance)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Total débit</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">
              {formatCurrency(totals.totalDebit)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Total crédit</p>
            <p className="text-lg font-bold text-rose-400 font-mono">
              {formatCurrency(totals.totalCredit)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Solde final</p>
            <p className={cn(
              "text-lg font-bold font-mono",
              totals.closingBalance >= 0 ? "text-cyan-400" : "text-amber-400"
            )}>
              {formatCurrency(totals.closingBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par libellé, n° écriture..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Entries Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 text-xs text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Journal</th>
              <th className="px-4 py-3 text-left font-medium">N° Écriture</th>
              <th className="px-4 py-3 text-left font-medium">Pièce</th>
              <th className="px-4 py-3 text-left font-medium">Libellé</th>
              <th className="px-4 py-3 text-right font-medium">Débit</th>
              <th className="px-4 py-3 text-right font-medium">Crédit</th>
              <th className="px-4 py-3 text-right font-medium">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {/* Opening Balance Row */}
            <tr className="bg-slate-900/30">
              <td colSpan={5} className="px-4 py-2 text-sm text-slate-400 italic">
                Solde à nouveau
              </td>
              <td className="px-4 py-2 text-right font-mono text-sm text-slate-500">—</td>
              <td className="px-4 py-2 text-right font-mono text-sm text-slate-500">—</td>
              <td className="px-4 py-2 text-right font-mono text-sm text-white font-medium">
                {formatCurrency(account.opening_balance)}
              </td>
            </tr>

            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-300">
                  {formatDate(entry.entry_date)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("font-mono text-xs font-bold", journalColors[entry.journal_code] || 'text-slate-400')}>
                    {entry.journal_code}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {entry.entry_number}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {entry.piece_ref || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {entry.label}
                  {entry.counterpart_accounts && entry.counterpart_accounts.length > 0 && (
                    <span className="text-xs text-slate-500 ml-2">
                      → {entry.counterpart_accounts.join(', ')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">
                  {entry.debit > 0 ? (
                    <span className="text-emerald-400">{formatCurrency(entry.debit)}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">
                  {entry.credit > 0 ? (
                    <span className="text-rose-400">{formatCurrency(entry.credit)}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-white font-medium">
                  {formatCurrency(entry.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-white/5 font-medium">
              <td colSpan={5} className="px-4 py-3 text-sm text-slate-400">
                Totaux période
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400">
                {formatCurrency(totals.totalDebit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-rose-400">
                {formatCurrency(totals.totalCredit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-cyan-400 font-bold">
                {formatCurrency(totals.closingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {filteredEntries.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-slate-400">Aucun mouvement trouvé</p>
          <p className="text-sm text-slate-500 mt-1">
            {searchQuery ? 'Essayez avec d\'autres critères' : 'Ce compte n\'a pas de mouvements sur cette période'}
          </p>
        </div>
      )}
    </div>
  );
}

export default AccountLedgerCard;
