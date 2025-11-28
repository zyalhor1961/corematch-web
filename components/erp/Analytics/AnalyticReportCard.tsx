'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Download,
  ChevronDown, Filter, Building2, Briefcase, FolderTree, MapPin, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticAxis, AnalyticValue } from './AnalyticAxesCard';

export interface AnalyticData {
  axis_id: string;
  value_id: string;
  period: string; // YYYY-MM format
  amount: number;
  transaction_count: number;
}

interface AnalyticReportCardProps {
  axes: AnalyticAxis[];
  data: AnalyticData[];
  selectedAxisId?: string;
  onAxisChange?: (axisId: string) => void;
  onExport?: () => void;
  isLoading?: boolean;
}

const axisTypeIcons = {
  cost_center: Building2,
  project: Briefcase,
  department: FolderTree,
  location: MapPin,
  custom: Layers,
};

const periodOptions = [
  { id: 'month', label: 'Ce mois' },
  { id: 'quarter', label: 'Ce trimestre' },
  { id: 'year', label: 'Cette année' },
  { id: 'custom', label: 'Personnalisé' },
];

export function AnalyticReportCard({
  axes,
  data,
  selectedAxisId,
  onAxisChange,
  onExport,
  isLoading,
}: AnalyticReportCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [showAxisDropdown, setShowAxisDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const selectedAxis = axes.find(a => a.id === selectedAxisId) || axes[0];
  const AxisIcon = selectedAxis ? axisTypeIcons[selectedAxis.type] : Layers;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  };

  // Aggregate data by value
  const aggregatedData = useMemo(() => {
    if (!selectedAxis) return [];

    const valueMap = new Map<string, { amount: number; count: number; budget: number }>();

    // Initialize with all values from the axis
    selectedAxis.values.forEach(v => {
      valueMap.set(v.id, {
        amount: 0,
        count: 0,
        budget: v.budget || 0,
      });
    });

    // Aggregate data
    data
      .filter(d => d.axis_id === selectedAxis.id)
      .forEach(d => {
        const existing = valueMap.get(d.value_id);
        if (existing) {
          existing.amount += d.amount;
          existing.count += d.transaction_count;
        }
      });

    // Convert to array with value info
    return selectedAxis.values
      .filter(v => v.is_active)
      .map(v => {
        const stats = valueMap.get(v.id) || { amount: 0, count: 0, budget: 0 };
        return {
          ...v,
          spent: stats.amount,
          transactions: stats.count,
          budget: v.budget || stats.budget,
          percentUsed: v.budget ? (stats.amount / v.budget) * 100 : 0,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [selectedAxis, data]);

  const totalSpent = aggregatedData.reduce((sum, v) => sum + v.spent, 0);
  const totalBudget = aggregatedData.reduce((sum, v) => sum + v.budget, 0);
  const totalTransactions = aggregatedData.reduce((sum, v) => sum + v.transactions, 0);

  // Find max for bar scaling
  const maxAmount = Math.max(...aggregatedData.map(v => v.spent), 1);

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-6 bg-white/10 rounded w-1/3" />
            <div className="h-8 bg-white/10 rounded w-32" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded-xl" />
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20">
              <BarChart3 size={20} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Analyse par axe</h3>
              <p className="text-sm text-slate-400">Répartition des charges</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                <Calendar size={14} />
                {periodOptions.find(p => p.id === selectedPeriod)?.label}
                <ChevronDown size={14} />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 z-10 mt-1 w-40 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {periodOptions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPeriod(p.id);
                        setShowPeriodDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                        p.id === selectedPeriod ? "bg-white/10 text-white" : "text-slate-300"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Axis Selector */}
            <div className="relative">
              <button
                onClick={() => setShowAxisDropdown(!showAxisDropdown)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                <Filter size={14} />
                {selectedAxis?.name || 'Sélectionner un axe'}
                <ChevronDown size={14} />
              </button>
              {showAxisDropdown && (
                <div className="absolute right-0 z-10 mt-1 w-56 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {axes.filter(a => a.is_active).map(a => {
                    const Icon = axisTypeIcons[a.type];
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          onAxisChange?.(a.id);
                          setShowAxisDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2",
                          a.id === selectedAxis?.id ? "bg-white/10 text-white" : "text-slate-300"
                        )}
                      >
                        <Icon size={14} className="text-slate-500" />
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Export */}
            {onExport && (
              <button
                onClick={onExport}
                className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Download size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Total dépensé</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalSpent)}</p>
            {totalBudget > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                sur {formatCurrency(totalBudget)} budgeté
              </p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Consommation budget</p>
            <p className={cn(
              "text-2xl font-bold",
              totalBudget > 0 && (totalSpent / totalBudget) > 0.9 ? "text-rose-400" :
              totalBudget > 0 && (totalSpent / totalBudget) > 0.7 ? "text-amber-400" :
              "text-emerald-400"
            )}>
              {totalBudget > 0 ? formatPercent((totalSpent / totalBudget) * 100) : '—'}
            </p>
            {totalBudget > 0 && totalSpent > totalBudget && (
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <TrendingUp size={12} />
                Dépassement de {formatCurrency(totalSpent - totalBudget)}
              </p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Transactions</p>
            <p className="text-2xl font-bold text-white">{totalTransactions}</p>
            <p className="text-xs text-slate-400 mt-1">
              {aggregatedData.length} valeur{aggregatedData.length > 1 ? 's' : ''} active{aggregatedData.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="p-4">
        {aggregatedData.length > 0 ? (
          <div className="space-y-3">
            {aggregatedData.map((item, index) => {
              const barWidth = (item.spent / maxAmount) * 100;
              const isOverBudget = item.budget > 0 && item.spent > item.budget;
              const budgetPercent = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 text-sm font-mono">#{index + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{item.code}</span>
                          <span className="font-medium text-white">{item.name}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {item.transactions} transaction{item.transactions > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{formatCurrency(item.spent)}</p>
                      {item.budget > 0 && (
                        <p className={cn(
                          "text-xs flex items-center justify-end gap-1",
                          isOverBudget ? "text-rose-400" : "text-slate-400"
                        )}>
                          {isOverBudget ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {formatPercent(budgetPercent)} du budget
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isOverBudget
                          ? "bg-gradient-to-r from-rose-500 to-red-500"
                          : budgetPercent > 80
                            ? "bg-gradient-to-r from-amber-500 to-orange-500"
                            : "bg-gradient-to-r from-cyan-500 to-emerald-500"
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Budget indicator line */}
                  {item.budget > 0 && (
                    <div className="relative h-0 mt-1">
                      <div
                        className="absolute -top-3 w-0.5 h-2 bg-white/50"
                        style={{ left: `${Math.min((item.budget / maxAmount) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 mb-1">Aucune donnée pour cette période</p>
            <p className="text-sm text-slate-500">
              Les données apparaîtront une fois les dépenses ventilées
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticReportCard;
