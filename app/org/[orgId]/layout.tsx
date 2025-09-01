'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { MyOrg } from '@/lib/types';
import { 
  Building2, 
  BarChart3, 
  Users, 
  FileText, 
  Settings, 
  CreditCard,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
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
          .eq('org_id', orgId)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75" onClick={() => setSidebarOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white">
            <div className="flex items-center justify-between h-16 px-4 border-b">
              <span className="text-xl font-semibold text-gray-900">CoreMatch</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600"
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
                    className="flex items-center px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100"
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
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <Link href="/" className="text-xl font-semibold text-blue-600">
              CoreMatch
            </Link>
          </div>

          {/* Organization info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-gray-400 mr-3" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {organization?.org_name}
                </p>
                <p className="text-xs text-gray-500">
                  Plan {organization?.plan} • {organization?.role}
                </p>
              </div>
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
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon className="w-5 h-5 mr-3 text-gray-400" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-sm font-medium text-blue-600">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Link
                href="/dashboard"
                className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Mes organisations
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100"
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
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              {organization?.org_name}
            </h1>
            <div className="w-8" /> {/* Spacer */}
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