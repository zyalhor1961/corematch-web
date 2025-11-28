'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageContainer from '@/components/ui/PageContainer';
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
      className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    },
    suggested: {
      label: 'Suggestion',
      icon: <Sparkles className="h-3 w-3" />,
      className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    },
    matched: {
      label: 'Rapproché',
      icon: <CheckCircle className="h-3 w-3" />,
      className: 'bg-green-500/10 text-green-400 border border-green-500/20',
    },
    suspicious: {
      label: 'Suspect',
      icon: <AlertCircle className="h-3 w-3" />,
      className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    },
    ignored: {
      label: 'Ignoré',
      icon: <X className="h-3 w-3" />,
      className: 'bg-slate-800 text-slate-400 border border-slate-700',
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
    <div className="p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${isCredit ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {isCredit ? (
              <ArrowDownLeft className="h-4 w-4 text-green-400" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-slate-400">
                {formatDate(transaction.operation_date)}
              </span>
              {getStatusBadge(transaction.reconciliation_status)}
              {transaction.reconciliation_score && transaction.reconciliation_score > 0 && (
                <span className="text-xs text-slate-500">
                  {(transaction.reconciliation_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="font-medium text-white truncate">
              {transaction.label_raw}
            </p>
            {transaction.counterparty_name && (
              <p className="text-sm text-slate-400">
                {transaction.counterparty_name}
              </p>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className={`text-lg font-semibold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
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
            className="text-xs border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
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
            className="text-xs border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Eye className="h-3 w-3 mr-1" />
            Voir matches ({transaction.matches?.length})
          </Button>
        )}
        {transaction.reconciliation_status === 'matched' && (
          <span className="text-xs text-green-400 flex items-center gap-1">
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
    <PageContainer
      title="Rapprochement bancaire"
      breadcrumbs={[
        { label: 'ERP', href: `/org/${orgId}/erp` },
        { label: 'Banque' }
      ]}
      actions={
        <Button
          onClick={handleProcessAll}
          disabled={processingAll || (stats?.unmatched || 0) === 0}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {processingAll ? 'Analyse en cours...' : 'Analyser tout'}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400">Total</p>
            <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400">Non rapprochées</p>
            <p className="text-2xl font-bold text-yellow-400">{stats?.unmatched || 0}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400">Rapprochées</p>
            <p className="text-2xl font-bold text-green-400">{stats?.matched || 0}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400">Encaissements</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.total_credit || 0)}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
            <p className="text-sm text-slate-400">Décaissements</p>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(stats?.total_debit || 0)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
          <div className="flex gap-4 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800/50 border-white/10 text-white">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="unmatched">Non rapprochées</SelectItem>
                <SelectItem value="suggested">Suggestions</SelectItem>
                <SelectItem value="matched">Rapprochées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800/50 border-white/10 text-white">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="credit">Encaissements</SelectItem>
                <SelectItem value="debit">Décaissements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-slate-900/40 rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20 w-full bg-slate-800" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <Landmark className="mx-auto h-12 w-12 text-slate-600" />
              <h3 className="mt-4 text-lg font-semibold text-white">Aucune transaction</h3>
              <p className="text-slate-400">
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
          <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Propositions de rapprochement</DialogTitle>
              <DialogDescription className="text-slate-400">
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
                  <Skeleton className="h-16 w-full bg-slate-800" />
                  <Skeleton className="h-16 w-full bg-slate-800" />
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                  Aucune correspondance trouvée
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">
                              {suggestion.entity_ref}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs ${suggestion.score >= 0.9
                                ? 'bg-green-500/10 text-green-400'
                                : suggestion.score >= 0.7
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                              {(suggestion.score * 100).toFixed(0)}% confiance
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">
                            {suggestion.partner_name} - {formatCurrency(suggestion.amount)}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {suggestion.match_reasons.map((reason, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptMatch(suggestion)}
                          className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
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
              <Button variant="outline" onClick={() => setSuggestDialogOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
