'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Sparkles,
  Zap,
  Radar,
  KanbanSquare,
  Users,
  FileText,
  Landmark,
  PieChart,
  FolderOpen,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SidebarTooltip } from './SidebarTooltip';
import { useSidebar } from './SidebarContext';

interface SidebarProps {
  /** Force expanded mode (for mobile overlay) */
  forceExpanded?: boolean;
}

export default function Sidebar({ forceExpanded = false }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params.orgId as string;

  const { isCollapsed: contextCollapsed, toggleCollapse, closeMobile } = useSidebar();

  // Mobile sidebar is always expanded
  const isCollapsed = forceExpanded ? false : contextCollapsed;

  // Navigation structure
  const navigation = [
    {
      title: "PILOTAGE",
      items: [
        { name: 'Tableau de bord', href: `/org/${orgId}`, icon: LayoutDashboard, exact: true },
        { name: 'Smart Insights IA', href: `/org/${orgId}/daf`, icon: Sparkles, highlight: true },
        { name: 'Morning Briefing', href: `/org/${orgId}/briefing`, icon: Zap },
      ]
    },
    {
      title: "REVENUS",
      items: [
        { name: 'Sourcing IA', href: `/org/${orgId}/crm/sourcing`, icon: Radar, highlight: true },
        { name: 'Pipeline Leads', href: `/org/${orgId}/crm/leads`, icon: KanbanSquare },
        { name: 'Clients', href: `/org/${orgId}/erp/clients`, icon: Users },
      ]
    },
    {
      title: "DÉPENSES",
      items: [
        { name: 'Factures Fournisseurs', href: `/org/${orgId}/erp/invoices`, icon: FileText },
        { name: 'Banque & Cash', href: `/org/${orgId}/erp/banking`, icon: Landmark },
        { name: 'Rapports', href: `/org/${orgId}/reports`, icon: PieChart },
      ]
    },
    {
      title: "OPÉRATIONS",
      items: [
        { name: 'Documents', href: `/org/${orgId}/docs`, icon: FolderOpen },
        { name: 'Paramètres', href: `/org/${orgId}/settings`, icon: Settings },
      ]
    },
  ];

  // Determine if a nav item is active
  const isItemActive = (item: { href: string; exact?: boolean }) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname?.startsWith(item.href + '/');
  };

  // Handle link click (close mobile menu)
  const handleLinkClick = () => {
    closeMobile();
  };

  return (
    <div className="h-full w-full flex flex-col text-slate-300 font-sans relative overflow-hidden">
      {/* LOGO AREA */}
      <div className="h-20 flex items-center px-4 flex-shrink-0">
        <motion.div layout className="flex items-center">
          {/* Logo Icon - Always visible */}
          <div className="w-10 h-10 relative flex items-center justify-center flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00B4D8] to-[#2979FF] rounded-xl opacity-20 blur-md" />
            <div className="relative w-full h-full bg-gradient-to-br from-[#00B4D8] to-[#2979FF] rounded-xl flex items-center justify-center shadow-inner border border-white/10">
              <span className="font-bold text-white text-xl">C</span>
            </div>
          </div>

          {/* Logo Text - Only in expanded mode */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-3 font-bold text-white tracking-tight text-lg whitespace-nowrap"
              >
                CoreMatch
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* NAVIGATION SCROLLABLE */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3">
        {navigation.map((section, sectionIndex) => (
          <div key={section.title}>
            {/* Section Title / Divider */}
            {isCollapsed ? (
              // Collapsed: Show subtle divider
              sectionIndex > 0 && (
                <div className="my-4 mx-2 border-t border-white/5" />
              )
            ) : (
              // Expanded: Show section title
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${
                  sectionIndex === 0 ? 'mb-2' : 'mt-6 mb-2'
                }`}
              >
                {section.title}
              </motion.h3>
            )}

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = isItemActive(item);
                const linkContent = (
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`group flex items-center rounded-lg transition-all duration-200 ${
                      isCollapsed
                        ? 'justify-center px-2 py-2.5'
                        : 'px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-teal-400/10 text-teal-400 border border-teal-400/20 shadow-[0_0_10px_rgba(45,212,191,0.1)]'
                        : 'hover:bg-white/5 hover:text-white text-slate-400'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 flex-shrink-0 transition-colors ${
                        isActive
                          ? 'text-teal-400'
                          : item.highlight
                            ? 'text-amber-400 group-hover:text-amber-300'
                            : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />

                    {/* Text Label - Only in expanded mode */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* IA Badge - Only in expanded mode */}
                    {!isCollapsed && item.highlight && !isActive && (
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 uppercase tracking-wide">
                        IA
                      </span>
                    )}
                  </Link>
                );

                // Wrap with tooltip in collapsed mode (desktop only)
                return (
                  <SidebarTooltip
                    key={item.name}
                    content={item.name}
                    enabled={isCollapsed && !forceExpanded}
                  >
                    {linkContent}
                  </SidebarTooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* FOOTER */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#020617]/30">
        {/* Collapse Toggle Button - Desktop only */}
        {!forceExpanded && (
          <div className="p-3">
            <button
              onClick={toggleCollapse}
              className={`w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 text-slate-500" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5 text-slate-500 mr-3" />
                  <span>Réduire</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Logout Button */}
        <div className="px-3 pb-2">
          <SidebarTooltip content="Déconnexion" enabled={isCollapsed && !forceExpanded}>
            <button
              className={`w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut className="h-5 w-5 text-slate-500 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3">Déconnexion</span>}
            </button>
          </SidebarTooltip>
        </div>

        {/* User Profile */}
        <div className={`p-4 border-t border-white/5 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <SidebarTooltip content="Mon profil" enabled={isCollapsed && !forceExpanded}>
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/10 flex-shrink-0 flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>

              {/* User Info - Only in expanded mode */}
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium text-white truncate">Utilisateur</p>
                    <p className="text-xs text-slate-500 truncate">Admin</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SidebarTooltip>
        </div>
      </div>
    </div>
  );
}
