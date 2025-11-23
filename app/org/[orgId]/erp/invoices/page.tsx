'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { SummaryCards, formatCurrency as formatCurrencyCard } from '@/components/ui/SummaryCards';

// AG Grid Imports
// AG Grid Imports
import dynamic from 'next/dynamic';
const AgGridReact = dynamic(() => import('ag-grid-react').then(mod => mod.AgGridReact), { ssr: false });
import { AllCommunityModule, ModuleRegistry, ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

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
    draft: { label: 'Brouillon', bgColor: 'bg-slate-800', textColor: 'text-slate-300', icon: FileText },
    sent: { label: 'Envoyée', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', icon: Clock },
    paid: { label: 'Payée', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400', icon: CheckCircle },
    partial: { label: 'Partiel', bgColor: 'bg-amber-500/10', textColor: 'text-amber-400', icon: Clock },
    overdue: { label: 'En retard', bgColor: 'bg-red-500/10', textColor: 'text-red-400', icon: AlertCircle },
    cancelled: { label: 'Annulée', bgColor: 'bg-slate-800', textColor: 'text-slate-500', icon: XCircle },
  };

  const config = statusConfig[status] || { label: status, bgColor: 'bg-slate-800', textColor: 'text-slate-300', icon: FileText };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} border border-white/5`}>
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
    ModuleRegistry.registerModules([AllCommunityModule]);
    fetchInvoices();
  }, [statusFilter, clientFilter]);

  const summaryCards = [
    {
      label: 'Total facturé',
      value: formatCurrencyCard(stats.total_amount),
      icon: Receipt,
      iconColor: 'text-blue-400',
    },
    {
      label: 'Total encaissé',
      value: formatCurrencyCard(stats.total_paid),
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Reste à encaisser',
      value: formatCurrencyCard(stats.total_outstanding),
      icon: Clock,
      iconColor: 'text-orange-400',
    },
    {
      label: 'En retard',
      value: stats.count_overdue,
      icon: AlertCircle,
      iconColor: 'text-red-400',
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
        <span className="font-mono font-medium text-blue-400 cursor-pointer hover:underline" onClick={() => setSelectedInvoice(params.data)}>
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
          <div className="font-medium text-slate-200">{params.value}</div>
          {params.data.client?.company_name && (
            <div className="text-xs text-slate-500">{params.data.client.company_name}</div>
          )}
        </div>
      )
    },
    {
      headerName: 'Date',
      field: 'invoice_date',
      valueFormatter: (params) => formatDate(params.value),
      sortable: true,
      cellClass: 'text-slate-400'
    },
    {
      headerName: 'Échéance',
      field: 'due_date',
      valueFormatter: (params) => formatDate(params.value),
      sortable: true,
      cellClass: (params) => params.data.status === 'overdue' ? 'text-red-400 font-medium' : 'text-slate-400'
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
      sortable: true,
      cellClass: 'text-slate-200 font-medium'
    },
    {
      headerName: 'Reste dû',
      field: 'balance_due',
      valueFormatter: (params) => formatCurrency(params.value),
      type: 'numericColumn',
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value <= 0) return <span className="text-emerald-400 font-medium">Soldée</span>;
        return <span className="text-orange-400 font-medium">{formatCurrency(params.value)}</span>;
      }
    },
    {
      headerName: 'Actions',
      field: 'id',
      width: 100,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(params.data); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10">
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
    <PageContainer
      title="Factures"
      actions={
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
          <Link href={`/org/${orgId}/erp/invoices/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 h-full flex flex-col">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, i) => (
            <Card key={i} className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">{card.label}</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{card.value}</h3>
                  {card.subtext && <p className="text-xs text-red-400 mt-1">{card.subtext}</p>}
                </div>
                <div className={`p-3 rounded-lg bg-white/5 ${card.iconColor}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-slate-900/40 rounded-xl border border-white/10 p-4 flex gap-4 items-center backdrop-blur-sm">
          <Filter className="h-4 w-4 text-slate-500" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-white/10 text-slate-200">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="sent">Envoyées</SelectItem>
              <SelectItem value="unpaid">À encaisser</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== 'all' || clientFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setClientFilter(''); }} className="text-slate-400 hover:text-white hover:bg-white/5">
              Réinitialiser
            </Button>
          )}
        </div>

        {/* AG Grid */}
        <div className="flex-1 bg-slate-900/40 rounded-xl border border-white/10 overflow-hidden relative backdrop-blur-sm">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full bg-white/5" />)}
            </div>
          ) : (
            <div className="ag-theme-alpine-dark w-full h-full">
              <AgGridReact
                rowData={invoices}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                pagination={true}
                paginationPageSize={20}
                onRowClicked={(e) => setSelectedInvoice(e.data as Invoice)}
                rowSelection="single"
                animateRows={true}
                className="h-full"
              />
            </div>
          )}
        </div>

        {/* Context Drawer (Right Side Panel) */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)}></div>
            <div className="relative w-full max-w-md bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Facture {selectedInvoice.invoice_number}</h2>
                  <p className="text-sm text-slate-400">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white hover:bg-white/10">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Workflow Bar */}
                <div className="mb-6">
                  <WorkflowBar steps={getInvoiceWorkflowSteps(selectedInvoice)} />
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-400">Statut</span>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-400">Montant TTC</span>
                    <span className="text-lg font-bold text-white">{formatCurrency(selectedInvoice.total_ttc)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-400">Reste à payer</span>
                    <span className="text-lg font-bold text-orange-400">{formatCurrency(selectedInvoice.balance_due)}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" /> Détails Client
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">Nom:</span> <span className="text-slate-300">{selectedInvoice.client?.name}</span></p>
                    <p><span className="text-slate-500">Société:</span> <span className="text-slate-300">{selectedInvoice.client?.company_name || '-'}</span></p>
                    <p><span className="text-slate-500">Email:</span> <span className="text-slate-300">{selectedInvoice.client?.email || '-'}</span></p>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                    <Download className="w-4 h-4 mr-2" /> Télécharger
                  </Button>
                  <Button variant="outline" className="flex-1 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                    <Edit className="w-4 h-4 mr-2" /> Modifier
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
