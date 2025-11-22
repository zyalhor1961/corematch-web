'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { HeaderBar } from './components/HeaderBar';
import { ERPStatistics } from './components/ERPStatistics';
import { ERPModuleGrid } from './components/ERPModuleGrid';
import { AskDafHero } from './components/AskDafHero';
import { ERPRecentActivity } from './components/ERPRecentActivity';
import {
  fetchERPStats,
  fetchModuleStats,
  fetchRecentActivity,
  type ERPStats,
  type ModuleStats,
  type RecentActivity,
} from '@/lib/erp/queries';

export default function ERPDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [erpStats, setErpStats] = useState<ERPStats | null>(null);
  const [moduleStats, setModuleStats] = useState<ModuleStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!orgId) return;

      setLoading(true);
      try {
        // Fetch all data in parallel
        const [stats, modules, activity] = await Promise.all([
          fetchERPStats(supabase, orgId),
          fetchModuleStats(supabase, orgId),
          fetchRecentActivity(supabase, orgId),
        ]);

        setErpStats(stats);
        setModuleStats(modules);
        setRecentActivity(activity);
      } catch (error) {
        console.error('Error loading ERP data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orgId]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8 space-y-8">
        {/* Header / Action Bar */}
        <HeaderBar orgId={orgId} />

        {/* KPIs Zone */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Vue d'ensemble
          </h2>
          <ERPStatistics stats={erpStats} loading={loading} />
        </section>

        {/* ERP Modules Grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Modules ERP
          </h2>
          <ERPModuleGrid orgId={orgId} stats={moduleStats} loading={loading} />
        </section>

        {/* Ask DAF Hero Section */}
        <section>
          <AskDafHero orgId={orgId} />
        </section>

        {/* Recent Activity Timeline */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ERPRecentActivity activities={recentActivity} loading={loading} />
          </div>

          {/* Quick Stats Sidebar */}
          <div className="space-y-6">
            {/* Monthly Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Résumé du mois
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Factures émises</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {moduleStats?.invoices.count || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Paiements reçus</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {erpStats?.paymentsReceived.count || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Dépenses enregistrées</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {erpStats?.expenses.count || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Nouveaux clients</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    +{moduleStats?.clients.newThisMonth || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800 p-6">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Conseil du jour
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Utilisez Ask DAF pour analyser vos données financières en langage naturel.
                Posez des questions comme "Quels sont mes 5 plus gros clients ce mois ?"
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
