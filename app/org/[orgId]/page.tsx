'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  MoreHorizontal,
  Calendar,
  Filter,
  ChevronRight,
  Sparkles,
  Briefcase,
  DollarSign
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import PageContainer from '@/components/ui/PageContainer';
import MorningBriefing from '@/components/dashboard/MorningBriefing';
import dynamic from 'next/dynamic';

const RevenueChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.RevenueChart), {
  ssr: false,
  loading: () => <div className="h-16 w-full bg-slate-800/20 animate-pulse rounded" />
});
const CashFlowChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.CashFlowChart), {
  ssr: false,
  loading: () => <div className="h-16 w-full bg-slate-800/20 animate-pulse rounded" />
});

// Mock data for sparklines
const cashFlowData = [
  { value: 4000 }, { value: 3000 }, { value: 5000 }, { value: 2780 }, { value: 1890 }, { value: 2390 }, { value: 3490 }
];
const revenueData = [
  { value: 2400 }, { value: 1398 }, { value: 9800 }, { value: 3908 }, { value: 4800 }, { value: 3800 }, { value: 4300 }
];

export default function OrganizationDashboard() {
  const params = useParams();
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [isLoading, setIsLoading] = useState(true);
  const orgId = params?.orgId as string;

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.error('Error fetching user:', error);
          // Don't fail, just use default username
          setUserName('User');
        } else if (user) {
          setUserName(user.email?.split('@')[0] || 'User');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        // Don't fail, just use default username
        setUserName('User');
      } finally {
        setIsLoading(false);
      }
    };

    getUser();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  if (isLoading) {
    return (
      <PageContainer title="Tableau de bord">
        <div className="p-8 text-center text-slate-500">
          Chargement de votre briefing...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Tableau de bord"
      actions={
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white/5 text-slate-200 rounded-lg border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors">
            Personnaliser
          </button>
          <button className="px-4 py-2 bg-[#00B4D8] text-white rounded-lg text-sm font-medium hover:bg-[#00a3c4] transition-colors shadow-lg shadow-[#00B4D8]/20">
            + Nouveau
          </button>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Greeting Section */}
        <div>
          <h2 className="text-xl font-medium text-slate-400">
            {greeting()}, <span className="text-white capitalize">{userName}</span>.
          </h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            Vous avez 3 actions prioritaires aujourd'hui.
          </p>
        </div>

        {/* Morning Briefing */}
        <MorningBriefing />

        {/* KPI Cards (Workspaces) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-400 truncate">CV analysés</p>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate">124</h3>
                <p className="text-xs text-neon-teal mt-1 flex items-center"><ArrowUpRight className="w-3 h-3 mr-1" /> +12% ce mois</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-400 truncate">Pages DEB</p>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate">850</h3>
                <p className="text-xs text-slate-500 mt-1">Octobre 2024</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-400 truncate">Projets CV</p>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate">3</h3>
                <p className="text-xs text-blue-400 mt-1">1 actif</p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-400 truncate">Docs DEB</p>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate">12</h3>
                <p className="text-xs text-orange-400 mt-1">2 à valider</p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Pulse Metrics (Insight Cards) */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Pulse Financier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1 */}
            <Card className="overflow-hidden bg-slate-900/40 border-white/10 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="p-5">
                  <p className="text-sm font-medium text-slate-400 truncate">Chiffre d'Affaires (Mois)</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white truncate">24,500 €</h3>
                    <span className="text-xs font-medium text-green-400 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      +12%
                    </span>
                  </div>
                </div>
                <RevenueChart data={revenueData} />
              </CardContent>
            </Card>

            {/* Metric 2 */}
            <Card className="overflow-hidden bg-slate-900/40 border-white/10 backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="p-5">
                  <p className="text-sm font-medium text-slate-400 truncate">Cash Flow</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl lg:text-3xl font-bold text-white truncate">12,800 €</h3>
                    <span className="text-xs font-medium text-red-400 flex items-center">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      -5%
                    </span>
                  </div>
                </div>
                <CashFlowChart data={cashFlowData} />
              </CardContent>
            </Card>

            {/* Metric 3 */}
            <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-400 truncate">Factures en attente</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate">8</h3>
                  </div>
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">4 en retard de paiement</p>
                </div>
              </CardContent>
            </Card>

            {/* Metric 4 */}
            <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-400 truncate">Marge Nette</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate">22%</h3>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="text-green-400 font-medium">+2%</span>
                  <span className="text-slate-500">vs mois dernier</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
