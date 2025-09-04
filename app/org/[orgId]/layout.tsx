'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { MyOrg } from '@/lib/types';
import { useTheme } from '@/app/components/ThemeProvider';
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
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [organization, setOrganization] = useState<MyOrg | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const orgId = params?.orgId as string;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // Get organization details
        const { data: orgData, error: orgError } = await supabase
          .from('my_orgs')
          .select('*')
          .eq('id', orgId)
          .single();

        if (orgError || !orgData) {
          router.push('/dashboard');
          return;
        }

        setOrganization(orgData);
      } catch (error) {
        console.error('Error loading data:', error);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (orgId) {
      loadData();
    }
  }, [orgId, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navigation = [
    {
      name: 'Vue d\'ensemble',
      href: `/org/${orgId}`,
      icon: BarChart3,
      current: true
    },
    {
      name: 'CV Screening',
      href: `/org/${orgId}/cv`,
      icon: Users,
      current: false
    },
    {
      name: 'DEB Assistant',
      href: `/org/${orgId}/deb`,
      icon: FileText,
      current: false
    },
    {
      name: 'Membres',
      href: `/org/${orgId}/members`,
      icon: Users,
      current: false
    },
    {
      name: 'Facturation',
      href: `/org/${orgId}/billing`,
      icon: CreditCard,
      current: false
    },
    {
      name: 'Paramètres',
      href: `/org/${orgId}/settings`,
      icon: Settings,
      current: false
    }
  ];

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
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
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-md ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
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
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${isDarkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
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
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}