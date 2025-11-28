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
  ShoppingCart,
  Plus,
  ArrowLeft,
  Eye,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
  Home,
  ChevronRight,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/erp/formatters';

interface Purchase {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  paid_amount: number;
  balance_due: number;
  supplier?: {
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
    received: { label: 'Reçue', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400', icon: Clock },
    validated: { label: 'Validée', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', textColor: 'text-indigo-700 dark:text-indigo-400', icon: CheckCircle },
    paid: { label: 'Payée', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
    partial: { label: 'Partiel', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-400', icon: Clock },
    overdue: { label: 'En retard', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', icon: AlertCircle },
  };

  const config = statusConfig[status] || statusConfig.received;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function PurchasesPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  const [stats, setStats] = useState({
    total_amount: 0,
    total_paid: 0,
    total_outstanding: 0,
    count_pending: 0,
  });

  async function fetchPurchases() {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('org_id', orgId);
      if (statusFilter && statusFilter !== 'all') {
        urlParams.set('status', statusFilter);
      }

      const res = await fetch(`/api/erp/purchases?${urlParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch purchases');

      const json = await res.json();
      if (json.success) {
        setPurchases(json.data.purchases || []);
        setTotal(json.data.total || 0);

        const allPurchases = json.data.purchases || [];
        setStats({
          total_amount: allPurchases.reduce((sum: number, p: Purchase) => sum + (p.total_ttc || 0), 0),
          total_paid: allPurchases.reduce((sum: number, p: Purchase) => sum + (p.paid_amount || 0), 0),
          total_outstanding: allPurchases.reduce((sum: number, p: Purchase) => sum + (p.balance_due || 0), 0),
          count_pending: allPurchases.filter((p: Purchase) => ['received', 'validated', 'partial'].includes(p.status)).length,
        });
      }
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPurchases();
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
        <span className="font-medium text-gray-900 dark:text-white">Achats</span>
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
              <ShoppingCart className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              Achats (Factures fournisseurs)
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{total} facture{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <Button asChild>
          <Link href={`/org/${orgId}/erp/purchases/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Saisir une facture
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total achats</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total_amount)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total payé</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.total_paid)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Reste à payer</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.total_outstanding)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">En attente</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.count_pending}</p>
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
              <SelectItem value="received" className="text-gray-900 dark:text-white">Reçues</SelectItem>
              <SelectItem value="validated" className="text-gray-900 dark:text-white">Validées</SelectItem>
              <SelectItem value="paid" className="text-gray-900 dark:text-white">Payées</SelectItem>
              <SelectItem value="partial" className="text-gray-900 dark:text-white">Partiellement payées</SelectItem>
              <SelectItem value="overdue" className="text-gray-900 dark:text-white">En retard</SelectItem>
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

      {/* Purchases Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucune facture fournisseur</h3>
            <p className="text-gray-600 dark:text-gray-400">Commencez par enregistrer votre première facture d'achat</p>
            <Button className="mt-4" asChild>
              <Link href={`/org/${orgId}/erp/purchases/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Saisir une facture
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">N° Facture</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Fournisseur</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Échéance</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Statut</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Montant TTC</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Reste dû</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <span className="font-mono font-medium text-gray-900 dark:text-white">{purchase.invoice_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      {purchase.supplier ? (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{purchase.supplier.name}</div>
                            {purchase.supplier.company_name && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">{purchase.supplier.company_name}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{formatDate(purchase.invoice_date)}</td>
                    <td className="py-3 px-4">
                      <span className={purchase.status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                        {formatDate(purchase.due_date)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(purchase.status)}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(purchase.total_ttc)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {purchase.balance_due > 0 ? (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">{formatCurrency(purchase.balance_due)}</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Soldée</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Voir" className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Télécharger" className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
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
