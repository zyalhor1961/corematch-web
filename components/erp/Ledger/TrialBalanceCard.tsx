'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale, Search, Download, ChevronDown, ChevronRight,
  Calendar, Filter, AlertCircle, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrialBalanceAccount {
  code: string;
  name: string;
  class: number; // PCG class (1-7)
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

interface TrialBalanceCardProps {
  accounts: TrialBalanceAccount[];
  periodLabel: string;
  onAccountClick?: (accountCode: string) => void;
  onExport?: () => void;
  isLoading?: boolean;
}

const classConfig: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Capitaux', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  2: { label: 'Immobilisations', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  3: { label: 'Stocks', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  4: { label: 'Tiers', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  5: { label: 'Financiers', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  6: { label: 'Charges', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  7: { label: 'Produits', color: 'text-green-400', bg: 'bg-green-500/10' },
};

export function TrialBalanceCard({
  accounts,
  periodLabel,
  onAccountClick,
  onExport,
  isLoading,
}: TrialBalanceCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [viewMode, setViewMode] = useState<'all' | 'movements' | 'balances'>('all');

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '—';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const toggleClass = (classNum: number) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classNum)) {
        next.delete(classNum);
      } else {
        next.add(classNum);
      }
      return next;
    });
  };

  // Filter and group accounts
  const { groupedAccounts, totals, isBalanced } = useMemo(() => {
    let filtered = accounts;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = accounts.filter(a =>
        a.code.includes(query) ||
        a.name.toLowerCase().includes(query)
      );
    }

    // View mode filter
    if (viewMode === 'movements') {
      filtered = filtered.filter(a => a.period_debit > 0 || a.period_credit > 0);
    } else if (viewMode === 'balances') {
      filtered = filtered.filter(a => a.closing_debit > 0 || a.closing_credit > 0);
    }

    // Group by class
    const grouped = new Map<number, TrialBalanceAccount[]>();
    filtered.forEach(account => {
      const classNum = account.class;
      if (!grouped.has(classNum)) {
        grouped.set(classNum, []);
      }
      grouped.get(classNum)!.push(account);
    });

    // Sort accounts within each class
    grouped.forEach((accts, classNum) => {
      accts.sort((a, b) => a.code.localeCompare(b.code));
    });

    // Calculate totals
    const totals = {
      opening_debit: filtered.reduce((sum, a) => sum + a.opening_debit, 0),
      opening_credit: filtered.reduce((sum, a) => sum + a.opening_credit, 0),
      period_debit: filtered.reduce((sum, a) => sum + a.period_debit, 0),
      period_credit: filtered.reduce((sum, a) => sum + a.period_credit, 0),
      closing_debit: filtered.reduce((sum, a) => sum + a.closing_debit, 0),
      closing_credit: filtered.reduce((sum, a) => sum + a.closing_credit, 0),
    };

    const isBalanced =
      Math.abs(totals.opening_debit - totals.opening_credit) < 0.01 &&
      Math.abs(totals.period_debit - totals.period_credit) < 0.01 &&
      Math.abs(totals.closing_debit - totals.closing_credit) < 0.01;

    return { groupedAccounts: grouped, totals, isBalanced };
  }, [accounts, searchQuery, viewMode]);

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="h-8 bg-white/10 rounded w-32" />
          </div>
          <div className="h-12 bg-white/5 rounded-lg" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="h-10 bg-white/5 rounded" />
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
              <Scale size={24} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Balance Générale</h2>
              <p className="text-sm text-slate-400">{periodLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Balance Status */}
            <div className={cn(
              "px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm",
              isBalanced
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            )}>
              {isBalanced ? <Check size={14} /> : <AlertCircle size={14} />}
              {isBalanced ? 'Équilibrée' : 'Déséquilibrée'}
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

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par compte ou libellé..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* View Mode */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {[
              { value: 'all', label: 'Tous' },
              { value: 'movements', label: 'Mouvements' },
              { value: 'balances', label: 'Soldes' },
            ].map(mode => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value as typeof viewMode)}
                className={cn(
                  "px-3 py-2 text-sm transition-colors",
                  viewMode === mode.value
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 text-xs text-slate-500">
              <th className="px-4 py-3 text-left font-medium w-24">Compte</th>
              <th className="px-4 py-3 text-left font-medium">Libellé</th>
              <th colSpan={2} className="px-4 py-3 text-center font-medium border-l border-white/10">
                Solde initial
              </th>
              <th colSpan={2} className="px-4 py-3 text-center font-medium border-l border-white/10">
                Mouvements période
              </th>
              <th colSpan={2} className="px-4 py-3 text-center font-medium border-l border-white/10">
                Solde final
              </th>
            </tr>
            <tr className="bg-white/5 text-xs text-slate-500 border-t border-white/10">
              <th colSpan={2}></th>
              <th className="px-4 py-2 text-right font-medium border-l border-white/10">Débit</th>
              <th className="px-4 py-2 text-right font-medium">Crédit</th>
              <th className="px-4 py-2 text-right font-medium border-l border-white/10">Débit</th>
              <th className="px-4 py-2 text-right font-medium">Crédit</th>
              <th className="px-4 py-2 text-right font-medium border-l border-white/10">Débit</th>
              <th className="px-4 py-2 text-right font-medium">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map(classNum => {
              const classAccounts = groupedAccounts.get(classNum) || [];
              if (classAccounts.length === 0) return null;

              const config = classConfig[classNum];
              const isExpanded = expandedClasses.has(classNum);

              // Class totals
              const classTotals = {
                opening_debit: classAccounts.reduce((sum, a) => sum + a.opening_debit, 0),
                opening_credit: classAccounts.reduce((sum, a) => sum + a.opening_credit, 0),
                period_debit: classAccounts.reduce((sum, a) => sum + a.period_debit, 0),
                period_credit: classAccounts.reduce((sum, a) => sum + a.period_credit, 0),
                closing_debit: classAccounts.reduce((sum, a) => sum + a.closing_debit, 0),
                closing_credit: classAccounts.reduce((sum, a) => sum + a.closing_credit, 0),
              };

              return (
                <React.Fragment key={classNum}>
                  {/* Class Header */}
                  <tr
                    className={cn("cursor-pointer hover:bg-white/5 transition-colors", config.bg)}
                    onClick={() => toggleClass(classNum)}
                  >
                    <td colSpan={2} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className={cn("font-bold", config.color)}>Classe {classNum}</span>
                        <span className="text-slate-300 font-medium">{config.label}</span>
                        <span className="text-slate-500 text-xs">({classAccounts.length} comptes)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400 border-l border-white/10">
                      {formatCurrency(classTotals.opening_debit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-rose-400">
                      {formatCurrency(classTotals.opening_credit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400 border-l border-white/10">
                      {formatCurrency(classTotals.period_debit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-rose-400">
                      {formatCurrency(classTotals.period_credit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400 font-medium border-l border-white/10">
                      {formatCurrency(classTotals.closing_debit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-rose-400 font-medium">
                      {formatCurrency(classTotals.closing_credit)}
                    </td>
                  </tr>

                  {/* Account Rows */}
                  {isExpanded && classAccounts.map(account => (
                    <tr
                      key={account.code}
                      className="hover:bg-white/5 transition-colors cursor-pointer border-t border-white/5"
                      onClick={() => onAccountClick?.(account.code)}
                    >
                      <td className="px-4 py-2 pl-10">
                        <span className="font-mono text-sm text-cyan-400">{account.code}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-300">{account.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-400 border-l border-white/10">
                        {formatCurrency(account.opening_debit)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">
                        {formatCurrency(account.opening_credit)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-400 border-l border-white/10">
                        {formatCurrency(account.period_debit)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">
                        {formatCurrency(account.period_credit)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-white border-l border-white/10">
                        {formatCurrency(account.closing_debit)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-white">
                        {formatCurrency(account.closing_credit)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/50 font-bold border-t-2 border-white/20">
              <td colSpan={2} className="px-4 py-3 text-white">TOTAUX GÉNÉRAUX</td>
              <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400 border-l border-white/10">
                {formatCurrency(totals.opening_debit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-rose-400">
                {formatCurrency(totals.opening_credit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400 border-l border-white/10">
                {formatCurrency(totals.period_debit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-rose-400">
                {formatCurrency(totals.period_credit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400 border-l border-white/10">
                {formatCurrency(totals.closing_debit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-rose-400">
                {formatCurrency(totals.closing_credit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default TrialBalanceCard;
