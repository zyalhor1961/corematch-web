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
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    draft: { label: 'Brouillon', variant: 'secondary', icon: FileText },
    sent: { label: 'Envoyée', variant: 'default', icon: Clock },
    paid: { label: 'Payée', variant: 'default', icon: CheckCircle },
    partial: { label: 'Partiel', variant: 'outline', icon: Clock },
    overdue: { label: 'En retard', variant: 'destructive', icon: AlertCircle },
    cancelled: { label: 'Annulée', variant: 'secondary', icon: XCircle },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary', icon: FileText };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
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
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/org/${orgId}/erp`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Factures
            </h1>
            <p className="text-muted-foreground">{total} facture{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <Button asChild>
          <Link href={`/org/${orgId}/erp/invoices/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total facturé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total encaissé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reste à encaisser</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.total_outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En retard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.count_overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtrer:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="sent">Envoyées</SelectItem>
                <SelectItem value="unpaid">À encaisser</SelectItem>
                <SelectItem value="paid">Payées</SelectItem>
                <SelectItem value="overdue">En retard</SelectItem>
                <SelectItem value="cancelled">Annulées</SelectItem>
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
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Aucune facture</h3>
              <p className="text-muted-foreground">Commencez par créer votre première facture</p>
              <Button className="mt-4" asChild>
                <Link href={`/org/${orgId}/erp/invoices/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle facture
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <span className="font-mono font-medium">{invoice.invoice_number}</span>
                    </TableCell>
                    <TableCell>
                      {invoice.client ? (
                        <div>
                          <div className="font-medium">{invoice.client.name}</div>
                          {invoice.client.company_name && (
                            <div className="text-sm text-muted-foreground">{invoice.client.company_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>
                      <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                        {formatDate(invoice.due_date)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total_ttc)}
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.balance_due > 0 ? (
                        <span className="text-orange-600 font-medium">{formatCurrency(invoice.balance_due)}</span>
                      ) : (
                        <span className="text-green-600">Soldée</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Voir">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Télécharger PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
