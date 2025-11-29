'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Target, Activity, Bell } from 'lucide-react';

interface SharkTabsNavProps {
    orgId: string;
    alertsCount?: number;
}

const TABS = [
    {
        key: 'radar',
        label: 'Opportunites',
        icon: Target,
        path: (orgId: string) => `/org/${orgId}/shark/radar`,
        tooltip: 'Toutes les opportunites detectees pour vous par notre IA',
    },
    {
        key: 'activity',
        label: 'Historique',
        icon: Activity,
        path: (orgId: string) => `/org/${orgId}/shark/activity`,
        tooltip: 'Suivi dynamique de l\'activite du marche - l\'IA surveille pour vous',
    },
    {
        key: 'alerts',
        label: 'Alertes',
        icon: Bell,
        path: (orgId: string) => `/org/${orgId}/shark/alerts`,
        tooltip: 'Les signaux critiques detectes automatiquement - ne manquez jamais un projet important',
    },
];

export default function SharkTabsNav({ orgId, alertsCount = 0 }: SharkTabsNavProps) {
    const pathname = usePathname();

    // Determine active tab based on current path
    const getActiveTab = () => {
        if (pathname.includes('/shark/activity')) return 'activity';
        if (pathname.includes('/shark/alerts')) return 'alerts';
        if (pathname.includes('/shark/radar') || pathname.includes('/shark/projects')) return 'radar';
        return 'radar';
    };

    const activeTab = getActiveTab();

    return (
        <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-white/10 rounded-xl mb-6">
            {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                const href = tab.path(orgId);

                return (
                    <Link
                        key={tab.key}
                        href={href}
                        title={tab.tooltip}
                        className={`
                            relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
                            ${isActive
                                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }
                        `}
                    >
                        <Icon size={18} />
                        <span>{tab.label}</span>
                        {tab.key === 'alerts' && alertsCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                                {alertsCount > 9 ? '9+' : alertsCount}
                            </span>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
