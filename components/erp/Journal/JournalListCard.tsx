'use client';

import React, { useState, useMemo } from 'react';
import {
  BookOpen, Search, Filter, Calendar, Download, Plus,
  ChevronDown, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JournalEntryCard, type JournalEntry } from './JournalEntryCard';

interface JournalListCardProps {
  entries: JournalEntry[];
  onAdd: () => void;
  onEdit: (entry: JournalEntry) => void;
  onValidate: (entryId: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onDuplicate: (entry: JournalEntry) => void;
  onRefresh: () => void;
  onExport: () => void;
  isLoading?: boolean;
}

const journalOptions = [
  { code: 'ALL', name: 'Tous les journaux' },
  { code: 'AC', name: 'Achats' },
  { code: 'VE', name: 'Ventes' },
  { code: 'BQ', name: 'Banque' },
  { code: 'CA', name: 'Caisse' },
  { code: 'OD', name: 'Op. diverses' },
  { code: 'AN', name: 'À nouveaux' },
];

const statusOptions = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'validated', label: 'Validées' },
  { value: 'posted', label: 'Comptabilisées' },
];

const periodOptions = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
];

export function JournalListCard({
  entries,
  onAdd,
  onEdit,
  onValidate,
  onDelete,
  onDuplicate,
  onRefresh,
  onExport,
  isLoading,
}: JournalListCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJournal, setSelectedJournal] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showJournalDropdown, setShowJournalDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Journal filter
      if (selectedJournal !== 'ALL' && entry.journal_code !== selectedJournal) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && entry.status !== selectedStatus) {
        return false;
      }

      // Period filter (simplified)
      if (selectedPeriod !== 'all') {
        const entryDate = new Date(entry.entry_date);
        const now = new Date();

        if (selectedPeriod === 'month') {
          if (entryDate.getMonth() !== now.getMonth() || entryDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (selectedPeriod === 'quarter') {
          const entryQuarter = Math.floor(entryDate.getMonth() / 3);
          const currentQuarter = Math.floor(now.getMonth() / 3);
          if (entryQuarter !== currentQuarter || entryDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (selectedPeriod === 'year') {
          if (entryDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          entry.entry_number.toLowerCase().includes(query) ||
          entry.label.toLowerCase().includes(query) ||
          entry.piece_ref?.toLowerCase().includes(query) ||
          entry.lines.some(l =>
            l.account_code.includes(query) ||
            l.account_name.toLowerCase().includes(query) ||
            l.label.toLowerCase().includes(query)
          )
        );
      }

      return true;
    });
  }, [entries, selectedJournal, selectedStatus, selectedPeriod, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const totalDebit = filteredEntries.reduce((sum, e) =>
      sum + e.lines.reduce((s, l) => s + l.debit, 0), 0
    );
    const drafts = filteredEntries.filter(e => e.status === 'draft').length;
    const validated = filteredEntries.filter(e => e.status === 'validated').length;
    const posted = filteredEntries.filter(e => e.status === 'posted').length;

    return { totalDebit, drafts, validated, posted };
  }, [filteredEntries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="h-8 bg-white/10 rounded w-32" />
          </div>
          <div className="h-12 bg-white/5 rounded-lg" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <BookOpen size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Journal Comptable</h2>
            <p className="text-sm text-slate-400">
              {filteredEntries.length} écriture{filteredEntries.length > 1 ? 's' : ''}
              {selectedJournal !== 'ALL' && ` • ${journalOptions.find(j => j.code === selectedJournal)?.name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onExport}
            className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Exporter
          </button>
          <button
            onClick={onAdd}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Nouvelle écriture
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500 mb-1">Total mouvements</p>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.totalDebit)}</p>
        </div>
        <div className="p-4 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500 mb-1">Brouillons</p>
          <p className="text-xl font-bold text-slate-400">{stats.drafts}</p>
        </div>
        <div className="p-4 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500 mb-1">Validées</p>
          <p className="text-xl font-bold text-amber-400">{stats.validated}</p>
        </div>
        <div className="p-4 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10">
          <p className="text-xs text-slate-500 mb-1">Comptabilisées</p>
          <p className="text-xl font-bold text-emerald-400">{stats.posted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par n°, libellé, compte..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Journal Filter */}
        <div className="relative">
          <button
            onClick={() => setShowJournalDropdown(!showJournalDropdown)}
            className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/10 transition-colors min-w-[140px]"
          >
            <Filter size={14} />
            {journalOptions.find(j => j.code === selectedJournal)?.name}
            <ChevronDown size={14} className="ml-auto" />
          </button>
          {showJournalDropdown && (
            <div className="absolute z-10 mt-1 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
              {journalOptions.map(j => (
                <button
                  key={j.code}
                  onClick={() => {
                    setSelectedJournal(j.code);
                    setShowJournalDropdown(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                    j.code === selectedJournal ? "bg-white/10 text-white" : "text-slate-300"
                  )}
                >
                  {j.code !== 'ALL' && <span className="font-mono text-xs text-slate-500 mr-2">{j.code}</span>}
                  {j.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/10 transition-colors min-w-[140px]"
          >
            {statusOptions.find(s => s.value === selectedStatus)?.label}
            <ChevronDown size={14} className="ml-auto" />
          </button>
          {showStatusDropdown && (
            <div className="absolute z-10 mt-1 w-40 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
              {statusOptions.map(s => (
                <button
                  key={s.value}
                  onClick={() => {
                    setSelectedStatus(s.value);
                    setShowStatusDropdown(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                    s.value === selectedStatus ? "bg-white/10 text-white" : "text-slate-300"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Period Filter */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-slate-300 hover:bg-white/10 transition-colors"
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
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onValidate={onValidate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              isExpanded={expandedEntryId === entry.id}
              onToggleExpand={() => setExpandedEntryId(
                expandedEntryId === entry.id ? null : entry.id
              )}
            />
          ))
        ) : (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 mb-1">Aucune écriture trouvée</p>
            <p className="text-sm text-slate-500">
              {searchQuery ? 'Essayez avec d\'autres critères de recherche' : 'Créez votre première écriture comptable'}
            </p>
            {!searchQuery && (
              <button
                onClick={onAdd}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Créer une écriture
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default JournalListCard;
