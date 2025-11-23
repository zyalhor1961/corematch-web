"use client";

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { Plus, Download, Filter } from 'lucide-react';

export default function ShellDemoPage() {
    return (
        <PageContainer
            title="Tableau de bord"
            actions={
                <>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Filter className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Download className="w-5 h-5" />
                    </button>
                </>
            }
        >
            {/* Dummy Content to simulate existing page content */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Revenu Total', value: '$124,500.00', trend: '+12.5%' },
                        { label: 'En attente', value: '$32,100.00', trend: '+4.2%' },
                        { label: 'En retard', value: '$8,450.00', trend: '-2.1%', negative: true },
                        { label: 'Brouillons', value: '12', sub: 'Factures' },
                    ].map((stat, i) => (
                        <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-lg">
                            <p className="text-sm text-slate-400">{stat.label}</p>
                            <div className="flex items-end justify-between mt-2">
                                <p className="text-2xl font-mono text-white">{stat.value}</p>
                                {stat.trend && (
                                    <span className={`text-xs font-medium ${stat.negative ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {stat.trend}
                                    </span>
                                )}
                                {stat.sub && <span className="text-xs text-slate-500">{stat.sub}</span>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 text-center border border-dashed border-white/10 rounded-lg">
                    <p className="text-slate-400">Bienvenue sur CoreMatch OS. Sélectionnez un module dans la barre latérale pour commencer.</p>
                </div>
            </div>
        </PageContainer>
    );
}
