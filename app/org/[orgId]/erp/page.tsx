'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Receipt,
  PiggyBank
} from 'lucide-react';
import Link from 'next/link';

interface KPIs {
  total_revenue_mtd: number;
  total_revenue_ytd: number;
  revenue_change_percent: number;
  total_expenses_mtd: number;
  total_expenses_ytd: number;
  expenses_change_percent: number;
  profit_mtd: number;
  profit_ytd: number;
  total_receivables: number;
  overdue_receivables: number;
  receivables_count: number;
  total_payables: number;
  overdue_payables: number;
  payables_count: number;
  estimated_cash_balance: number;
  cashflow_30days: number;
}

interface TopEntity {
  client_id?: string;
  client_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  total_invoiced?: number;
  total_purchased?: number;
  invoice_count: number;
}

interface MonthlyData {
  month: string;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function KPICard({
  title,
  value,
  change,
  icon: Icon,
  href,
  subtitle
}: {
  title: string;
  value: number;
  change?: number;
  icon: any;
  href?: string;
  subtitle?: string;
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(value)}</div>
        {change !== undefined && (
          <p className={`text-xs flex items-center gap-1 mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change >= 0 ? '+' : ''}{change}% vs mois dernier
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function ERPDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [topClients, setTopClients] = useState<TopEntity[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<TopEntity[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyData[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/erp/kpis');
        if (!res.ok) throw new Error('Failed to fetch KPIs');

        const json = await res.json();
        if (json.success) {
          setKpis(json.data.kpis);
          setTopClients(json.data.topClients || []);
          setTopSuppliers(json.data.topSuppliers || []);
          setMonthlyRevenue(json.data.monthlyRevenue || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Erreur: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tableau de bord ERP</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/org/${orgId}/erp/invoices`}>
              <FileText className="h-4 w-4 mr-2" />
              Nouvelle facture
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/org/${orgId}/erp/clients`}>
              <Users className="h-4 w-4 mr-2" />
              Clients
            </Link>
          </Button>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Chiffre d'affaires (mois)"
          value={kpis?.total_revenue_mtd || 0}
          change={kpis?.revenue_change_percent}
          icon={TrendingUp}
        />
        <KPICard
          title="Dépenses (mois)"
          value={kpis?.total_expenses_mtd || 0}
          change={kpis?.expenses_change_percent}
          icon={CreditCard}
        />
        <KPICard
          title="Résultat (mois)"
          value={kpis?.profit_mtd || 0}
          icon={PiggyBank}
        />
        <KPICard
          title="Trésorerie estimée"
          value={kpis?.estimated_cash_balance || 0}
          icon={Wallet}
          subtitle="Créances - Dettes"
        />
      </div>

      {/* Receivables & Payables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
              Créances clients
            </CardTitle>
            <CardDescription>Montants à recevoir</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total à recevoir</span>
                <span className="text-2xl font-bold">{formatCurrency(kpis?.total_receivables || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">En retard</span>
                <span className="text-lg font-semibold text-red-600">{formatCurrency(kpis?.overdue_receivables || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Factures en attente</span>
                <span>{kpis?.receivables_count || 0}</span>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/org/${orgId}/erp/invoices?status=unpaid`}>
                  Voir les créances
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-orange-600" />
              Dettes fournisseurs
            </CardTitle>
            <CardDescription>Montants à payer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total à payer</span>
                <span className="text-2xl font-bold">{formatCurrency(kpis?.total_payables || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">En retard</span>
                <span className="text-lg font-semibold text-red-600">{formatCurrency(kpis?.overdue_payables || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Factures à payer</span>
                <span>{kpis?.payables_count || 0}</span>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/org/${orgId}/erp/suppliers`}>
                  Voir les dettes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients & Suppliers */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Clients
            </CardTitle>
            <CardDescription>Par chiffre d'affaires</CardDescription>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun client pour le moment</p>
            ) : (
              <div className="space-y-3">
                {topClients.slice(0, 5).map((client, i) => (
                  <div key={client.client_id || i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-4">{i + 1}.</span>
                      <span className="font-medium">{client.client_name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(client.total_invoiced || 0)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link href={`/org/${orgId}/erp/clients`}>
                Voir tous les clients
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Top Fournisseurs
            </CardTitle>
            <CardDescription>Par volume d'achats</CardDescription>
          </CardHeader>
          <CardContent>
            {topSuppliers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun fournisseur pour le moment</p>
            ) : (
              <div className="space-y-3">
                {topSuppliers.slice(0, 5).map((supplier, i) => (
                  <div key={supplier.supplier_id || i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-4">{i + 1}.</span>
                      <span className="font-medium">{supplier.supplier_name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(supplier.total_purchased || 0)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link href={`/org/${orgId}/erp/suppliers`}>
                Voir tous les fournisseurs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Year to Date Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé annuel</CardTitle>
          <CardDescription>Cumul depuis le 1er janvier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">CA Annuel</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(kpis?.total_revenue_ytd || 0)}</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Dépenses Annuelles</p>
              <p className="text-2xl font-bold text-orange-700">{formatCurrency(kpis?.total_expenses_ytd || 0)}</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${(kpis?.profit_ytd || 0) >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <p className="text-sm text-muted-foreground">Résultat Annuel</p>
              <p className={`text-2xl font-bold ${(kpis?.profit_ytd || 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {formatCurrency(kpis?.profit_ytd || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Button variant="outline" asChild>
              <Link href={`/org/${orgId}/erp/clients`}>
                <Users className="h-4 w-4 mr-2" />
                Gérer les clients
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/org/${orgId}/erp/invoices`}>
                <FileText className="h-4 w-4 mr-2" />
                Gérer les factures
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/org/${orgId}/erp/suppliers`}>
                <Building2 className="h-4 w-4 mr-2" />
                Gérer les fournisseurs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/org/${orgId}/erp/expenses`}>
                <Receipt className="h-4 w-4 mr-2" />
                Gérer les dépenses
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
