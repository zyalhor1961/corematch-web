'use client';

import React, { useState, useCallback } from 'react';
import { Filter, RefreshCw, Download, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransactionRow, BankTransaction } from './TransactionRow';
import { MatchSuggestionCard, MatchSuggestion } from './MatchSuggestionCard';

interface ReconciliationSplitViewProps {
  transactions: BankTransaction[];
  onMatch: (transactionId: string, suggestionId: string) => Promise<void>;
  onReject: (transactionId: string, suggestionId: string) => Promise<void>;
  onIgnore: (transactionId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onExport: () => void;
  getSuggestions: (transactionId: string) => Promise<MatchSuggestion[]>;
  isLoading?: boolean;
  bankAccountName?: string;
}

type FilterStatus = 'all' | 'unmatched' | 'suggested' | 'matched';

export function ReconciliationSplitView({
  transactions,
  onMatch,
  onReject,
  onIgnore,
  onRefresh,
  onExport,
  getSuggestions,
  isLoading,
  bankAccountName,
}: ReconciliationSplitViewProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('unmatched');

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'unmatched') return tx.reconciliation_status === 'unmatched';
    if (filterStatus === 'suggested') return tx.reconciliation_status === 'suggested';
    if (filterStatus === 'matched') return tx.reconciliation_status === 'matched';
    return true;
  });

  // Stats
  const stats = {
    total: transactions.length,
    unmatched: transactions.filter(tx => tx.reconciliation_status === 'unmatched').length,
    suggested: transactions.filter(tx => tx.reconciliation_status === 'suggested').length,
    matched: transactions.filter(tx => tx.reconciliation_status === 'matched').length,
  };

  const handleSelectTransaction = useCallback(async (transactionId: string) => {
    setSelectedTransaction(transactionId);
    setLoadingSuggestions(true);
    try {
      const newSuggestions = await getSuggestions(transactionId);
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [getSuggestions]);

  const handleMatch = async (transactionId: string, suggestionId: string) => {
    await onMatch(transactionId, suggestionId);
    setSelectedTransaction(null);
    setSuggestions([]);
  };

  const handleReject = async (transactionId: string, suggestionId: string) => {
    await onReject(transactionId, suggestionId);
    // Refresh suggestions after rejection
    const newSuggestions = await getSuggestions(transactionId);
    setSuggestions(newSuggestions);
  };

  const handleIgnore = async (transactionId: string) => {
    await onIgnore(transactionId);
    setSelectedTransaction(null);
    setSuggestions([]);
  };

  const selectedTx = selectedTransaction
    ? transactions.find(tx => tx.id === selectedTransaction)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header Stats */}
      <div className="p-4 border-b border-white/10 bg-slate-900/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Rapprochement Bancaire</h2>
            {bankAccountName && (
              <p className="text-sm text-slate-400">{bankAccountName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onExport}
              className="p-2 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => setFilterStatus('all')}
            className={cn(
              "p-3 rounded-xl border transition-all text-left",
              filterStatus === 'all'
                ? "bg-white/10 border-white/20"
                : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
            )}
          >
            <span className="text-2xl font-bold text-white">{stats.total}</span>
            <span className="text-xs text-slate-400 block mt-1">Total</span>
          </button>

          <button
            onClick={() => setFilterStatus('unmatched')}
            className={cn(
              "p-3 rounded-xl border transition-all text-left",
              filterStatus === 'unmatched'
                ? "bg-amber-500/20 border-amber-500/30"
                : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
            )}
          >
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">{stats.unmatched}</span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">Non rapproché</span>
          </button>

          <button
            onClick={() => setFilterStatus('suggested')}
            className={cn(
              "p-3 rounded-xl border transition-all text-left",
              filterStatus === 'suggested'
                ? "bg-cyan-500/20 border-cyan-500/30"
                : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-cyan-400" />
              <span className="text-2xl font-bold text-cyan-400">{stats.suggested}</span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">Suggestion</span>
          </button>

          <button
            onClick={() => setFilterStatus('matched')}
            className={cn(
              "p-3 rounded-xl border transition-all text-left",
              filterStatus === 'matched'
                ? "bg-emerald-500/20 border-emerald-500/30"
                : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
            )}
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">{stats.matched}</span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">Rapproché</span>
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Transaction List */}
        <div className="w-1/2 flex flex-col border-r border-white/10">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/20">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <span className="text-sm text-slate-400">
                {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  isSelected={selectedTransaction === tx.id}
                  onClick={() => handleSelectTransaction(tx.id)}
                />
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle size={32} className="mx-auto mb-3 opacity-50" />
                <p>Aucune transaction dans cette catégorie</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Match Suggestions */}
        <div className="w-1/2 flex flex-col bg-slate-900/20">
          <div className="p-4 border-b border-white/5">
            <span className="text-sm text-slate-400">
              {selectedTx ? 'Correspondances suggérées' : 'Sélectionnez une transaction'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedTx ? (
              <MatchSuggestionCard
                transaction={selectedTx}
                suggestions={suggestions}
                onMatch={handleMatch}
                onReject={handleReject}
                onIgnore={handleIgnore}
                isLoading={loadingSuggestions}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Filter size={24} />
                </div>
                <p className="text-center">
                  Cliquez sur une transaction à gauche<br />
                  pour voir les correspondances suggérées
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReconciliationSplitView;
