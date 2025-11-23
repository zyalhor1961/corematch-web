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
  Moon,
  Search,
  Command,
  Sparkles,
  Receipt,
  Keyboard,
  CheckCircle,
  Landmark,
  TrendingUp,
  Clock,
  ShoppingCart,
  BookOpen,
  Link2,
  ClipboardList
} from 'lucide-react';
import { CommandBar } from '@/components/CommandBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { HelpShortcutsOverlay } from '@/components/HelpShortcutsOverlay';

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
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false); // Desktop

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

  // Keyboard shortcuts
  const { shortcuts, showHelp, setShowHelp } = useKeyboardShortcuts({ orgId, enabled: !isLoading });

  // Role-based shortcuts
  const getRoleShortcuts = (role: string) => {
    // Mock logic - in real app, this would be more sophisticated
    if (role === 'accountant' || role === 'admin') { // Assuming admin gets accountant view for now
      return [
        { name: 'À valider', href: `/org/${orgId}/erp/invoices?status=draft`, icon: CheckCircle, color: 'text-orange-500' },
        { name: 'Relances', href: `/org/${orgId}/erp/invoices?status=overdue`, icon: AlertTriangle, color: 'text-red-500' },
        { name: 'Trésorerie', href: `/org/${orgId}/erp/bank`, icon: Landmark, color: 'text-blue-500' },
      ];
    }
    return [
      { name: 'Cash Flow', href: `/org/${orgId}/erp`, icon: TrendingUp, color: 'text-green-500' },
      { name: 'Relances', href: `/org/${orgId}/erp/invoices?status=overdue`, icon: Clock, color: 'text-red-500' },
      { name: 'Suggestions', href: `/org/${orgId}/daf?tab=ask`, icon: Sparkles, color: 'text-purple-500' },
    ];
  };

  const roleShortcuts = organization ? getRoleShortcuts(organization.role) : [];

  // Navigation structure (Hub-based)
  const navigationSections = [
    {
      title: 'Workspaces',
      icon: Sparkles,
      items: [
        { name: 'Vue d\'ensemble', href: `/org/${orgId}`, icon: BarChart3 },
        { name: 'CV Studio', href: `/org/${orgId}/cv`, icon: Users, aiPowered: true },
        { name: 'DAF Docs', href: `/org/${orgId}/daf`, icon: FileText, aiPowered: true },
        { name: 'DEB Assistant Pro', href: `/org/${orgId}/deb`, icon: FileText, aiPowered: true },
      ],
    },
    {
      title: 'Sales Hub',
      icon: TrendingUp,
      items: [
        { name: 'Clients', href: `/org/${orgId}/erp/clients`, icon: Users },
        { name: 'Devis', href: `/org/${orgId}/erp/quotes`, icon: FileText },
        { name: 'Factures', href: `/org/${orgId}/erp/invoices`, icon: FileText },
      ],
    },
    {
      title: 'Purchase Hub',
      icon: ShoppingCart,
      items: [
        { name: 'Fournisseurs', href: `/org/${orgId}/erp/suppliers`, icon: Building2 },
        { name: 'Achats', href: `/org/${orgId}/erp/purchases`, icon: ShoppingCart },
        { name: 'Dépenses', href: `/org/${orgId}/erp/expenses`, icon: Receipt },
      ],
    },
    {
      title: 'Finance Hub',
      icon: Landmark,
      items: [
        { name: 'Journaux', href: `/org/${orgId}/erp/accounting`, icon: BookOpen },
        { name: 'Banque', href: `/org/${orgId}/erp/bank`, icon: Landmark },
        { name: 'Lettrage', href: `/org/${orgId}/erp/lettrage`, icon: Link2 },
        { name: 'Plan Comptable', href: `/org/${orgId}/erp/chart-of-accounts`, icon: ClipboardList },
      ],
    },
    {
      title: 'Paramètres',
      icon: Settings,
      items: [
        { name: 'Paramètres', href: `/org/${orgId}/settings`, icon: Settings },
      ],
    },
  ];

  // Flat navigation for mobile
  const navigation = [
    { name: 'Vue d\'ensemble', href: `/org/${orgId}`, icon: BarChart3 },
    { name: 'CV Screening', href: `/org/${orgId}/cv`, icon: Users },
    { name: 'Documents DAF', href: `/org/${orgId}/daf`, icon: FileText },
    { name: 'DEB Assistant', href: `/org/${orgId}/deb`, icon: FileText },
    { name: 'Core ERP', href: `/org/${orgId}/erp`, icon: Receipt },
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
      <div className="min-h-screen flex items-center justify-center !bg-cm-bg">
        <div className="text-center p-8">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-400">Chargement de votre espace de travail...</p>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Erreur</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
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
    <div className="min-h-screen !bg-cm-bg text-gray-900 dark:text-gray-100">
      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-cm-surface shadow-xl">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xl font-semibold text-gray-900 dark:text-white">CoreMatch</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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

      {/* Desktop sidebar (Contextual Spine) */}
      <div
        className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out z-30 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-cm-surface ${isSidebarExpanded ? 'w-64' : 'w-16'
          }`}
      >
        <div className="flex flex-col flex-grow overflow-hidden">
          {/* Logo & Toggle */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className="flex items-center w-full focus:outline-none group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className={`ml-3 text-lg font-bold text-gray-900 dark:text-white transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                }`}>
                CoreMatch
              </span>
            </button>
          </div>

          {/* Role Shortcuts (Contextual) */}
          <div className="py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
            <div className="space-y-1 px-2">
              {roleShortcuts.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    className="flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 group relative"
                    title={!isSidebarExpanded ? item.name : undefined}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${item.color}`} />
                    <span className={`ml-3 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                      }`}>
                      {item.name}
                    </span>

                    {/* Tooltip for collapsed state */}
                    {!isSidebarExpanded && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Navigation with sections */}
          <nav className="flex-1 py-4 space-y-6 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {/* Dashboard link */}
            <div className="px-2">
              <Link
                href={`/org/${orgId}`}
                className={`flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors group relative ${pathname === `/org/${orgId}`
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                title={!isSidebarExpanded ? "Vue d'ensemble" : undefined}
              >
                <BarChart3 className="w-5 h-5 shrink-0" />
                <span className={`ml-3 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                  }`}>
                  Vue d'ensemble
                </span>
              </Link>
            </div>

            {/* Sections */}
            {navigationSections.map((section) => (
              <div key={section.title} className="px-2">
                {isSidebarExpanded && (
                  <div className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider transition-opacity duration-300">
                    {section.title}
                  </div>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors group relative ${isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        title={!isSidebarExpanded ? item.name : undefined}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className={`ml-3 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                          }`}>
                          {item.name}
                        </span>
                        {(item as any).aiPowered && isSidebarExpanded && (
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                            IA
                          </span>
                        )}

                        {/* Tooltip for collapsed state */}
                        {!isSidebarExpanded && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-800 shrink-0 space-y-1">
            {/* Command Bar Trigger */}
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group relative"
              title={!isSidebarExpanded ? "Rechercher (Cmd+K)" : undefined}
            >
              <Search className="w-5 h-5 shrink-0" />
              <span className={`ml-3 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                }`}>
                Rechercher
              </span>
              {isSidebarExpanded && (
                <kbd className="ml-auto px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-500">⌘K</kbd>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group relative"
              title={!isSidebarExpanded ? (isDarkMode ? "Mode clair" : "Mode sombre") : undefined}
            >
              {isDarkMode ? <Sun className="w-5 h-5 shrink-0 text-amber-400" /> : <Moon className="w-5 h-5 shrink-0" />}
              <span className={`ml-3 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                }`}>
                {isDarkMode ? 'Mode clair' : 'Mode sombre'}
              </span>
            </button>

            {/* User Profile */}
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-800">
              <div className={`flex items-center px-2 py-2 rounded-lg transition-colors ${isSidebarExpanded ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shrink-0 text-white font-medium text-xs">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className={`ml-3 overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                  }`}>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
                    {user?.email}
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'lg:pl-64' : 'lg:pl-16'}`}>
        {/* Mobile header */}
        <div className="lg:hidden border-b px-4 py-3 bg-white dark:bg-cm-surface border-gray-200 dark:border-gray-700 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {organization?.org_name}
            </h1>
            <div className="w-10"></div> {/* Spacer for balance */}
          </div>
        </div>

        {/* Page content */}
        <main className="p-6 min-h-screen">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Keyboard shortcuts help overlay */}
      <HelpShortcutsOverlay
        shortcuts={shortcuts}
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Command Bar (Hidden but active) */}
      <CommandBar orgId={orgId} />
    </div>
  );
}