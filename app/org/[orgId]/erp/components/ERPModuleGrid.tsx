'use client';

import Link from 'next/link';
import {
  Users,
  FileText,
  ClipboardList,
  Building2,
  ShoppingCart,
  Receipt,
  BookOpen,
  Landmark,
  Link2,
  ArrowRight,
  ListTree,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/erp/formatters';
import type { ModuleStats } from '@/lib/erp/queries';

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
}

function ModuleCard({
  title,
  description,
  href,
  icon,
  iconBg,
  stat1Label,
  stat1Value,
  stat2Label,
  stat2Value,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {description}
      </p>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{stat1Label}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{stat1Value}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{stat2Label}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{stat2Value}</p>
        </div>
      </div>
    </Link>
  );
}

interface ERPModuleGridProps {
  orgId: string;
  stats: ModuleStats | null;
  loading?: boolean;
}

export function ERPModuleGrid({ orgId, stats, loading = false }: ERPModuleGridProps) {
  const modules = [
    {
      title: 'Clients',
      description: 'Gérez votre base de clients et contacts',
      href: `/org/${orgId}/erp/clients`,
      icon: <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      stat1Label: 'Total clients',
      stat1Value: formatNumber(stats?.clients.count || 0),
      stat2Label: 'Nouveaux ce mois',
      stat2Value: `+${stats?.clients.newThisMonth || 0}`,
    },
    {
      title: 'Devis',
      description: 'Créez et suivez vos devis clients',
      href: `/org/${orgId}/erp/quotes`,
      icon: <ClipboardList className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      stat1Label: 'Ce mois',
      stat1Value: formatNumber(stats?.quotes.count || 0),
      stat2Label: 'Montant total',
      stat2Value: formatCurrency(stats?.quotes.amount || 0),
    },
    {
      title: 'Factures',
      description: 'Facturez vos clients et suivez les paiements',
      href: `/org/${orgId}/erp/invoices`,
      icon: <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      stat1Label: 'Ce mois',
      stat1Value: formatNumber(stats?.invoices.count || 0),
      stat2Label: 'Montant total',
      stat2Value: formatCurrency(stats?.invoices.amount || 0),
    },
    {
      title: 'Fournisseurs',
      description: 'Gérez vos fournisseurs et contacts',
      href: `/org/${orgId}/erp/suppliers`,
      icon: <Building2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />,
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      stat1Label: 'Total fournisseurs',
      stat1Value: formatNumber(stats?.suppliers.count || 0),
      stat2Label: 'Nouveaux ce mois',
      stat2Value: `+${stats?.suppliers.newThisMonth || 0}`,
    },
    {
      title: 'Achats',
      description: 'Suivez vos factures fournisseurs',
      href: `/org/${orgId}/erp/purchases`,
      icon: <ShoppingCart className="h-6 w-6 text-pink-600 dark:text-pink-400" />,
      iconBg: 'bg-pink-100 dark:bg-pink-900/30',
      stat1Label: 'Ce mois',
      stat1Value: formatNumber(stats?.purchases.count || 0),
      stat2Label: 'Montant total',
      stat2Value: formatCurrency(stats?.purchases.amount || 0),
    },
    {
      title: 'Dépenses',
      description: 'Enregistrez et catégorisez vos dépenses',
      href: `/org/${orgId}/erp/expenses`,
      icon: <Receipt className="h-6 w-6 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      stat1Label: 'Ce mois',
      stat1Value: formatNumber(stats?.expenses.count || 0),
      stat2Label: 'Montant total',
      stat2Value: formatCurrency(stats?.expenses.amount || 0),
    },
    {
      title: 'Comptabilité',
      description: 'Journaux et écritures comptables',
      href: `/org/${orgId}/erp/accounting`,
      icon: <BookOpen className="h-6 w-6 text-slate-600 dark:text-slate-400" />,
      iconBg: 'bg-slate-100 dark:bg-slate-900/30',
      stat1Label: 'Écritures',
      stat1Value: '-',
      stat2Label: 'Journaux',
      stat2Value: '4',
    },
    {
      title: 'Banque',
      description: 'Rapprochement bancaire intelligent',
      href: `/org/${orgId}/erp/bank`,
      icon: <Landmark className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />,
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      stat1Label: 'Transactions',
      stat1Value: '-',
      stat2Label: 'Non rapprochées',
      stat2Value: '-',
    },
    {
      title: 'Lettrage',
      description: 'Rapprocher écritures 411/401',
      href: `/org/${orgId}/erp/lettrage`,
      icon: <Link2 className="h-6 w-6 text-violet-600 dark:text-violet-400" />,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      stat1Label: 'Non lettrées',
      stat1Value: '-',
      stat2Label: 'Solde',
      stat2Value: '-',
    },
    {
      title: 'Plan Comptable',
      description: 'PCG 2025 - Gérer les comptes',
      href: `/org/${orgId}/erp/chart-of-accounts`,
      icon: <ListTree className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      stat1Label: 'Comptes PCG',
      stat1Value: '387',
      stat2Label: 'Personnalisés',
      stat2Value: '-',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-4" />
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {modules.map((module) => (
        <ModuleCard key={module.title} {...module} />
      ))}
    </div>
  );
}
