'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { MyOrg } from '@/lib/types';
import { useTheme } from '@/app/components/ThemeProvider';
import { AlertTriangle } from 'lucide-react';
import { 
  Building2, 
  BarChart3, 
  Users, 
  FileText, 
  Settings, 
  CreditCard,
  LogOut,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const [organization, setOrganization] = useState<MyOrg | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const orgId = params?.orgId as string;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: orgData, error: orgError } = await supabase
        .from('my_orgs')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error("Organisation non trouvée ou accès non autorisé.");

      setOrganization(orgData);
    } catch (err: any) {
      console.error('Error loading organization data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, router]);

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId, loadData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navigation = [
    { name: 'Vue d\'ensemble', href: `/org/${orgId}`, icon: BarChart3 },
    { name: 'CV Screening', href: `/org/${orgId}/cv`, icon: Users },
    { name: 'DEB Assistant', href: `/org/${orgId}/deb`, icon: FileText },
    // { name: 'Membres', href: `/org/${orgId}/members`, icon: Users }, // TODO: Create members page
    { name: 'Facturation', href: `/org/${orgId}/billing`, icon: CreditCard },
    { name: 'Paramètres', href: `/org/${orgId}/settings`, icon: Settings },
  ];

  const NavLink = ({ item }: { item: { name: string; href: string; icon: React.ElementType } }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
            ? (isDarkMode ? 'bg-gray-700 text-white' : 'bg-blue-50 text-blue-600')
            : (isDarkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100')}`}
      >
        <Icon className={`w-5 h-5 mr-3 ${isActive ? (isDarkMode ? 'text-white' : 'text-blue-600') : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`} />
        {item.name}
      </Link>
    );
  };

  if (isLoading || error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="text-center p-8">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Chargement de votre espace de travail...</p>
            </>
          ) : (
            <div className="bg-white p-8 rounded-lg shadow-md">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Erreur</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retour au tableau de bord
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75" onClick={() => setSidebarOpen(false)}>
          <div className={`fixed inset-y-0 left-0 w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between h-16 px-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <span className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>CoreMatch</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-2 rounded-md ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {/* Mobile navigation */}
            <nav className="p-4 space-y-2">
              {navigation.map((item) => <NavLink key={item.name} item={item} />)}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className={`flex flex-col flex-grow border-r ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          {/* Logo */}
          <div className={`flex items-center h-16 px-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Link href="/" className="text-xl font-semibold text-slate-600">
              CoreMatch
            </Link>
          </div>

          {/* Organization info */}
          <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1 min-w-0">
                <Building2 className={`w-8 h-8 mr-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {organization?.org_name}
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Plan {organization?.plan} • {organization?.role}
                  </p>
                </div>
              </div>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-amber-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
                title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Navigation */}
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => <NavLink key={item.name} item={item} />)}
          </nav>

          {/* User menu */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center mb-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Link
                href="/dashboard"
                className={`flex items-center px-3 py-2 text-sm rounded-md ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Mes organisations
              </Link>
              <button
                onClick={handleSignOut}
                className={`flex items-center w-full px-3 py-2 text-sm rounded-md ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className={`lg:hidden border-b px-4 py-3 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`p-2 rounded-md ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {organization?.org_name}
            </h1>
            {/* Theme Toggle Button for Mobile */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Page content */}
        <main className={`p-6 min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}