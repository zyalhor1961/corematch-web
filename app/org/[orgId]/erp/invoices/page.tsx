'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  FileText,
  Plus,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  Wallet,
  TrendingUp,
  Receipt,
  X,
  MoreHorizontal,
  Edit,
  Trash
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/erp/formatters';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCards, formatCurrency as formatCurrencyCard } from '@/components/ui/SummaryCards';

// AG Grid Imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

import { WorkflowBar, WorkflowStep } from '@/components/ui/WorkflowBar';

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

function getInvoiceWorkflowSteps(invoice: Invoice): WorkflowStep[] {
  const steps: WorkflowStep[] = [
    { id: 'draft', label: 'Brouillon', status: 'completed' },
    { id: 'sent', label: 'Envoyée', status: invoice.status === 'draft' ? 'upcoming' : 'completed' },
    { id: 'paid', label: 'Payée', status: invoice.status === 'paid' ? 'completed' : invoice.status === 'partial' ? 'current' : 'upcoming' },
    { id: 'accounting', label: 'Comptabilisée', status: 'upcoming' }, // Mocked for now
  ];

  if (invoice.status === 'overdue') {
    steps[2].status = 'current'; // Highlight payment step if overdue
  }

  return steps;
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

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

  const breadcrumbs = [
    { label: 'Accueil', href: `/org/${orgId}` },
    { label: 'ERP', href: `/org/${orgId}/erp` },
    { label: 'Factures' },
  ];

  const summaryCards = [
    {
      label: 'Total facturé',
      value: formatCurrencyCard(stats.total_amount),
      icon: Receipt,
      iconColor: 'text-blue-500',
    },
    {
      label: 'Total encaissé',
      value: formatCurrencyCard(stats.total_paid),
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
    },
    {
      label: 'Reste à encaisser',
      value: formatCurrencyCard(stats.total_outstanding),
      icon: Clock,
      iconColor: 'text-orange-500',
    },
    {
      label: 'En retard',
      value: stats.count_overdue,
      icon: AlertCircle,
      iconColor: 'text-red-500',
      subtext: stats.count_overdue > 0 ? 'Action requise' : undefined,
    },
  ];

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'N° Facture',
      field: 'invoice_number',
      filter: true,
      cellRenderer: (params: ICellRendererParams) => (
        <span className="font-mono font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => setSelectedInvoice(params.data)}>
          {params.value}
        </span>
      )
    },
    {
      headerName: 'Client',
      field: 'client.name',
      filter: true,
      cellRenderer: (params: ICellRendererParams) => (
        <div>
          <div className="font-medium">{params.value}</div>
          {params.data.client?.company_name && (
            <div className="text-xs text-gray-500">{params.data.client.company_name}</div>
          )}
        </div>
      )
    },
    {
      headerName: 'Date',
      field: 'invoice_date',
      valueFormatter: (params) => formatDate(params.value),
      sortable: true
    },
    {
      headerName: 'Échéance',
      field: 'due_date',
      valueFormatter: (params) => formatDate(params.value),
      sortable: true,
      cellClass: (params) => params.data.status === 'overdue' ? 'text-red-600 font-medium' : ''
    },
    {
      headerName: 'Statut',
      field: 'status',
      cellRenderer: (params: ICellRendererParams) => getStatusBadge(params.value),
      filter: true
    },
    {
      headerName: 'Montant TTC',
      field: 'total_ttc',
      valueFormatter: (params) => formatCurrency(params.value),
      type: 'numericColumn',
      sortable: true
    },
    {
      headerName: 'Reste dû',
      field: 'balance_due',
      valueFormatter: (params) => formatCurrency(params.value),
      type: 'numericColumn',
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value <= 0) return <span className="text-emerald-600 font-medium">Soldée</span>;
        return <span className="text-orange-600 font-medium">{formatCurrency(params.value)}</span>;
      }
    },
    {
      headerName: 'Actions',
      field: 'id',
      width: 100,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(params.data); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  return (
    <div className="container mx-auto p-6 space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <PageHeader
        title="Factures"
        subtitle={`${total} facture${total !== 1 ? 's' : ''}`}
        icon={<FileText className="h-7 w-7" />}
        iconColor="text-green-600 dark:text-green-400"
        breadcrumbs={breadcrumbs}
        backHref={`/org/${orgId}/erp`}
        actions={
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link href={`/org/${orgId}/erp/invoices/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle facture
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <SummaryCards cards={summaryCards} columns={4} />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-4 items-center">
        <Filter className="h-4 w-4 text-gray-500" />
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
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || clientFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setClientFilter(''); }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* AG Grid */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="ag-theme-alpine w-full h-full">
            <AgGridReact
              rowData={invoices}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={20}
              onRowClicked={(e) => setSelectedInvoice(e.data)}
              rowSelection="single"
              animateRows={true}
            />
          </div>
        )}
      </div>

      {/* Context Drawer (Right Side Panel) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Facture {selectedInvoice.invoice_number}</h2>
                <p className="text-sm text-gray-500">{formatDate(selectedInvoice.invoice_date)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Workflow Bar */}
              <div className="mb-6">
                <WorkflowBar steps={getInvoiceWorkflowSteps(selectedInvoice)} />
              </div>



              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500">Statut</span>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500">Montant TTC</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(selectedInvoice.total_ttc)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Reste à payer</span>
                  <span className="text-lg font-bold text-orange-600">{formatCurrency(selectedInvoice.balance_due)}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Détails Client
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">Nom:</span> {selectedInvoice.client?.name}</p>
                  <p><span className="text-gray-500">Société:</span> {selectedInvoice.client?.company_name || '-'}</p>
                  <p><span className="text-gray-500">Email:</span> {selectedInvoice.client?.email || '-'}</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Download className="w-4 h-4 mr-2" /> Télécharger
                </Button>
                <Button variant="outline" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" /> Modifier
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
