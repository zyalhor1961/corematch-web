'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Plus,
  ArrowLeft,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter
} from 'lucide-react';
import Link from 'next/link';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_ttc: number;
  paid_amount: number;
  balance_due: number;
  client?: {
    id: string;
    name: string;
    email?: string;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string; icon: any }> = {
    draft: { label: 'Brouillon', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300', icon: FileText },
    sent: { label: 'Envoyée', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400', icon: Clock },
    paid: { label: 'Payée', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
    partial: { label: 'Partiel', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-400', icon: Clock },
    overdue: { label: 'En retard', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', icon: AlertCircle },
    cancelled: { label: 'Annulée', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-500 dark:text-gray-400', icon: XCircle },
  };

  const config = statusConfig[status] || { label: status, bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300', icon: FileText };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function InvoicesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [clientFilter, setClientFilter] = useState(searchParams.get('client_id') || '');

  // Stats
  const [stats, setStats] = useState({
    total_amount: 0,
    total_paid: 0,
    total_outstanding: 0,
    count_paid: 0,
    count_unpaid: 0,
    count_overdue: 0,
  });

  async function fetchInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'unpaid') {
          // 'unpaid' is a virtual status for sent, partial, overdue
        } else {
          params.set('status', statusFilter);
        }
      }
      if (clientFilter) params.set('client_id', clientFilter);

      const res = await fetch(`/api/erp/invoices?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');

      const json = await res.json();
      if (json.success) {
        let filteredInvoices = json.data.invoices || [];

        // Apply unpaid filter client-side
        if (statusFilter === 'unpaid') {
          filteredInvoices = filteredInvoices.filter((inv: Invoice) =>
            ['sent', 'partial', 'overdue'].includes(inv.status)
          );
        }

        setInvoices(filteredInvoices);
        setTotal(filteredInvoices.length);

        // Calculate stats
        const allInvoices = json.data.invoices || [];
        setStats({
          total_amount: allInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.total_ttc || 0), 0),
          total_paid: allInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.paid_amount || 0), 0),
          total_outstanding: allInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.balance_due || 0), 0),
          count_paid: allInvoices.filter((inv: Invoice) => inv.status === 'paid').length,
          count_unpaid: allInvoices.filter((inv: Invoice) => ['sent', 'partial'].includes(inv.status)).length,
          count_overdue: allInvoices.filter((inv: Invoice) => inv.status === 'overdue').length,
        });
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, clientFilter]);

  return (
    <div className="container mx-auto p-6 space-y-6">
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
              <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
              Factures
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{total} facture{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link href={`/org/${orgId}/erp/invoices/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total facturé</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total_amount)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total encaissé</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.total_paid)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Reste à encaisser</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.total_outstanding)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">En retard</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.count_overdue}</p>
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
              <SelectItem value="sent" className="text-gray-900 dark:text-white">Envoyées</SelectItem>
              <SelectItem value="unpaid" className="text-gray-900 dark:text-white">À encaisser</SelectItem>
              <SelectItem value="paid" className="text-gray-900 dark:text-white">Payées</SelectItem>
              <SelectItem value="overdue" className="text-gray-900 dark:text-white">En retard</SelectItem>
              <SelectItem value="cancelled" className="text-gray-900 dark:text-white">Annulées</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== 'all' || clientFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setClientFilter('');
              }}
              className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucune facture</h3>
            <p className="text-gray-600 dark:text-gray-400">Commencez par créer votre première facture</p>
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" asChild>
              <Link href={`/org/${orgId}/erp/invoices/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">N° Facture</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Échéance</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Statut</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Montant TTC</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Reste dû</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <span className="font-mono font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      {invoice.client ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{invoice.client.name}</div>
                          {invoice.client.company_name && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{invoice.client.company_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{formatDate(invoice.invoice_date)}</td>
                    <td className="py-3 px-4">
                      <span className={invoice.status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                        {formatDate(invoice.due_date)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(invoice.status)}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(invoice.total_ttc)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {invoice.balance_due > 0 ? (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">{formatCurrency(invoice.balance_due)}</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Soldée</span>
                      )}
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
