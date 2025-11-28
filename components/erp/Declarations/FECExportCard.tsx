'use client';

import React, { useState } from 'react';
import {
  FileArchive, Download, Calendar, Check, AlertCircle,
  FileText, Database, CheckCircle2, XCircle, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FECStats {
  total_entries: number;
  total_lines: number;
  total_debit: number;
  total_credit: number;
  period_start: string;
  period_end: string;
  is_balanced: boolean;
  accounts_count: number;
  journals_count: number;
}

export interface FECValidation {
  code: string;
  label: string;
  status: 'valid' | 'warning' | 'error';
  message?: string;
}

export interface FECExport {
  id: string;
  fiscal_year: string;
  company_siren: string;
  company_name: string;
  stats: FECStats;
  validations: FECValidation[];
  generated_at?: string;
  file_name?: string;
}

interface FECExportCardProps {
  exportData: FECExport;
  onGenerate: () => Promise<void>;
  onDownload?: () => void;
  onValidate?: () => Promise<void>;
  isLoading?: boolean;
}

export function FECExportCard({
  exportData,
  onGenerate,
  onDownload,
  onValidate,
  isLoading,
}: FECExportCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleValidate = async () => {
    if (!onValidate) return;
    setIsValidating(true);
    try {
      await onValidate();
    } finally {
      setIsValidating(false);
    }
  };

  const validCount = exportData.validations.filter(v => v.status === 'valid').length;
  const warningCount = exportData.validations.filter(v => v.status === 'warning').length;
  const errorCount = exportData.validations.filter(v => v.status === 'error').length;
  const isExportReady = errorCount === 0 && exportData.stats.is_balanced;

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="h-8 bg-white/10 rounded w-32" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-white/5 rounded-xl" />
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <FileArchive size={24} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Export FEC</h2>
              <p className="text-sm text-slate-400">
                Fichier des Écritures Comptables • Exercice {exportData.fiscal_year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {exportData.generated_at && (
              <span className="text-xs text-slate-500">
                Généré le {formatDate(exportData.generated_at)}
              </span>
            )}

            <div className={cn(
              "px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm",
              isExportReady
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            )}>
              {isExportReady ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {isExportReady ? 'Conforme' : 'Anomalies détectées'}
            </div>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="p-4 bg-slate-900/30 border-b border-white/10">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-slate-500">SIREN:</span>
            <span className="ml-2 font-mono text-white">{exportData.company_siren}</span>
          </div>
          <div>
            <span className="text-slate-500">Raison sociale:</span>
            <span className="ml-2 text-white">{exportData.company_name}</span>
          </div>
          <div>
            <span className="text-slate-500">Période:</span>
            <span className="ml-2 text-white">
              {formatDate(exportData.stats.period_start)} - {formatDate(exportData.stats.period_end)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6 border-b border-white/10">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Statistiques du fichier</h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <FileText size={12} />
              Écritures
            </div>
            <p className="text-xl font-bold text-white">{formatNumber(exportData.stats.total_entries)}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Database size={12} />
              Lignes
            </div>
            <p className="text-xl font-bold text-white">{formatNumber(exportData.stats.total_lines)}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Total débit</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(exportData.stats.total_debit)}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Total crédit</p>
            <p className="text-lg font-bold text-rose-400 font-mono">{formatCurrency(exportData.stats.total_credit)}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">Équilibre</p>
            <div className={cn(
              "flex items-center gap-1",
              exportData.stats.is_balanced ? "text-emerald-400" : "text-rose-400"
            )}>
              {exportData.stats.is_balanced ? <Check size={16} /> : <XCircle size={16} />}
              <span className="text-lg font-bold">
                {exportData.stats.is_balanced ? 'OK' : 'KO'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Validations */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Contrôles de conformité
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 size={12} />
              {validCount} OK
            </span>
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle size={12} />
                {warningCount} Avertissements
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-rose-400">
                <XCircle size={12} />
                {errorCount} Erreurs
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {exportData.validations.map((validation) => (
            <div
              key={validation.code}
              className={cn(
                "p-3 rounded-lg flex items-center justify-between",
                validation.status === 'valid' && "bg-emerald-500/5 border border-emerald-500/10",
                validation.status === 'warning' && "bg-amber-500/5 border border-amber-500/10",
                validation.status === 'error' && "bg-rose-500/5 border border-rose-500/10"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  validation.status === 'valid' && "bg-emerald-500/20",
                  validation.status === 'warning' && "bg-amber-500/20",
                  validation.status === 'error' && "bg-rose-500/20"
                )}>
                  {validation.status === 'valid' && <Check size={12} className="text-emerald-400" />}
                  {validation.status === 'warning' && <AlertCircle size={12} className="text-amber-400" />}
                  {validation.status === 'error' && <XCircle size={12} className="text-rose-400" />}
                </div>
                <div>
                  <p className="text-sm text-white">{validation.label}</p>
                  {validation.message && (
                    <p className="text-xs text-slate-500 mt-0.5">{validation.message}</p>
                  )}
                </div>
              </div>
              <span className="font-mono text-xs text-slate-500">{validation.code}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FEC Format Info */}
      <div className="p-4 bg-blue-500/5 border-b border-white/10">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-400 font-medium">Format FEC conforme Article A.47 A-1 du LPF</p>
            <p className="text-slate-500 mt-1">
              Le fichier sera généré au format texte (TAB séparé) avec les 18 colonnes réglementaires.
              Nom du fichier: <span className="font-mono text-slate-400">{exportData.file_name || `${exportData.company_siren}FEC${exportData.fiscal_year.replace('-', '')}.txt`}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {exportData.stats.accounts_count} comptes • {exportData.stats.journals_count} journaux
        </div>

        <div className="flex items-center gap-3">
          {onValidate && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
            >
              {isValidating ? (
                <div className="w-4 h-4 border-2 border-slate-300/20 border-t-slate-300 rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Revalider
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !isExportReady}
            className={cn(
              "px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm transition-all",
              isExportReady
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Générer le FEC
          </button>

          {exportData.generated_at && onDownload && (
            <button
              onClick={onDownload}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <FileArchive size={14} />
              Télécharger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FECExportCard;
