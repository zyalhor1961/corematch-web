'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Landmark,
  ArrowLeft,
  Home,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Link2
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/erp/formatters';

interface BankTransaction {
  id: string;
  operation_date: string;
  amount: number;
  direction: 'credit' | 'debit';
  label_raw: string;
  label_clean?: string;
  counterparty_name?: string;
  bank_reference?: string;
  reconciliation_status: string;
  reconciliation_score?: number;
  bank_account?: {
    label: string;
    iban?: string;
  };
  matches?: any[];
}

interface MatchSuggestion {
  type: string;
  entity_id: string;
  entity_ref: string;
  amount: number;
  partner_name?: string;
  score: number;
  match_reasons: string[];
}

interface ReconciliationStats {
  total: number;
  unmatched: number;
  suggested: number;
  matched: number;
  total_credit: number;
  total_debit: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}


function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    unmatched: {
      label: 'Non rapproché',
      icon: <Clock className="h-3 w-3" />,
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    suggested: {
      label: 'Suggestion',
      icon: <Sparkles className="h-3 w-3" />,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    matched: {
      label: 'Rapproché',
      icon: <CheckCircle className="h-3 w-3" />,
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    suspicious: {
      label: 'Suspect',
      icon: <AlertCircle className="h-3 w-3" />,
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    ignored: {
      label: 'Ignoré',
      icon: <X className="h-3 w-3" />,
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    },
  };

  const config = configs[status] || configs.unmatched;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function TransactionRow({
  transaction,
  onSuggest,
  onViewMatches,
}: {
  transaction: BankTransaction;
  onSuggest: () => void;
  onViewMatches: () => void;
}) {
  const isCredit = transaction.direction === 'credit';
  const hasMatches = transaction.matches && transaction.matches.length > 0;

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${isCredit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            {isCredit ? (
              <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(transaction.operation_date)}
              </span>
              {getStatusBadge(transaction.reconciliation_status)}
              {transaction.reconciliation_score && transaction.reconciliation_score > 0 && (
                <span className="text-xs text-gray-400">
                  {(transaction.reconciliation_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {transaction.label_raw}
            </p>
            {transaction.counterparty_name && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {transaction.counterparty_name}
              </p>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className={`text-lg font-semibold ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pl-11">
        {transaction.reconciliation_status === 'unmatched' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSuggest}
            className="text-xs"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Propositions IA
          </Button>
        )}
        {hasMatches && (
          <Button
            size="sm"
            variant="outline"
            onClick={onViewMatches}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Voir matches ({transaction.matches?.length})
          </Button>
        )}
        {transaction.reconciliation_status === 'matched' && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Lié à une facture
          </span>
        )}
      </div>
    </div>
  );
}

export default function BankReconciliationPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');

  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('org_id', orgId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (directionFilter !== 'all') params.set('direction', directionFilter);

      const res = await fetch(`/api/erp/bank/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');

      const json = await res.json();
      if (json.success) {
        setTransactions(json.data.transactions || []);
        setStats(json.data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter, directionFilter, orgId]);

  async function handleSuggest(transaction: BankTransaction) {
    setSelectedTransaction(transaction);
    setSuggestDialogOpen(true);
    setSuggestLoading(true);
    setSuggestions([]);

    try {
      const res = await fetch('/api/erp/bank/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          action: 'suggest',
          transaction_id: transaction.id,
        }),
      });

      const json = await res.json();
      if (json.success && json.data.matches) {
        setSuggestions(json.data.matches);
      }
    } catch (err) {
      console.error('Error getting suggestions:', err);
    } finally {
      setSuggestLoading(false);
    }
  }

  async function handleAcceptMatch(suggestion: MatchSuggestion) {
    if (!selectedTransaction) return;

    try {
      const res = await fetch('/api/erp/bank/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          action: 'manual_match',
          transaction_id: selectedTransaction.id,
          manual_match: {
            type: suggestion.type === 'invoice' ? 'customer_invoice' :
                  suggestion.type === 'supplier_invoice' ? 'supplier_invoice' : 'expense',
            invoice_id: suggestion.type === 'invoice' ? suggestion.entity_id : null,
            supplier_invoice_id: suggestion.type === 'supplier_invoice' ? suggestion.entity_id : null,
            expense_id: suggestion.type === 'expense' ? suggestion.entity_id : null,
            amount: suggestion.amount,
          },
        }),
      });

      if (res.ok) {
        setSuggestDialogOpen(false);
        fetchTransactions();
      }
    } catch (err) {
      console.error('Error accepting match:', err);
    }
  }

  async function handleProcessAll() {
    setProcessingAll(true);
    try {
      const res = await fetch('/api/erp/bank/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          action: 'suggest_all',
        }),
      });

      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error('Error processing all:', err);
    } finally {
      setProcessingAll(false);
    }
  }

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
        <span className="font-medium text-gray-900 dark:text-white">Rapprochement bancaire</span>
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
              <Landmark className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              Rapprochement bancaire
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {stats?.total || 0} transactions | {stats?.unmatched || 0} non rapprochées
            </p>
          </div>
        </div>

        <Button
          onClick={handleProcessAll}
          disabled={processingAll || (stats?.unmatched || 0) === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {processingAll ? 'Analyse en cours...' : 'Analyser tout'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Non rapprochées</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.unmatched || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Rapprochées</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.matched || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Encaissements</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats?.total_credit || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Décaissements</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats?.total_debit || 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-4 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="unmatched">Non rapprochées</SelectItem>
              <SelectItem value="suggested">Suggestions</SelectItem>
              <SelectItem value="matched">Rapprochées</SelectItem>
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="credit">Encaissements</SelectItem>
              <SelectItem value="debit">Décaissements</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Landmark className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucune transaction</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Importez un relevé bancaire pour commencer le rapprochement
            </p>
          </div>
        ) : (
          <div>
            {transactions.map(tx => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onSuggest={() => handleSuggest(tx)}
                onViewMatches={() => handleSuggest(tx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggestions Dialog */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Propositions de rapprochement</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              {selectedTransaction && (
                <span>
                  {formatDate(selectedTransaction.operation_date)} - {formatCurrency(selectedTransaction.amount)}
                  <br />
                  {selectedTransaction.label_raw}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {suggestLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full bg-gray-200 dark:bg-gray-700" />
                <Skeleton className="h-16 w-full bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                Aucune correspondance trouvée
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {suggestion.entity_ref}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            suggestion.score >= 0.9
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : suggestion.score >= 0.7
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {(suggestion.score * 100).toFixed(0)}% confiance
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {suggestion.partner_name} - {formatCurrency(suggestion.amount)}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {suggestion.match_reasons.map((reason, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptMatch(suggestion)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Valider
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
