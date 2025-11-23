'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  BarChart3,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MoreHorizontal,
  Calendar,
  Filter,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Briefcase,
  DollarSign
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from 'recharts';

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
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const orgId = params?.orgId as string;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.email?.split('@')[0] || 'User');
      }
      setIsLoading(false);
    };
    getUser();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Chargement de votre briefing...</div>;
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {greeting()}, <span className="text-blue-600 dark:text-blue-400 capitalize">{userName}</span>.
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            Vous avez 3 actions prioritaires aujourd'hui.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Personnaliser
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
            + Nouveau
          </button>
        </div>
      </div>

      {/* KPI Cards (Workspaces) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CV analysés</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">124</h3>
              <p className="text-xs text-green-600 mt-1 flex items-center"><ArrowUpRight className="w-3 h-3 mr-1" /> +12% ce mois</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pages DEB</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">850</h3>
              <p className="text-xs text-gray-500 mt-1">Octobre 2024</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Projets CV</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">3</h3>
              <p className="text-xs text-blue-600 mt-1">1 actif</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Docs DEB</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">12</h3>
              <p className="text-xs text-orange-600 mt-1">2 à valider</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Briefing du jour & Quick Questions */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Briefing du jour
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {['Factures non réglées ?', 'Dépenses 2024 ?', 'CV reçus ce mois ?'].map((q, i) => (
              <button key={i} className="whitespace-nowrap px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="group relative bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer">
            <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-red-500"></div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Valider Facture #F2024-089</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Acme Corp • 4,500.00 €</p>
                <p className="text-xs text-red-500 mt-2 font-medium">Échéance demain</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700">Valider</button>
              <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-md hover:bg-gray-200">Ignorer</button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Revoir Candidature</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Jean Dupont • Développeur Fullstack</p>
                <p className="text-xs text-blue-500 mt-2 font-medium">Match 85%</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700">Voir CV</button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Préparer DEB</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Déclaration d'Échanges de Biens</p>
                <p className="text-xs text-gray-500 mt-2">Pour Octobre 2024</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700">Commencer</button>
            </div>
          </div>
        </div>
      </section>

      {/* Pulse Metrics (Insight Cards) */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Pulse Financier
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1 */}
          <Card className="overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-0">
              <div className="p-5">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Chiffre d'Affaires (Mois)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">24,500 €</h3>
                  <span className="text-xs font-medium text-green-600 flex items-center">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    +12%
                  </span>
                </div>
              </div>
              <div className="h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metric 2 */}
          <Card className="overflow-hidden border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-0">
              <div className="p-5">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cash Flow</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">12,800 €</h3>
                  <span className="text-xs font-medium text-red-600 flex items-center">
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    -5%
                  </span>
                </div>
              </div>
              <div className="h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlowData}>
                    <defs>
                      <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#colorCash)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metric 3 */}
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Factures en attente</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">8</h3>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">4 en retard de paiement</p>
              </div>
            </CardContent>
          </Card>

          {/* Metric 4 */}
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Marge Nette</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">22%</h3>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-purple-600">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="text-green-600 font-medium">+2%</span>
                <span className="text-gray-500">vs mois dernier</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Activity & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activité Récente</h2>
            <div className="flex gap-2">
              <button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {[1, 2, 3, 4, 5].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${i % 2 === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                  {i % 2 === 0 ? <FileText className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {i % 2 === 0 ? `Facture #${2024000 + i} créée` : `Paiement reçu de Client ${i}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Il y a {i + 2} heures • Par {i % 2 === 0 ? 'Système' : 'Comptabilité'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {i % 2 === 0 ? '1,200.00 €' : '+ 3,450.00 €'}
                  </p>
                  <span className="text-xs text-gray-400 group-hover:text-blue-500 flex items-center justify-end gap-1">
                    Voir <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel / Quick Access */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Accès Rapide</h3>
            <div className="space-y-2">
              <button onClick={() => router.push(`/org/${orgId}/erp/invoices/new`)} className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200">
                <span className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded">
                    <FileText className="w-4 h-4" />
                  </div>
                  Nouvelle Facture
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => router.push(`/org/${orgId}/erp/clients?action=new`)} className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200">
                <span className="flex items-center gap-3">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded">
                    <Users className="w-4 h-4" />
                  </div>
                  Nouveau Client
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => router.push(`/org/${orgId}/daf`)} className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200">
                <span className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  Upload Document
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* AI Insight */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-start gap-3 mb-3">
              <Sparkles className="w-6 h-6 text-yellow-300 shrink-0" />
              <div>
                <h3 className="font-bold text-lg">Conseil IA</h3>
                <p className="text-indigo-100 text-sm mt-1">
                  Votre trésorerie est stable, mais 3 clients ont dépassé l'échéance. Voulez-vous que je prépare des relances ?
                </p>
              </div>
            </div>
            <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/20">
              Préparer les relances
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
