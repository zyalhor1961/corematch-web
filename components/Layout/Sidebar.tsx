'use client';

import React from 'react';
import { LayoutDashboard, FileText, Users, Landmark, BarChart3, User } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const params = useParams();
    const orgId = params && params.orgId ? params.orgId as string : undefined;

    const navItems = orgId ? [
        { name: 'Tableau de bord', icon: LayoutDashboard, href: `/org/${orgId}` },
        { name: 'Factures', icon: FileText, href: `/org/${orgId}/erp/invoices` },
        { name: 'Clients', icon: Users, href: `/org/${orgId}/erp/clients` },
        { name: 'Banque', icon: Landmark, href: `/org/${orgId}/erp/bank` },
        { name: 'Rapports', icon: BarChart3, href: `/org/${orgId}/erp/reports` },
    ] : [
        { name: 'Tableau de bord', icon: LayoutDashboard, href: '/shell-demo' },
        { name: 'Factures', icon: FileText, href: '/shell-demo/invoices' },
        { name: 'Clients', icon: Users, href: '/shell-demo/clients' },
        { name: 'Banque', icon: Landmark, href: '/shell-demo/banking' },
        { name: 'Rapports', icon: BarChart3, href: '/shell-demo/reports' },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <aside className={`fixed left-0 top-0 h-full w-64 flex flex-col bg-navy-glass/95 backdrop-blur-md border-r border-white/10 z-50 transform transition-transform duration-300 ease-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-white/10">
                    <span className="text-xl font-bold text-neon-teal tracking-tight">CoreMatch OS</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => onClose()} // Close on mobile navigation
                            className="group relative flex items-center px-6 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        >
                            {/* Active Indicator (Simulated for demo) */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-teal opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,180,216,0.6)]" />

                            <item.icon className="w-5 h-5 mr-3 group-hover:text-neon-teal transition-colors" />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-teal to-agent-purple flex items-center justify-center text-white font-bold text-xs">
                            JD
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-white">John Doe</p>
                            <p className="text-xs text-slate-400">Admin</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
