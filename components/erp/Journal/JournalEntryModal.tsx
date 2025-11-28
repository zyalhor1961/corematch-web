'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, BookOpen, Plus, Trash2, AlertCircle, Save, Calculator,
  ChevronDown, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JournalEntry, JournalLine } from './JournalEntryCard';

interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}

interface Journal {
  code: string;
  name: string;
  type: 'purchases' | 'sales' | 'bank' | 'cash' | 'general' | 'closing';
}

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<JournalEntry>) => Promise<void>;
  entry?: JournalEntry | null;
  accounts: Account[];
  journals: Journal[];
}

// Common PCG accounts for quick access
const commonAccounts: Account[] = [
  { code: '401000', name: 'Fournisseurs', type: 'liability' },
  { code: '411000', name: 'Clients', type: 'asset' },
  { code: '512000', name: 'Banque', type: 'asset' },
  { code: '530000', name: 'Caisse', type: 'asset' },
  { code: '601000', name: 'Achats matières premières', type: 'expense' },
  { code: '606000', name: 'Achats non stockés', type: 'expense' },
  { code: '606400', name: 'Fournitures administratives', type: 'expense' },
  { code: '613000', name: 'Locations', type: 'expense' },
  { code: '615000', name: 'Entretien et réparations', type: 'expense' },
  { code: '616000', name: 'Primes d\'assurance', type: 'expense' },
  { code: '622000', name: 'Honoraires', type: 'expense' },
  { code: '625000', name: 'Déplacements', type: 'expense' },
  { code: '626000', name: 'Frais postaux et télécom', type: 'expense' },
  { code: '627000', name: 'Services bancaires', type: 'expense' },
  { code: '641000', name: 'Rémunération du personnel', type: 'expense' },
  { code: '645000', name: 'Charges sociales', type: 'expense' },
  { code: '706000', name: 'Prestations de services', type: 'revenue' },
  { code: '707000', name: 'Vente de marchandises', type: 'revenue' },
  { code: '445660', name: 'TVA déductible', type: 'asset' },
  { code: '445710', name: 'TVA collectée', type: 'liability' },
];

const defaultJournals: Journal[] = [
  { code: 'AC', name: 'Journal des achats', type: 'purchases' },
  { code: 'VE', name: 'Journal des ventes', type: 'sales' },
  { code: 'BQ', name: 'Journal de banque', type: 'bank' },
  { code: 'CA', name: 'Journal de caisse', type: 'cash' },
  { code: 'OD', name: 'Opérations diverses', type: 'general' },
  { code: 'AN', name: 'À nouveaux', type: 'closing' },
];

