'use client';

import { KPIStatCard } from '@/components/shared/KPIStatCard';
import {
  TrendingUp,
  AlertCircle,
  FileText,
  CreditCard,
  Receipt
} from 'lucide-react';
import type { ERPStats } from '@/lib/erp/queries';

interface ERPStatisticsProps {
  stats: ERPStats | null;
  loading?: boolean;
}

export function ERPStatistics({ stats, loading = false }: ERPStatisticsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KPIStatCard
        title="Cash Flow (30j)"
        value={stats?.cashFlow30Days || 0}
        icon={TrendingUp}
        iconColor={stats?.cashFlow30Days && stats.cashFlow30Days >= 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
        }
        format="currency"
        loading={loading}
      />

      <KPIStatCard
        title="Factures impayées"
        value={stats?.unpaidInvoices.amount || 0}
        subtitle={`${stats?.unpaidInvoices.count || 0} facture${(stats?.unpaidInvoices.count || 0) > 1 ? 's' : ''}`}
        icon={AlertCircle}
        iconColor="text-orange-600 dark:text-orange-400"
        format="currency"
        loading={loading}
      />

      <KPIStatCard
        title="Factures émises (mois)"
        value={stats?.invoicesThisMonth.amount || 0}
        subtitle={`${stats?.invoicesThisMonth.count || 0} facture${(stats?.invoicesThisMonth.count || 0) > 1 ? 's' : ''}`}
        icon={FileText}
        iconColor="text-blue-600 dark:text-blue-400"
        format="currency"
        loading={loading}
      />

      <KPIStatCard
        title="Paiements reçus"
        value={stats?.paymentsReceived.amount || 0}
        subtitle={`${stats?.paymentsReceived.count || 0} paiement${(stats?.paymentsReceived.count || 0) > 1 ? 's' : ''}`}
        icon={CreditCard}
        iconColor="text-emerald-600 dark:text-emerald-400"
        format="currency"
        loading={loading}
      />

      <KPIStatCard
        title="Dépenses / Achats"
        value={stats?.expenses.amount || 0}
        subtitle={`${stats?.expenses.count || 0} dépense${(stats?.expenses.count || 0) > 1 ? 's' : ''}`}
        icon={Receipt}
        iconColor="text-purple-600 dark:text-purple-400"
        format="currency"
        loading={loading}
      />
    </div>
  );
}
