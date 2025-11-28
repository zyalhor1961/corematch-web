'use client';

import React, { useState } from 'react';
import {
  PieChart, Plus, Trash2, AlertCircle, Check, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticAxis, AnalyticValue } from './AnalyticAxesCard';

export interface VentilationLine {
  id: string;
  axis_id: string;
  value_id: string;
  percentage: number;
  amount?: number;
}

export interface ExpenseVentilation {
  id: string;
  expense_id: string;
  expense_label: string;
  expense_date: string;
  total_amount: number;
  lines: VentilationLine[];
  is_complete: boolean;
}

interface VentilationCardProps {
  expense: ExpenseVentilation;
  axes: AnalyticAxis[];
  onChange: (lines: VentilationLine[]) => void;
  onSave: () => Promise<void>;
  isEditing?: boolean;
}

export function VentilationCard({
  expense,
  axes,
  onChange,
  onSave,
  isEditing = true,
}: VentilationCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [openAxisDropdown, setOpenAxisDropdown] = useState<string | null>(null);
  const [openValueDropdown, setOpenValueDropdown] = useState<string | null>(null);

  const totalPercentage = expense.lines.reduce((sum, l) => sum + l.percentage, 0);
  const isComplete = totalPercentage === 100;
  const hasOverflow = totalPercentage > 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const addLine = () => {
    const firstAxis = axes.find(a => a.is_active && a.values.length > 0);
    if (!firstAxis) return;

    const remainingPercentage = Math.max(0, 100 - totalPercentage);
    const newLine: VentilationLine = {
      id: Date.now().toString(),
      axis_id: firstAxis.id,
      value_id: firstAxis.values[0]?.id || '',
      percentage: remainingPercentage,
      amount: (expense.total_amount * remainingPercentage) / 100,
    };
    onChange([...expense.lines, newLine]);
  };

  const updateLine = (lineId: string, updates: Partial<VentilationLine>) => {
    const updated = expense.lines.map(line => {
      if (line.id !== lineId) return line;
      const newLine = { ...line, ...updates };
      if (updates.percentage !== undefined) {
        newLine.amount = (expense.total_amount * updates.percentage) / 100;
      }
      return newLine;
    });
    onChange(updated);
  };

  const removeLine = (lineId: string) => {
    onChange(expense.lines.filter(l => l.id !== lineId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const getAxisById = (id: string) => axes.find(a => a.id === id);
  const getValueById = (axisId: string, valueId: string) => {
    const axis = getAxisById(axisId);
    return axis?.values.find(v => v.id === valueId);
  };

  const activeAxes = axes.filter(a => a.is_active && a.values.length > 0);

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
            <PieChart size={18} className="text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">Ventilation analytique</h4>
            <p className="text-xs text-slate-500">{expense.expense_label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">
            {formatCurrency(expense.total_amount)}
          </span>
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1",
            isComplete ? "bg-emerald-500/20 text-emerald-400" :
            hasOverflow ? "bg-rose-500/20 text-rose-400" :
            "bg-amber-500/20 text-amber-400"
          )}>
            {isComplete ? <Check size={12} /> : <AlertCircle size={12} />}
            {totalPercentage}%
          </div>
        </div>
      </div>

      {/* Ventilation Lines */}
      <div className="p-4 space-y-3">
        {expense.lines.length > 0 ? (
          expense.lines.map((line) => {
            const axis = getAxisById(line.axis_id);
            const value = getValueById(line.axis_id, line.value_id);

            return (
              <div
                key={line.id}
                className="p-3 rounded-xl bg-slate-900/50 border border-white/5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  {/* Axis Selector */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setOpenAxisDropdown(openAxisDropdown === line.id ? null : line.id)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-left flex items-center justify-between text-sm"
                      disabled={!isEditing}
                    >
                      <span className="text-slate-300">{axis?.name || 'Sélectionner un axe'}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                    {openAxisDropdown === line.id && (
                      <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                        {activeAxes.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              updateLine(line.id, {
                                axis_id: a.id,
                                value_id: a.values[0]?.id || '',
                              });
                              setOpenAxisDropdown(null);
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                              a.id === line.axis_id ? "bg-white/10 text-white" : "text-slate-300"
                            )}
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Value Selector */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setOpenValueDropdown(openValueDropdown === line.id ? null : line.id)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-left flex items-center justify-between text-sm"
                      disabled={!isEditing || !axis}
                    >
                      <span className="text-slate-300">{value?.name || 'Sélectionner une valeur'}</span>
                      <ChevronDown size={14} className="text-slate-500" />
                    </button>
                    {openValueDropdown === line.id && axis && (
                      <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {axis.values.filter(v => v.is_active).map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              updateLine(line.id, { value_id: v.id });
                              setOpenValueDropdown(null);
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                              v.id === line.value_id ? "bg-white/10 text-white" : "text-slate-300"
                            )}
                          >
                            <span className="font-mono text-xs text-slate-500 mr-2">{v.code}</span>
                            {v.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Percentage and Amount */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={line.percentage}
                        onChange={(e) => updateLine(line.id, { percentage: parseInt(e.target.value) })}
                        disabled={!isEditing}
                        className="flex-1 h-2 rounded-full appearance-none bg-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-400 [&::-webkit-slider-thumb]:to-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <div className="w-16">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={line.percentage}
                          onChange={(e) => updateLine(line.id, { percentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                          disabled={!isEditing}
                          className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm text-center"
                        />
                      </div>
                      <span className="text-slate-500 text-sm">%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                        style={{ width: `${line.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-28 text-right">
                    <span className="text-white font-medium">
                      {formatCurrency(line.amount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm mb-2">Aucune ventilation définie</p>
            <p className="text-slate-600 text-xs">
              Ajoutez des lignes pour répartir cette dépense sur vos axes analytiques
            </p>
          </div>
        )}

        {/* Add Line Button */}
        {isEditing && activeAxes.length > 0 && (
          <button
            type="button"
            onClick={addLine}
            className="w-full p-3 rounded-xl border border-dashed border-white/10 text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={14} />
            Ajouter une ligne de ventilation
          </button>
        )}

        {/* Warning Messages */}
        {hasOverflow && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-sm">
            <AlertCircle size={16} />
            Le total dépasse 100% ({totalPercentage}%)
          </div>
        )}

        {!isComplete && !hasOverflow && expense.lines.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-amber-400 text-sm">
            <AlertCircle size={16} />
            {100 - totalPercentage}% restant à ventiler
          </div>
        )}
      </div>

      {/* Footer */}
      {isEditing && (
        <div className="p-4 border-t border-white/10 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !isComplete}
            className={cn(
              "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all",
              isComplete
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check size={16} />
                Valider la ventilation
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default VentilationCard;
