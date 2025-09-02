'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useOrgQuery } from '@/hooks/useOrganization';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus
} from 'lucide-react';

export default function OrganizationOverview() {
  const params = useParams();
  const { fetchWithOrgId, countWithOrgId, isReady } = useOrgQuery();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [recentActivity, setRecentActivity] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const orgId = params?.orgId as string;

  useEffect(() => {
    // Attendre que le hook useOrganization soit prêt
    if (isReady && orgId) {
      loadDashboardData();
    }
  }, [isReady, orgId]); // Dépendance sur isReady

  const loadDashboardData = async () => {
    try {
      // Get current usage stats avec le hook
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = await fetchWithOrgId('usage_counters', {
        filters: { period_month: currentMonth },
        limit: 1
      });

      // Get organization details - utiliser l'orgId du hook directement
      const { data: org } = await supabase
        .from('organizations')
        .select('plan, status')
        .eq('id', orgId)
        .single();

      // Get project count avec le hook
      const projectCount = await countWithOrgId('projects');

      // Get document count avec le hook  
      const documentCount = await countWithOrgId('documents');

      // Get recent candidates avec le hook
      const recentCandidates = await fetchWithOrgId('candidates', {
        select: '*, projects(name)',
        orderBy: { column: 'created_at', ascending: false },
        limit: 3
      });

      // Get recent documents avec le hook
      const recentDocuments = await fetchWithOrgId('documents', {
        orderBy: { column: 'created_at', ascending: false },
        limit: 3
      });

      // Combine recent activity
      const activity = [
        ...(recentCandidates || []).map(c => ({
          type: 'cv',
          title: `Nouveau CV analysé: ${c.name || c.cv_filename}`,
          subtitle: `Projet: ${c.projects?.name}`,
          time: c.created_at,
          status: c.status,
          score: c.score
        })),
        ...(recentDocuments || []).map(d => ({
          type: 'deb',
          title: `Document traité: ${d.filename}`,
          subtitle: d.supplier_name || 'Traitement en cours',
          time: d.created_at,
          status: d.status
        }))
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

      setStats({
        cvCount: usage?.[0]?.counter_value || 0,
        debPagesCount: usage?.[0]?.counter_value || 0, 
        projectCount: projectCount || 0,
        documentCount: documentCount || 0,
        plan: org?.plan || 'starter',
        status: org?.status || 'trial'
      });

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getQuotaLimits = (plan: string) => {
    const limits = {
      starter: { cv: 200, deb: 200 },
      pro: { cv: 1000, deb: 1500 },
      scale: { cv: 999999, deb: 10000 }
    };
    return limits[plan as keyof typeof limits] || limits.starter;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'analyzed':
      case 'exported':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
      case 'parsing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error':
      case 'needs_review':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const quotaLimits = getQuotaLimits(stats.plan);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vue d&apos;ensemble</h1>
          <p className="text-gray-600">Tableau de bord de votre organisation</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <div className="flex space-x-3">
            <Link href={`/org/${orgId}/cv`}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau projet CV
              </Button>
            </Link>
            <Link href={`/org/${orgId}/deb`}>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau document DEB
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CV Usage */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CV analysés</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.cvCount}
                <span className="text-sm font-normal text-gray-500">
                  /{quotaLimits.cv === 999999 ? '∞' : quotaLimits.cv}
                </span>
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              Ce mois-ci
            </div>
          </div>
        </div>

        {/* DEB Pages */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pages DEB</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.debPagesCount}
                <span className="text-sm font-normal text-gray-500">
                  /{quotaLimits.deb === 10000 ? '10k' : quotaLimits.deb}
                </span>
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              Ce mois-ci
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Projets CV</p>
              <p className="text-2xl font-bold text-gray-900">{stats.projectCount}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link
              href={`/org/${orgId}/cv`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Voir tous les projets →
            </Link>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Documents DEB</p>
              <p className="text-2xl font-bold text-gray-900">{stats.documentCount}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link
              href={`/org/${orgId}/deb`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Voir tous les documents →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Activité récente</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentActivity.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500">Aucune activité récente</p>
              <p className="text-sm text-gray-400 mt-1">
                Commencez par créer un projet CV ou uploader un document DEB
              </p>
            </div>
          ) : (
            recentActivity.map((activity, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {activity.type === 'cv' ? (
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                    ) : (
                      <div className="bg-green-100 p-2 rounded-lg">
                        <FileText className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.subtitle}
                        {activity.score && (
                          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                            Score: {activity.score}/100
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(activity.status)}
                    <span className="text-sm text-gray-500">
                      {new Date(activity.time).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href={`/org/${orgId}/cv`}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Users className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <h3 className="font-medium text-gray-900">Créer un projet CV</h3>
              <p className="text-sm text-gray-500">
                Analysez et triez vos candidatures
              </p>
            </div>
          </Link>

          <Link
            href={`/org/${orgId}/deb`}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <h3 className="font-medium text-gray-900">Traiter un document</h3>
              <p className="text-sm text-gray-500">
                Convertir vos factures en données DEB
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}