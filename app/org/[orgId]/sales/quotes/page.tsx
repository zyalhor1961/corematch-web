'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageContainer from '@/components/ui/PageContainer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Euro,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  ArrowRight,
  MoreVertical,
  Trash2,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_id: string | null;
  quote_date: string;
  validity_date: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  total_ht: number;
  total_ttc: number;
  currency: string;
  lead_id: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: FileText },
  sent: { label: 'Envoyé', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
  accepted: { label: 'Accepté', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  rejected: { label: 'Refusé', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  expired: { label: 'Expiré', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Clock },
  converted: { label: 'Converti', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: ArrowRight },
};

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function QuotesListPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('quotes')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading quotes:', error);
      } else {
        setQuotes(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, statusFilter]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Filter by search
  const filteredQuotes = searchQuery
    ? quotes.filter(
        (q) =>
          q.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : quotes;

  // Calculate stats
  const stats = {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === 'draft').length,
    sent: quotes.filter((q) => q.status === 'sent').length,
    accepted: quotes.filter((q) => q.status === 'accepted').length,
    totalAmount: quotes
      .filter((q) => q.status !== 'rejected' && q.status !== 'expired')
      .reduce((sum, q) => sum + (q.total_ttc || 0), 0),
  };

  return (
    <PageContainer
      title="Devis"
      actions={
        <Button asChild>
          <Link href={`/org/${orgId}/sales/quotes/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Devis
          </Link>
        </Button>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Total devis</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">Brouillons</div>
          <div className="text-2xl font-bold text-slate-400">{stats.draft}</div>
        </div>
        <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
          <div className="text-slate-400 text-sm mb-1">En attente</div>
          <div className="text-2xl font-bold text-blue-400">{stats.sent}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-emerald-400 text-sm mb-1">Montant accepté</div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatCurrency(stats.totalAmount)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un devis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        <div className="flex gap-2">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                  : 'bg-slate-800/50 text-slate-400 border border-white/10 hover:bg-white/5'
              )}
            >
              {status === 'all' ? 'Tous' : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}
            </button>
          ))}

          <button
            onClick={loadQuotes}
            className="p-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-slate-900/40 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-400 animate-pulse">Chargement...</div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="h-12 w-12 text-slate-600 mb-4" />
            <p className="text-slate-400 mb-4">Aucun devis trouvé</p>
            <Button asChild variant="outline" className="border-white/10">
              <Link href={`/org/${orgId}/sales/quotes/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Créer votre premier devis
              </Link>
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Devis
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Montant TTC
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredQuotes.map((quote) => {
                const StatusIcon = STATUS_CONFIG[quote.status]?.icon || FileText;
                return (
                  <tr
                    key={quote.id}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/org/${orgId}/sales/quotes/${quote.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-teal-500/10">
                          <FileText className="h-4 w-4 text-teal-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{quote.quote_number}</p>
                          {quote.lead_id && (
                            <p className="text-xs text-purple-400">Depuis CRM</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200">{quote.client_name || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="h-4 w-4" />
                        {formatDate(quote.quote_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                          STATUS_CONFIG[quote.status]?.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {STATUS_CONFIG[quote.status]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-white font-mono font-medium">
                        {formatCurrency(quote.total_ttc, quote.currency)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Show actions menu
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