export function JournalEntryModal({
  isOpen,
  onClose,
  onSave,
  entry,
  accounts = commonAccounts,
  journals = defaultJournals,
}: JournalEntryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [journalCode, setJournalCode] = useState('AC');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [pieceRef, setPieceRef] = useState('');
  const [label, setLabel] = useState('');
  const [lines, setLines] = useState<Partial<JournalLine>[]>([
    { id: '1', account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
    { id: '2', account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
  ]);

  // Account search state
  const [searchingLineId, setSearchingLineId] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (entry) {
        setJournalCode(entry.journal_code);
        setEntryDate(entry.entry_date);
        setPieceRef(entry.piece_ref || '');
        setLabel(entry.label);
        setLines(entry.lines.length > 0 ? entry.lines : [
          { id: '1', account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
          { id: '2', account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
        ]);
      } else {
        setJournalCode('AC');
        setEntryDate(new Date().toISOString().split('T')[0]);
        setPieceRef('');
        setLabel('');
        setLines([
          { id: '1', account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
          { id: '2', account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
        ]);
      }
    }
  }, [isOpen, entry]);

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasEmptyAccounts = lines.some(l => !l.account_code);

  const addLine = () => {
    setLines(prev => [
      ...prev,
      { id: Date.now().toString(), account_code: '', account_name: '', label: '', debit: 0, credit: 0 },
    ]);
  };

  const removeLine = (lineId: string) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const updateLine = (lineId: string, updates: Partial<JournalLine>) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, ...updates } : l));
  };

  const selectAccount = (lineId: string, account: Account) => {
    updateLine(lineId, {
      account_code: account.code,
      account_name: account.name,
    });
    setSearchingLineId(null);
    setAccountSearch('');
  };

  const filteredAccounts = accountSearch
    ? accounts.filter(a =>
        a.code.includes(accountSearch) ||
        a.name.toLowerCase().includes(accountSearch.toLowerCase())
      )
    : accounts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError('Le libellé est obligatoire');
      return;
    }

    if (hasEmptyAccounts) {
      setError('Tous les comptes doivent être renseignés');
      return;
    }

    if (!isBalanced) {
      setError('L\'écriture doit être équilibrée (Débit = Crédit)');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedJournal = journals.find(j => j.code === journalCode);
      await onSave({
        ...(entry && { id: entry.id }),
        journal_code: journalCode,
        journal_name: selectedJournal?.name || '',
        entry_date: entryDate,
        piece_ref: pieceRef || undefined,
        label: label.trim(),
        lines: lines as JournalLine[],
        status: 'draft',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-balance helper
  const autoBalance = () => {
    const diff = totalDebit - totalCredit;
    if (diff === 0) return;

    // Find last line without amount
    const lastEmptyLine = [...lines].reverse().find(l => l.debit === 0 && l.credit === 0);
    if (lastEmptyLine) {
      if (diff > 0) {
        updateLine(lastEmptyLine.id!, { credit: diff });
      } else {
        updateLine(lastEmptyLine.id!, { debit: Math.abs(diff) });
      }
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 backdrop-blur-xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <BookOpen size={20} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {entry ? 'Modifier l\'écriture' : 'Nouvelle écriture comptable'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Header Fields */}
          <div className="grid grid-cols-4 gap-4">
            {/* Journal */}
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">Journal</label>
              <div className="relative">
                <select
                  value={journalCode}
                  onChange={(e) => setJournalCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {journals.map(j => (
                    <option key={j.code} value={j.code} className="bg-slate-800">
                      {j.code} - {j.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Piece Reference */}
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">N° Pièce</label>
              <input
                type="text"
                value={pieceRef}
                onChange={(e) => setPieceRef(e.target.value)}
                placeholder="FAC-2024-001"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Label */}
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">Libellé *</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Achat fournitures"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Lignes d'écriture</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoBalance}
                  disabled={isBalanced}
                  className="px-3 py-1 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Calculator size={12} />
                  Équilibrer
                </button>
                <button
                  type="button"
                  onClick={addLine}
                  className="px-3 py-1 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-xs transition-colors flex items-center gap-1"
                >
                  <Plus size={12} />
                  Ajouter
                </button>
              </div>
            </div>

            {/* Lines Table */}
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 text-xs text-slate-500">
                    <th className="px-3 py-2 text-left font-medium w-48">Compte</th>
                    <th className="px-3 py-2 text-left font-medium">Libellé ligne</th>
                    <th className="px-3 py-2 text-right font-medium w-32">Débit</th>
                    <th className="px-3 py-2 text-right font-medium w-32">Crédit</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lines.map((line) => (
                    <tr key={line.id} className="group">
                      {/* Account */}
                      <td className="px-3 py-2 relative">
                        <div
                          className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                          onClick={() => setSearchingLineId(searchingLineId === line.id ? null : line.id!)}
                        >
                          {line.account_code ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-cyan-400">{line.account_code}</span>
                              <span className="text-xs text-slate-400 truncate">{line.account_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Sélectionner...</span>
                          )}
                        </div>

                        {/* Account Dropdown */}
                        {searchingLineId === line.id && (
                          <div className="absolute z-20 left-3 right-3 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-white/10">
                              <div className="relative">
                                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                  type="text"
                                  value={accountSearch}
                                  onChange={(e) => setAccountSearch(e.target.value)}
                                  placeholder="Rechercher..."
                                  className="w-full pl-7 pr-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredAccounts.slice(0, 10).map(account => (
                                <button
                                  key={account.code}
                                  type="button"
                                  onClick={() => selectAccount(line.id!, account)}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                  <span className="font-mono text-cyan-400">{account.code}</span>
                                  <span className="text-slate-300">{account.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Line Label */}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.label || ''}
                          onChange={(e) => updateLine(line.id!, { label: e.target.value })}
                          placeholder="Libellé..."
                          className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                      </td>

                      {/* Debit */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(line.id!, {
                            debit: parseFloat(e.target.value) || 0,
                            credit: parseFloat(e.target.value) > 0 ? 0 : line.credit,
                          })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-emerald-400 text-xs text-right font-mono placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                      </td>

                      {/* Credit */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(line.id!, {
                            credit: parseFloat(e.target.value) || 0,
                            debit: parseFloat(e.target.value) > 0 ? 0 : line.debit,
                          })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-rose-400 text-xs text-right font-mono placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                        />
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id!)}
                          disabled={lines.length <= 2}
                          className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/5">
                    <td colSpan={2} className="px-3 py-2 text-sm font-medium text-slate-400">Total</td>
                    <td className="px-3 py-2 text-right font-mono text-sm text-emerald-400 font-medium">
                      {totalDebit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm text-rose-400 font-medium">
                      {totalCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balance Status */}
            <div className={cn(
              "p-3 rounded-lg flex items-center justify-between text-sm",
              isBalanced
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-amber-500/10 border border-amber-500/20"
            )}>
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <span className="text-emerald-400">Écriture équilibrée</span>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-amber-400" />
                    <span className="text-amber-400">
                      Écart de {Math.abs(totalDebit - totalCredit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </>
                )}
              </div>
              <span className="text-slate-500 text-xs">
                Débit - Crédit = {(totalDebit - totalCredit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isBalanced || hasEmptyAccounts}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {entry ? 'Modifier' : 'Enregistrer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default JournalEntryModal;
