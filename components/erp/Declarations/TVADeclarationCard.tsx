'use client';

import React, { useState } from 'react';
import {
  Receipt, Calculator, FileCheck, Download, Send,
  AlertCircle, Check, Calendar, ChevronDown, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TVALine {
  code: string;
  label: string;
  base?: number;
  tva?: number;
  editable?: boolean;
  highlight?: boolean;
}

export interface TVADeclaration {
  id: string;
  period: string; // "2024-11" for November 2024
  period_label: string;
  regime: 'mensuel' | 'trimestriel';
  status: 'draft' | 'validated' | 'submitted' | 'paid';
  due_date: string;
  // CA3 Lines
  operations_imposables: TVALine[];
  tva_brute: TVALine[];
  tva_deductible: TVALine[];
  tva_nette: number;
  credit_precedent: number;
  tva_a_payer: number;
  credit_a_reporter: number;
  created_at: string;
  validated_at?: string;
  submitted_at?: string;
}

interface TVADeclarationCardProps {
  declaration: TVADeclaration;
  onValidate?: () => Promise<void>;
  onSubmit?: () => Promise<void>;
  onExportPDF?: () => void;
  onExportEDI?: () => void;
  isLoading?: boolean;
}

const statusConfig = {
  draft: { label: 'Brouillon', color: 'bg-slate-500/20 text-slate-400', icon: Calculator },
  validated: { label: 'Validée', color: 'bg-amber-500/20 text-amber-400', icon: FileCheck },
  submitted: { label: 'Télédéclarée', color: 'bg-cyan-500/20 text-cyan-400', icon: Send },
  paid: { label: 'Payée', color: 'bg-emerald-500/20 text-emerald-400', icon: Check },
};

export function TVADeclarationCard({
  declaration,
  onValidate,
  onSubmit,
  onExportPDF,
  onExportEDI,
  isLoading,
}: TVADeclarationCardProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const status = statusConfig[declaration.status];
  const StatusIcon = status.icon;

  const handleValidate = async () => {
    if (!onValidate) return;
    setIsValidating(true);
    try {
      await onValidate();
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBase = declaration.operations_imposables.reduce((sum, l) => sum + (l.base || 0), 0);
  const totalTVABrute = declaration.tva_brute.reduce((sum, l) => sum + (l.tva || 0), 0);
  const totalTVADeductible = declaration.tva_deductible.reduce((sum, l) => sum + (l.tva || 0), 0);

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-white/10 rounded w-64" />
            <div className="h-8 bg-white/10 rounded w-32" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white/5 rounded-xl" />
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
              <Receipt size={24} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Déclaration de TVA (CA3)</h2>
              <p className="text-sm text-slate-400">
                {declaration.period_label} • Régime {declaration.regime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn("px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm", status.color)}>
              <StatusIcon size={14} />
              {status.label}
            </div>

            <div className="flex items-center gap-1 text-sm text-slate-400">
              <Calendar size={14} />
              Échéance: {formatDate(declaration.due_date)}
            </div>
          </div>
        </div>
      </div>

      {/* CA3 Form */}
      <div className="p-6 space-y-6">
        {/* Section A - Opérations imposables */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">A</span>
            Opérations imposables (HT)
          </h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">Ligne</th>
                  <th className="px-4 py-2 text-left font-medium">Désignation</th>
                  <th className="px-4 py-2 text-right font-medium">Base HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {declaration.operations_imposables.map((line) => (
                  <tr key={line.code} className={cn(line.highlight && "bg-blue-500/5")}>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-cyan-400">{line.code}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-300">{line.label}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-white">
                      {formatCurrency(line.base || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-medium">
                  <td colSpan={2} className="px-4 py-2 text-sm text-slate-400">Total base imposable</td>
                  <td className="px-4 py-2 text-right font-mono text-sm text-cyan-400">
                    {formatCurrency(totalBase)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section B - TVA Brute */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold">B</span>
            TVA brute
          </h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">Ligne</th>
                  <th className="px-4 py-2 text-left font-medium">Désignation</th>
                  <th className="px-4 py-2 text-right font-medium">Base</th>
                  <th className="px-4 py-2 text-right font-medium">TVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {declaration.tva_brute.map((line) => (
                  <tr key={line.code} className={cn(line.highlight && "bg-rose-500/5")}>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-cyan-400">{line.code}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-300">{line.label}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-slate-400">
                      {line.base ? formatCurrency(line.base) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-rose-400">
                      {formatCurrency(line.tva || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-medium">
                  <td colSpan={3} className="px-4 py-2 text-sm text-slate-400">Total TVA brute</td>
                  <td className="px-4 py-2 text-right font-mono text-sm text-rose-400">
                    {formatCurrency(totalTVABrute)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section C - TVA Déductible */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">C</span>
            TVA déductible
          </h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">Ligne</th>
                  <th className="px-4 py-2 text-left font-medium">Désignation</th>
                  <th className="px-4 py-2 text-right font-medium">TVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {declaration.tva_deductible.map((line) => (
                  <tr key={line.code} className={cn(line.highlight && "bg-emerald-500/5")}>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-cyan-400">{line.code}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-300">{line.label}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm text-emerald-400">
                      {formatCurrency(line.tva || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/5 font-medium">
                  <td colSpan={2} className="px-4 py-2 text-sm text-slate-400">Total TVA déductible</td>
                  <td className="px-4 py-2 text-right font-mono text-sm text-emerald-400">
                    {formatCurrency(totalTVADeductible)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-slate-900/50 border border-white/10 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Récapitulatif</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">TVA brute (ligne 16)</span>
              <span className="font-mono text-rose-400">{formatCurrency(totalTVABrute)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">TVA déductible (ligne 23)</span>
              <span className="font-mono text-emerald-400">- {formatCurrency(totalTVADeductible)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">TVA nette (ligne 28)</span>
              <span className={cn(
                "font-mono font-medium",
                declaration.tva_nette >= 0 ? "text-rose-400" : "text-emerald-400"
              )}>
                {formatCurrency(declaration.tva_nette)}
              </span>
            </div>
            {declaration.credit_precedent > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Crédit de TVA antérieur (ligne 27)</span>
                <span className="font-mono text-emerald-400">- {formatCurrency(declaration.credit_precedent)}</span>
              </div>
            )}
          </div>

          {/* Final Amount */}
          <div className={cn(
            "p-4 rounded-lg flex items-center justify-between",
            declaration.tva_a_payer > 0
              ? "bg-rose-500/10 border border-rose-500/20"
              : "bg-emerald-500/10 border border-emerald-500/20"
          )}>
            <div>
              <p className="text-sm text-slate-400">
                {declaration.tva_a_payer > 0 ? 'TVA à payer (ligne 32)' : 'Crédit de TVA à reporter (ligne 25)'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                À régler avant le {formatDate(declaration.due_date)}
              </p>
            </div>
            <span className={cn(
              "text-2xl font-bold font-mono",
              declaration.tva_a_payer > 0 ? "text-rose-400" : "text-emerald-400"
            )}>
              {formatCurrency(declaration.tva_a_payer > 0 ? declaration.tva_a_payer : declaration.credit_a_reporter)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
            >
              <Download size={14} />
              PDF
            </button>
          )}
          {onExportEDI && declaration.status !== 'draft' && (
            <button
              onClick={onExportEDI}
              className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
            >
              <Download size={14} />
              EDI
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {declaration.status === 'draft' && onValidate && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              {isValidating ? (
                <div className="w-4 h-4 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
              ) : (
                <FileCheck size={14} />
              )}
              Valider
            </button>
          )}

          {declaration.status === 'validated' && onSubmit && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Télédéclarer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TVADeclarationCard;
