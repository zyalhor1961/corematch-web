'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useOrgQuery } from '@/hooks/useOrganization';
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
  Sparkles
} from 'lucide-react';

export default function OrganizationOverview() {
  const params = useParams();
  const { fetchWithOrgId, countWithOrgId, isReady } = useOrgQuery();
  const { isDarkMode } = useTheme();
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
      // Get organization details
      const { data: org } = await supabase
        .from('organizations')
        .select('plan, status')
        .eq('id', orgId)
        .single();

      // Get project count
      const projectCount = await countWithOrgId('projects');

      // Get document count  
      const documentCount = await countWithOrgId('documents');

      // Get REAL CV stats - total candidates and analyzed candidates
      const totalCandidates = await countWithOrgId('candidates');
      
      const analyzedCandidatesCount = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'analyzed');
      
      const analyzedCount = analyzedCandidatesCount.count || 0;

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
        totalCandidates: totalCandidates || 0,
        analyzedCandidates: analyzedCount,
        debPagesCount: documentCount || 0, // For now, using document count as page count
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
      <div className={`flex items-center justify-center h-64 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-slate-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-r from-slate-400 to-slate-600 opacity-20"></div>
          </div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Chargement des données...</p>
        </div>
      </div>
    );
  }

  const quotaLimits = getQuotaLimits(stats.plan);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'}`}>
      <div className="space-y-8">
        {/* Hero Header with Gradient */}
        <div className={`relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-white via-slate-50 to-slate-100'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-xl`}>
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-slate-500/5 to-amber-500/10"></div>
          <div className="relative px-8 py-12">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-sm border ${isDarkMode ? 'border-slate-600/30' : 'border-slate-200/50'}`}>
                    <BarChart3 className={`w-8 h-8 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                      Vue d&apos;ensemble
                    </h1>
                    <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} font-medium`}>
                      Tableau de bord intelligent de votre organisation
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 sm:mt-0">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href={`/org/${orgId}/cv`}>
                    <Button className={`w-full sm:w-auto ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} shadow-lg hover:shadow-xl transition-all duration-200 group`}>
                      <div className="flex items-center space-x-2">
                        <Brain className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                        <span>Nouveau projet CV</span>
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-200" />
                      </div>
                    </Button>
                  </Link>
                  <Link href={`/org/${orgId}/deb`}>
                    <Button variant="outline" className={`w-full sm:w-auto ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'} shadow-lg hover:shadow-xl transition-all duration-200 group`}>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                        <span>Nouveau document DEB</span>
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-200" />
                      </div>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* CV Analysis Card */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>CV analysés</p>
                  <div className="flex items-baseline space-x-2">
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                      {stats.analyzedCandidates}
                    </p>
                    <span className={`text-lg font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      /{quotaLimits.cv === 999999 ? '∞' : quotaLimits.cv}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <Brain className={`w-7 h-7 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Ce mois-ci</span>
                </div>
                <div className={`w-12 h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'} overflow-hidden`}>
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.min((stats.analyzedCandidates / quotaLimits.cv) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* DEB Pages Card */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Pages DEB</p>
                  <div className="flex items-baseline space-x-2">
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                      {stats.debPagesCount}
                    </p>
                    <span className={`text-lg font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      /{quotaLimits.deb === 10000 ? '10k' : quotaLimits.deb}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <FileText className={`w-7 h-7 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Automatisé</span>
                </div>
                <div className={`w-12 h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'} overflow-hidden`}>
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                    style={{ width: `${Math.min((stats.debPagesCount / quotaLimits.deb) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Projects Card */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 to-slate-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Projets CV</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                    {stats.projectCount}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-500/10' : 'bg-slate-100'} group-hover:scale-110 transition-transform duration-300`}>
                  <Target className={`w-7 h-7 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                </div>
              </div>
              <Link
                href={`/org/${orgId}/cv`}
                className={`inline-flex items-center space-x-2 text-sm font-medium ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} group-hover:translate-x-1 transition-all duration-200`}
              >
                <span>Voir tous les projets</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Documents Card */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-rose-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Documents DEB</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                    {stats.documentCount}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <FileText className={`w-7 h-7 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`} />
                </div>
              </div>
              <Link
                href={`/org/${orgId}/deb`}
                className={`inline-flex items-center space-x-2 text-sm font-medium ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} group-hover:translate-x-1 transition-all duration-200`}
              >
                <span>Voir tous les documents</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Premium Recent Activity */}
        <div className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg`}>
          <div className={`px-8 py-6 border-b ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} ${isDarkMode ? 'bg-slate-900/50' : 'bg-white/50'} backdrop-blur-sm`}>
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                <Activity className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
              </div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Activité récente</h2>
            </div>
          </div>
          <div className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-200/50'}`}>
            {recentActivity.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center`}>
                  <Sparkles className={`w-8 h-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                </div>
                <p className={`text-lg font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} mb-2`}>Aucune activité récente</p>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Commencez par créer un projet CV ou uploader un document DEB
                </p>
              </div>
            ) : (
              recentActivity.map((activity, index) => (
                <div key={index} className={`px-8 py-6 hover:${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'} transition-all duration-200`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {activity.type === 'cv' ? (
                        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                          <Brain className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        </div>
                      ) : (
                        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                          <FileText className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {activity.title}
                        </p>
                        <div className="flex items-center space-x-3">
                          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {activity.subtitle}
                          </p>
                          {activity.score && (
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                              Score: {activity.score}/100
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(activity.status)}
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(activity.time).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Premium Quick Actions */}
        <div className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg`}>
          <div className={`px-8 py-6 border-b ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} ${isDarkMode ? 'bg-slate-900/50' : 'bg-white/50'} backdrop-blur-sm`}>
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                <Zap className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
              </div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Actions rapides</h2>
            </div>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Link
                href={`/org/${orgId}/cv`}
                className={`group relative overflow-hidden p-6 rounded-2xl border ${isDarkMode ? 'border-slate-700/50 hover:border-emerald-500/50 bg-slate-800/50 hover:bg-slate-800' : 'border-slate-200/50 hover:border-emerald-300 bg-white/50 hover:bg-white'} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-start space-x-4">
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'} group-hover:scale-110 transition-transform duration-300`}>
                    <Brain className={`w-8 h-8 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Créer un projet CV</h3>
                      <ArrowUpRight className={`w-5 h-5 ${isDarkMode ? 'text-slate-400 group-hover:text-emerald-400' : 'text-slate-500 group-hover:text-emerald-600'} group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-200`} />
                    </div>
                    <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                      Analysez et triez vos candidatures avec l&apos;IA
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href={`/org/${orgId}/deb`}
                className={`group relative overflow-hidden p-6 rounded-2xl border ${isDarkMode ? 'border-slate-700/50 hover:border-amber-500/50 bg-slate-800/50 hover:bg-slate-800' : 'border-slate-200/50 hover:border-amber-300 bg-white/50 hover:bg-white'} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-start space-x-4">
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'} group-hover:scale-110 transition-transform duration-300`}>
                    <FileText className={`w-8 h-8 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Traiter un document</h3>
                      <ArrowUpRight className={`w-5 h-5 ${isDarkMode ? 'text-slate-400 group-hover:text-amber-400' : 'text-slate-500 group-hover:text-amber-600'} group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-200`} />
                    </div>
                    <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                      Convertir vos factures en données DEB
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}