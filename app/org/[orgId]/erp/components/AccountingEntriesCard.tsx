'use client';

import Link from 'next/link';
import {
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/erp/formatters';

interface JournalLine {
  id: string;
  account_code: string;
  debit: number;
  credit: number;
  description: string;
}

interface AccountingEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: 'draft' | 'posted' | 'reversed' | 'locked';
  journal?: {
    journal_code: string;
    journal_name: string;
  };
  lines?: JournalLine[];
}

interface AccountingEntriesCardProps {
  orgId: string;
  entries: AccountingEntry[];
  title?: string;
  showViewAll?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    draft: {
      label: 'Brouillon',
      icon: <Clock className="h-3 w-3" />,
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    posted: {
      label: 'Validé',
      icon: <CheckCircle className="h-3 w-3" />,
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    reversed: {
      label: 'Extourné',
      icon: <XCircle className="h-3 w-3" />,
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    locked: {
      label: 'Verrouillé',
      icon: <AlertCircle className="h-3 w-3" />,
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    },
  };
  return configs[status] || configs.draft;
}

function EntryDetails({ entry, expanded }: { entry: AccountingEntry; expanded: boolean }) {
  if (!expanded || !entry.lines || entry.lines.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="text-left py-1 font-medium">Compte</th>
            <th className="text-left py-1 font-medium">Libellé</th>
            <th className="text-right py-1 font-medium">Débit</th>
            <th className="text-right py-1 font-medium">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={line.id} className="border-t border-gray-50 dark:border-gray-800">
              <td className="py-1 font-mono text-gray-600 dark:text-gray-400">{line.account_code}</td>
              <td className="py-1 text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                {line.description}
              </td>
              <td className="py-1 text-right text-gray-700 dark:text-gray-300">
                {line.debit > 0 ? formatCurrency(line.debit) : ''}
              </td>
              <td className="py-1 text-right text-gray-700 dark:text-gray-300">
                {line.credit > 0 ? formatCurrency(line.credit) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryItem({ entry }: { entry: AccountingEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = getStatusConfig(entry.status);

  return (
    <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          <button className="mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                {entry.entry_number}
              </span>
              {entry.journal && (
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                  {entry.journal.journal_code}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.className}`}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDate(entry.entry_date)} - {entry.description}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(entry.total_debit)}
          </div>
        </div>
      </div>
      <EntryDetails entry={entry} expanded={expanded} />
    </div>
  );
}

export function AccountingEntriesCard({
  orgId,
  entries,
  title = 'Écritures comptables',
  showViewAll = true,
}: AccountingEntriesCardProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          Aucune écriture comptable liée
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
          <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-medium text-indigo-700 dark:text-indigo-400">
            {entries.length}
          </span>
        </div>
        {showViewAll && (
          <Link
            href={`/org/${orgId}/erp/accounting`}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Voir tout
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <EntryItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export default AccountingEntriesCard;
