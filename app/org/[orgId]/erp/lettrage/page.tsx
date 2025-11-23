'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  Home,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/erp/formatters';

interface JournalEntry {
  id: string;
  entry_date: string;
  piece_number: string;
  account_code: string;
  account_label: string;
  label: string;
  debit: number;
  credit: number;
  is_lettred: boolean;
  lettrage_code: string | null;
  reference_type: string | null;
  reference_id: string | null;
  journal?: { code: string; name: string };
}

interface EntityGroup {
  entity_id: string | null;
  entity_name: string;
  account_code: string;
  entries: JournalEntry[];
  total_debit: number;
  total_credit: number;
  balance: number;
}

interface Suggestion {
  entry_ids: string[];
  total_debit: number;
  total_credit: number;
  balance: number;
  confidence: number;
  reason: string;
}

interface Stats {
  unmatched_entries: number;
  matched_entries: number;
  total_unmatched_debit: number;
  total_unmatched_credit: number;
  balance: number;
  lettrage_count: number;
}

export default function LettragePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolvedParams = use(params);
  const { orgId } = resolvedParams;

  const [accountType, setAccountType] = useState<'client' | 'supplier'>('client');
  const [status, setStatus] = useState<'unmatched' | 'matched' | 'all'>('unmatched');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [grouped, setGrouped] = useState<EntityGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [processingAuto, setProcessingAuto] = useState(false);

  useEffect(() => {
    loadData();
    loadStats();
  }, [orgId, accountType, status]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        account_type: accountType,
        status,
      });

      const res = await fetch(`/api/erp/lettrage?${params}`);
      const data = await res.json();

      if (data.success) {
        setEntries(data.data.entries || []);
        setGrouped(data.data.grouped || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        account_type: accountType,
        stats: 'true',
      });

      const res = await fetch(`/api/erp/lettrage?${params}`);
      const data = await res.json();

      if (data.success) {
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function loadSuggestions() {
    setProcessingAuto(true);
    try {
      const res = await fetch('/api/erp/lettrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          account_type: accountType,
          action: 'auto_suggest',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuggestions(data.data.suggestions || []);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setProcessingAuto(false);
    }
  }

  async function executeAutoLettrage() {
    setProcessingAuto(true);
    try {
      const res = await fetch('/api/erp/lettrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          account_type: accountType,
          action: 'auto_lettrage',
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`Lettrage automatique: ${data.data.created} lettrages créés`);
        loadData();
        loadStats();
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error in auto lettrage:', error);
    } finally {
      setProcessingAuto(false);
    }
  }

  async function createLettrage() {
    if (selectedEntries.size < 2) {
      alert('Sélectionnez au moins 2 écritures');
      return;
    }

    try {
      const res = await fetch('/api/erp/lettrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          account_type: accountType,
          action: 'create',
          entry_ids: Array.from(selectedEntries),
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`Lettrage ${data.data.code} créé (solde: ${formatCurrency(data.data.balance)})`);
        setSelectedEntries(new Set());
        loadData();
        loadStats();
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating lettrage:', error);
    }
  }

  function toggleEntry(entryId: string) {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  }

  function toggleGroup(groupKey: string) {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  }

  function getSelectionTotal() {
    const selected = entries.filter((e) => selectedEntries.has(e.id));
    const totalDebit = selected.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = selected.reduce((sum, e) => sum + (e.credit || 0), 0);
    return { debit: totalDebit, credit: totalCredit, balance: totalDebit - totalCredit };
  }

  const selectionTotal = getSelectionTotal();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <nav className="flex items-center gap-2 text-sm mb-4">
          <Link href={`/org/${orgId}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
            <Home className="h-4 w-4" />
            <span>Accueil</span>
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <Link href={`/org/${orgId}/erp`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            ERP
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">Lettrage Comptable</span>
        </nav>
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/org/${orgId}/erp`}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Lettrage Comptable
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Rapprocher les écritures des comptes {accountType === 'client' ? '411 (Clients)' : '401 (Fournisseurs)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadSuggestions}
                disabled={processingAuto}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Suggestions IA
              </button>
              <button
                onClick={executeAutoLettrage}
                disabled={processingAuto}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processingAuto ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Lettrage Auto
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Écritures non lettrées</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unmatched_entries}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Écritures lettrées</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.matched_entries}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Solde non lettré</p>
              <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(stats.balance)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lettrages effectués</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.lettrage_count}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtres:</span>
            </div>

            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setAccountType('client')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  accountType === 'client'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                411 - Clients
              </button>
              <button
                onClick={() => setAccountType('supplier')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  accountType === 'supplier'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                401 - Fournisseurs
              </button>
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="unmatched">Non lettrées</option>
              <option value="matched">Lettrées</option>
              <option value="all">Toutes</option>
            </select>

            <button
              onClick={loadData}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        {selectedEntries.size > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedEntries.size} écriture(s) sélectionnée(s)
                </span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Débit: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectionTotal.debit)}</span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Crédit: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectionTotal.credit)}</span>
                  </span>
                  <span className={`font-semibold ${Math.abs(selectionTotal.balance) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    Solde: {formatCurrency(selectionTotal.balance)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedEntries(new Set())}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={createLettrage}
                  disabled={selectedEntries.size < 2}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" />
                  Créer Lettrage
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {suggestions.length} suggestion(s) de lettrage
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {suggestions.slice(0, 10).map((suggestion, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      suggestion.confidence >= 0.9
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {suggestion.reason}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(suggestion.total_debit)}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedEntries(new Set(suggestion.entry_ids))}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Sélectionner
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grouped Entries */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Aucune écriture à lettrer
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Toutes les écritures du compte {accountType === 'client' ? '411' : '401'} sont lettrées.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => {
              const groupKey = group.entity_id || group.account_code;
              const isExpanded = expandedGroups.has(groupKey);

              return (
                <div
                  key={groupKey}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        {group.account_code}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {group.entity_name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({group.entries.length} écritures)
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-semibold ${
                        Math.abs(group.balance) < 0.01
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : group.balance > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(group.balance)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="w-10 px-4 py-2"></th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Pièce</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Libellé</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Débit</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Crédit</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Lettrage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {group.entries.map((entry) => (
                            <tr
                              key={entry.id}
                              className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                                selectedEntries.has(entry.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                            >
                              <td className="px-4 py-2">
                                {!entry.is_lettred && (
                                  <input
                                    type="checkbox"
                                    checked={selectedEntries.has(entry.id)}
                                    onChange={() => toggleEntry(entry.id)}
                                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {formatDate(entry.entry_date)}
                              </td>
                              <td className="px-4 py-2 text-sm font-mono text-gray-500 dark:text-gray-400">
                                {entry.piece_number}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {entry.label}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : ''}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : ''}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {entry.is_lettred ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                                    <Link2 className="h-3 w-3" />
                                    {entry.lettrage_code}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                    <Unlink className="h-3 w-3" />
                                    Non lettré
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Total
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(group.total_debit)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(group.total_credit)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`font-semibold text-sm ${
                                Math.abs(group.balance) < 0.01
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {formatCurrency(group.balance)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
