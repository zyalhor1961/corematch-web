 'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import {
  Users,
  FileText,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  BarChart3,
  Target,
  Zap,
  ArrowUpRight,
  Activity,
  Brain,
  Sparkles,
  Receipt,
  Wallet,
  Building2,
  Lightbulb,
  Bell,
  ChevronRight,
  CalendarDays
} from 'lucide-react';

// Define types for our data to ensure type safety
interface StatData {
  totalCandidates: number;
  analyzedCandidates: number;
  debPagesCount: number;
  projectCount: number;
  documentCount: number;
  plan: string;
  status: string;
}

interface ActivityItem {
  type: 'cv' | 'deb';
  title: string;
  subtitle: string;
  time: string;
  status: string;
  score?: number;
}

export default function OrganizationOverview() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const [stats, setStats] = useState<StatData | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const orgId = params?.orgId as string;

  const loadDashboardData = useCallback(async (currentOrgId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // All queries are prepared as promises to be run in parallel
      const promises = {
        orgDetails: supabase.from('organizations').select('plan, status').eq('id', currentOrgId).single(),
        projectCount: supabase.from('projects').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId),
        documentCount: supabase.from('documents').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId),
        totalCandidates: supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId),
        analyzedCandidates: supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId).eq('status', 'analyzed'),
        // TODO: Create this RPC function in Supabase to sum pages
        debPages: supabase.rpc('sum_pages_for_org', { org_id_param: currentOrgId }),
        recentCandidates: supabase.from('candidates').select('name, cv_filename, created_at, status, score, projects(name)').eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(3),
        recentDocuments: supabase.from('documents').select('filename, supplier_name, created_at, status').eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(3),
      };

      // Execute all promises in parallel
      const results = await Promise.all(Object.values(promises));
      const [orgResult, projectResult, docResult, totalCandResult, analyzedCandResult, pagesResult, recentCandResult, recentDocResult] = results;

      // Check for errors in each result (except RPC which may not exist yet)
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        // Skip RPC error (index 5 = pagesResult) - graceful fallback if function doesn't exist
        if (i === 5 && result.error) {
          console.warn('[Dashboard] RPC sum_pages_for_org not found (migration 004 may not be applied), using fallback');
          continue;
        }
        if (result.error) throw result.error;
      }

      // Process results
      const activity = [
        ...(recentCandResult.data || []).map((c: any) => ({
          type: 'cv',
          title: `Nouveau CV analysé: ${c.name || c.cv_filename}`,
          subtitle: `Projet: ${c.projects?.name || 'N/A'}`,
          time: c.created_at,
          status: c.status,
          score: c.score
        })),
        ...(recentDocResult.data || []).map((d: any) => ({
          type: 'deb',
          title: `Document traité: ${d.filename}`,
          subtitle: d.supplier_name || 'Traitement en cours',
          time: d.created_at,
          status: d.status
        }))
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

      setStats({
        totalCandidates: totalCandResult.count || 0,
        analyzedCandidates: analyzedCandResult.count || 0,
        debPagesCount: pagesResult.data || 0,
        projectCount: projectResult.count || 0,
        documentCount: docResult.count || 0,
        plan: orgResult.data?.plan || 'starter',
        status: orgResult.data?.status || 'trialing'
      });

      setRecentActivity(activity);

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || "Une erreur est survenue lors du chargement du tableau de bord.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId) {
      loadDashboardData(orgId);
    }
  }, [orgId, loadDashboardData]);

  const getQuotaLimits = (plan: string) => {
    const limits: Record<string, { cv: number; deb: number }> = {
      starter: { cv: 200, deb: 200 },
      pro: { cv: 1000, deb: 1500 },
      scale: { cv: Infinity, deb: 10000 }
    };
    return limits[plan] || limits.starter;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'analyzed':
      case 'exported':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'processing':
      case 'parsing':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'error':
      case 'needs_review':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Erreur de chargement</h2>
        <p className="mb-6">{error || "Les données du tableau de bord n'ont pas pu être chargées."}</p>
        <Button onClick={() => loadDashboardData(orgId)}>Réessayer</Button>
      </div>
    );
  }

  const quotaLimits = getQuotaLimits(stats.plan);

  return (
    <div className="space-y-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vue d'ensemble</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Un résumé de l'activité de votre organisation.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <Button asChild variant="outline"><Link href={`/org/${orgId}/erp`}><Receipt className="w-4 h-4 mr-2" /> ERP</Link></Button>
          <Button asChild variant="outline"><Link href={`/org/${orgId}/deb`}><FileText className="w-4 h-4 mr-2" /> Uploader un document</Link></Button>
          <Button asChild><Link href={`/org/${orgId}/cv`}><Users className="w-4 h-4 mr-2" /> Nouveau projet CV</Link></Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">CV analysés (mois)</p>
            <Brain className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.analyzedCandidates} / {quotaLimits.cv === Infinity ? '∞' : quotaLimits.cv}</p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((stats.analyzedCandidates / quotaLimits.cv) * 100, 100)}%` }}></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pages DEB (mois)</p>
            <FileText className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.debPagesCount} / {quotaLimits.deb}</p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${Math.min((stats.debPagesCount / quotaLimits.deb) * 100, 100)}%` }}></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Projets CV</p>
            <Target className="w-6 h-6 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.projectCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Documents DEB</p>
            <FileText className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.documentCount}</p>
        </div>
      </div>

      {/* AI Daily Briefing */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-lg shadow-sm border border-purple-100 dark:border-purple-800/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Briefing du jour</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30">
            <Link href={`/org/${orgId}/daf?tab=ask`}>
              <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
              Demander à l'IA
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">Actions suggérées</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/org/${orgId}/erp/invoices`} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400">
                  <ChevronRight className="w-3 h-3" />
                  Vérifier les factures en attente
                </Link>
              </li>
              <li>
                <Link href={`/org/${orgId}/daf`} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400">
                  <ChevronRight className="w-3 h-3" />
                  Traiter les documents récents
                </Link>
              </li>
              <li>
                <Link href={`/org/${orgId}/erp/bank`} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400">
                  <ChevronRight className="w-3 h-3" />
                  Rapprocher les transactions
                </Link>
              </li>
            </ul>
          </div>

          {/* Alerts */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-blue-500" />
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">Alertes</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0"></span>
                <span className="text-gray-600 dark:text-gray-400">Quota CV: {stats.analyzedCandidates}/{quotaLimits.cv === Infinity ? '∞' : quotaLimits.cv} utilisé</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full mt-1.5 flex-shrink-0"></span>
                <span className="text-gray-600 dark:text-gray-400">{stats.documentCount} documents traités</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></span>
                <span className="text-gray-600 dark:text-gray-400">{stats.projectCount} projet{stats.projectCount > 1 ? 's' : ''} actif{stats.projectCount > 1 ? 's' : ''}</span>
              </li>
            </ul>
          </div>

          {/* Quick Ask */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-green-500" />
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">Questions rapides</h3>
            </div>
            <div className="space-y-2">
              <Link
                href={`/org/${orgId}/daf?tab=ask&q=Donne moi les factures non réglées`}
                className="block text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 truncate"
              >
                → Factures non réglées
              </Link>
              <Link
                href={`/org/${orgId}/daf?tab=ask&q=Résumé de mon activité ce mois`}
                className="block text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 truncate"
              >
                → Résumé du mois
              </Link>
              <Link
                href={`/org/${orgId}/daf?tab=ask&q=Quels sont mes principaux clients ?`}
                className="block text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 truncate"
              >
                → Mes principaux clients
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ERP Quick Access */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-lg shadow-sm border border-blue-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Core ERP
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Gérez votre facturation et comptabilité</p>
          </div>
          <Button asChild size="sm">
            <Link href={`/org/${orgId}/erp`}>
              Accéder au dashboard
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href={`/org/${orgId}/erp/clients`} className="bg-white dark:bg-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <Users className="w-6 h-6 text-blue-500 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Clients</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gérer vos clients</p>
          </Link>
          <Link href={`/org/${orgId}/erp/invoices`} className="bg-white dark:bg-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <FileText className="w-6 h-6 text-green-500 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Factures</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Créer et suivre</p>
          </Link>
          <Link href={`/org/${orgId}/erp/suppliers`} className="bg-white dark:bg-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <Building2 className="w-6 h-6 text-orange-500 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Fournisseurs</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gérer vos achats</p>
          </Link>
          <Link href={`/org/${orgId}/daf`} className="bg-white dark:bg-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow">
            <Wallet className="w-6 h-6 text-purple-500 mb-2" />
            <p className="font-medium text-gray-900 dark:text-white">Ask DAF</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assistant IA financier</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activité récente</h2>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center">
              <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="font-medium text-gray-900 dark:text-gray-300">Aucune activité récente</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Commencez par créer un projet ou uploader un document.</p>
            </div>
          ) : (
            recentActivity.map((activity, index) => (
              <div key={index} className="py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-full ${activity.type === 'cv' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-green-100 dark:bg-green-900'}`}>
                    {activity.type === 'cv' ? <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white truncate">{activity.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activity.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getStatusIcon(activity.status)}
                  <span className="text-sm text-gray-500 dark:text-gray-400">{new Date(activity.time).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
