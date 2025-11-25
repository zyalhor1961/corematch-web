'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  LayoutDashboard,
  Sun,
  TrendingUp,
  ShoppingCart,
  Building2,
  Briefcase,
  Package,
  Users,
  Settings,
  LogOut,
  PieChart,
  Truck
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params.orgId as string; // Récupère l'ID de l'organisation actuelle

  // Définition de la structure "Omni-ERP"
  const navigation = [
    {
      title: "PILOTAGE",
      items: [
        { name: 'Tableau de bord', href: `/org/${orgId}`, icon: LayoutDashboard },
        { name: 'Morning Briefing', href: `/org/${orgId}/briefing`, icon: Sun, highlight: true }, // Petit bonus visuel
      ]
    },
    {
      title: "FINANCE HUB",
      items: [
        { name: 'Ventes (Clients)', href: `/org/${orgId}/erp/sales`, icon: TrendingUp },
        { name: 'Achats (Fournisseurs)', href: `/org/${orgId}/erp/invoices`, icon: ShoppingCart }, // C'est notre page actuelle
        { name: 'Trésorerie & Banque', href: `/org/${orgId}/erp/bank`, icon: Building2 },
        { name: 'Rapports & Bilan', href: `/org/${orgId}/erp/reports`, icon: PieChart },
      ]
    },
    {
      title: "OPERATIONS HUB",
      items: [
        { name: 'Projets & Missions', href: `/org/${orgId}/ops/projects`, icon: Briefcase },
        { name: 'Stocks & Produits', href: `/org/${orgId}/ops/inventory`, icon: Package },
        { name: 'Logistique', href: `/org/${orgId}/ops/logistics`, icon: Truck },
      ]
    },
    {
      title: "CAPITAL HUMAIN",
      items: [
        { name: 'Équipe & Paie', href: `/org/${orgId}/hr/team`, icon: Users },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-64 h-screen bg-[#0B1120] border-r border-white/5 flex flex-col text-slate-300 font-sans z-50 transform transition-transform duration-300 ease-out md:translate-x-0 relative overflow-hidden shadow-2xl">

        {/* Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-[#00E5FF]/10 blur-[80px] rounded-full pointer-events-none" />

        {/* LOGO AREA */}
        <div className="h-20 flex items-center px-6 relative z-10">
          <div className="w-10 h-10 relative flex items-center justify-center mr-3">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF] to-[#2979FF] rounded-xl opacity-20 blur-md"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-[#00E5FF] to-[#2979FF] rounded-xl flex items-center justify-center shadow-inner border border-white/10">
              <span className="font-bold text-white text-xl">C</span>
            </div>
          </div>
          <span className="font-bold text-white tracking-tight text-lg">CoreMatch</span>
        </div>

        {/* NAVIGATION SCROLLABLE */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 relative z-10">
          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
                          ? 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 shadow-[0_0_10px_rgba(0,229,255,0.1)]'
                          : 'hover:bg-white/5 hover:text-white text-slate-400'
                        }`}
                    >
                      <item.icon
                        className={`mr-3 h-5 w-5 transition-colors ${isActive
                            ? 'text-[#00E5FF]'
                            : item.highlight ? 'text-orange-400 group-hover:text-orange-300' : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* FOOTER (User & Settings) */}
        <div className="p-4 border-t border-white/5 bg-[#0B1120]/50 relative z-10">
          <div className="space-y-1">
            <Link href={`/org/${orgId}/settings`} className="flex items-center px-3 py-2 text-sm font-medium text-slate-400 rounded-lg hover:bg-white/5 hover:text-white transition-colors">
              <Settings className="mr-3 h-5 w-5 text-slate-500" />
              Paramètres
            </Link>
            <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-slate-400 rounded-lg hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
              <LogOut className="mr-3 h-5 w-5 text-slate-500 group-hover:text-rose-400" />
              Déconnexion
            </button>
          </div>

          <div className="mt-4 px-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/10" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Zyad Alhor</p>
              <p className="text-xs text-slate-500 truncate">Admin</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
