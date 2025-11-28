'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClipboardList,
  Plus,
  ArrowLeft,
  Eye,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Filter,
  Home,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/erp/formatters';

interface Quote {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  status: string;
  total_ht: number;
  total_ttc: number;
  client?: {
    id: string;
    name: string;
    company_name?: string;
  };
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
  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string; icon: any }> = {
    draft: { label: 'Brouillon', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300', icon: Clock },
    sent: { label: 'Envoyé', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400', icon: Send },
    accepted: { label: 'Accepté', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
    rejected: { label: 'Refusé', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', icon: XCircle },
    expired: { label: 'Expiré', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-400', icon: Clock },
  };

  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function QuotesPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  const [stats, setStats] = useState({
    total_amount: 0,
    count_draft: 0,
    count_sent: 0,
    count_accepted: 0,
  });

  async function fetchQuotes() {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('org_id', orgId);
      if (statusFilter && statusFilter !== 'all') {
        urlParams.set('status', statusFilter);
      }

      const res = await fetch(`/api/erp/quotes?${urlParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');

      const json = await res.json();
      if (json.success) {
        setQuotes(json.data.quotes || []);
        setTotal(json.data.total || 0);

        const allQuotes = json.data.quotes || [];
        setStats({
          total_amount: allQuotes.reduce((sum: number, q: Quote) => sum + (q.total_ttc || 0), 0),
          count_draft: allQuotes.filter((q: Quote) => q.status === 'draft').length,
          count_sent: allQuotes.filter((q: Quote) => q.status === 'sent').length,
          count_accepted: allQuotes.filter((q: Quote) => q.status === 'accepted').length,
        });
      }
    } catch (err) {
      console.error('Error fetching quotes:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter, orgId]);

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
        <span className="font-medium text-gray-900 dark:text-white">Devis</span>
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
              <ClipboardList className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              Devis
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{total} devis</p>
          </div>
        </div>

        <Button asChild>
          <Link href={`/org/${orgId}/erp/quotes/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau devis
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total devis</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total_amount)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Brouillons</p>
          <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{stats.count_draft}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Envoyés</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.count_sent}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Acceptés</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.count_accepted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Filtrer:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all" className="text-gray-900 dark:text-white">Tous les statuts</SelectItem>
              <SelectItem value="draft" className="text-gray-900 dark:text-white">Brouillons</SelectItem>
              <SelectItem value="sent" className="text-gray-900 dark:text-white">Envoyés</SelectItem>
              <SelectItem value="accepted" className="text-gray-900 dark:text-white">Acceptés</SelectItem>
              <SelectItem value="rejected" className="text-gray-900 dark:text-white">Refusés</SelectItem>
              <SelectItem value="expired" className="text-gray-900 dark:text-white">Expirés</SelectItem>
            </SelectContent>
          </Select>
          {statusFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucun devis</h3>
            <p className="text-gray-600 dark:text-gray-400">Commencez par créer votre premier devis</p>
            <Button className="mt-4" asChild>
              <Link href={`/org/${orgId}/erp/quotes/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau devis
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">N° Devis</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Validité</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Statut</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Montant TTC</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <span className="font-mono font-medium text-gray-900 dark:text-white">{quote.quote_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      {quote.client ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{quote.client.name}</div>
                          {quote.client.company_name && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{quote.client.company_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{formatDate(quote.quote_date)}</td>
                    <td className="py-3 px-4">
                      <span className={new Date(quote.valid_until) < new Date() ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                        {formatDate(quote.valid_until)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(quote.status)}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(quote.total_ttc)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Voir" className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Télécharger PDF" className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
