'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DateInput } from '@/components/ui/date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  ArrowLeft,
  Filter,
  Home,
  ChevronRight,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/erp/formatters';

interface JournalLine {
  id: string;
  account_code: string;
  debit: number;
  credit: number;
  description: string;
  partner_type?: string;
  partner_name?: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: 'draft' | 'posted' | 'reversed' | 'locked';
  source_type?: string;
  source_id?: string;
  source_ref?: string;
  journal?: {
    id: string;
    journal_code: string;
    journal_name: string;
    journal_type: string;
  };
  lines?: JournalLine[];
}

interface Journal {
  id: string;
  journal_code: string;
  journal_name: string;
  journal_type: string;
  entry_count: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}


function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
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

  const config = statusMap[status] || statusMap.draft;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function getSourceTypeBadge(sourceType: string | undefined) {
  if (!sourceType) return null;

  const typeMap: Record<string, { label: string; className: string }> = {
    customer_invoice: { label: 'Facture client', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    supplier_invoice: { label: 'Facture fournisseur', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    payment_in: { label: 'Encaissement', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    payment_out: { label: 'Décaissement', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    expense: { label: 'Dépense', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
    manual_adjustment: { label: 'Manuel', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  };

  const config = typeMap[sourceType] || { label: sourceType, className: 'bg-gray-100 text-gray-700' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function EntryLines({ lines }: { lines: JournalLine[] }) {
  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="text-left py-1 font-medium">Compte</th>
            <th className="text-left py-1 font-medium">Libellé</th>
            <th className="text-right py-1 font-medium">Débit</th>
            <th className="text-right py-1 font-medium">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="py-1.5 font-mono text-gray-600 dark:text-gray-400">{line.account_code}</td>
              <td className="py-1.5 text-gray-700 dark:text-gray-300">
                {line.description}
                {line.partner_name && (
                  <span className="text-gray-500 dark:text-gray-400"> - {line.partner_name}</span>
                )}
              </td>
              <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">
                {line.debit > 0 ? formatCurrency(line.debit) : ''}
              </td>
              <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">
                {line.credit > 0 ? formatCurrency(line.credit) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryRow({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div
        className="py-4 px-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                  {entry.entry_number}
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {entry.journal?.journal_code}
                </span>
                {getStatusBadge(entry.status)}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(entry.entry_date)}
                <span className="mx-2">|</span>
                {entry.description}
              </div>
              {entry.source_type && (
                <div className="flex items-center gap-2 mt-1">
                  {getSourceTypeBadge(entry.source_type)}
                  {entry.source_ref && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Réf: {entry.source_ref}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(entry.total_debit)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {entry.lines?.length || 0} ligne{(entry.lines?.length || 0) > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
      {expanded && entry.lines && entry.lines.length > 0 && (
        <div className="px-12 pb-4">
          <EntryLines lines={entry.lines} />
        </div>
      )}
    </div>
  );
}

export default function AccountingPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [journalFilter, setJournalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function fetchJournals() {
    try {
      const res = await fetch(`/api/erp/accounting/journals?org_id=${orgId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setJournals(json.data.journals || []);
        }
      }
    } catch (err) {
      console.error('Error fetching journals:', err);
    }
  }

  async function fetchEntries() {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('org_id', orgId);
      if (journalFilter && journalFilter !== 'all') {
        urlParams.set('journal_code', journalFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        urlParams.set('status', statusFilter);
      }
      if (dateFrom) {
        urlParams.set('start_date', dateFrom);
      }
      if (dateTo) {
        urlParams.set('end_date', dateTo);
      }

      const res = await fetch(`/api/erp/accounting/entries?${urlParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch entries');

      const json = await res.json();
      if (json.success) {
        setEntries(json.data.entries || []);
        setTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJournals();
  }, [orgId]);

  useEffect(() => {
    fetchEntries();
  }, [journalFilter, statusFilter, dateFrom, dateTo, orgId]);

  const totalDebit = entries.reduce((sum, e) => sum + (e.total_debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.total_credit || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={`/org/${orgId}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <Home className="h-4 w-4" />
          <span>Accueil</span>
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link href={`/org/${orgId}/erp`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          ERP
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">Journaux comptables</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Link href={`/org/${orgId}/erp`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <BookOpen className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              Journaux comptables
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{total} écriture{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Débit</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalDebit)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Crédit</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Balance</p>
          <p className={`text-2xl font-bold ${Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(totalDebit - totalCredit)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Journaux actifs</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{journals.length}</p>
        </div>
      </div>

      {/* Journal Quick Links */}
      {journals.length > 0 && (
        <div className="grid gap-3 md:grid-cols-4">
          {journals.map((journal) => (
            <button
              key={journal.id}
              onClick={() => setJournalFilter(journal.journal_code)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                journalFilter === journal.journal_code
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-white">{journal.journal_name}</span>
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400">
                  {journal.journal_code}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {journal.entry_count} écriture{journal.entry_count !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Filtres:</span>
          </div>
          <Select value={journalFilter} onValueChange={setJournalFilter}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
              <SelectValue placeholder="Journal" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all" className="text-gray-900 dark:text-white">Tous les journaux</SelectItem>
              {journals.map(j => (
                <SelectItem key={j.id} value={j.journal_code} className="text-gray-900 dark:text-white">
                  {j.journal_name} ({j.journal_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all" className="text-gray-900 dark:text-white">Tous les statuts</SelectItem>
              <SelectItem value="draft" className="text-gray-900 dark:text-white">Brouillon</SelectItem>
              <SelectItem value="posted" className="text-gray-900 dark:text-white">Validé</SelectItem>
              <SelectItem value="reversed" className="text-gray-900 dark:text-white">Extourné</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <DateInput
              value={dateFrom}
              onChange={(value) => setDateFrom(value)}
              placeholder="Du"
              className="w-[160px]"
            />
            <span className="text-gray-400">-</span>
            <DateInput
              value={dateTo}
              onChange={(value) => setDateTo(value)}
              placeholder="Au"
              className="w-[160px]"
            />
          </div>
          {(journalFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setJournalFilter('all');
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucune écriture</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Les écritures comptables seront générées automatiquement lors de la validation des factures et paiements.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
