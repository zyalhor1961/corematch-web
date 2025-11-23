
"use client";

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { Plus, Download, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 1. The Data Source
const INVOICE_DATA = [
    { id: 'INV-001', client: 'Acme Corp', date: 'Oct 24, 2023', amount: '1,200.00', status: 'Payé' },
    { id: 'INV-002', client: 'Globex Inc', date: 'Oct 25, 2023', amount: '3,450.00', status: 'En attente' },
    { id: 'INV-003', client: 'Soylent Corp', date: 'Oct 26, 2023', amount: '850.00', status: 'En retard' },
    { id: 'INV-004', client: 'Umbrella Corp', date: 'Oct 27, 2023', amount: '12,000.00', status: 'Payé' },
    { id: 'INV-005', client: 'Stark Ind', date: 'Oct 28, 2023', amount: '5,600.00', status: 'En attente' },
];

// Helper for Status Badges
const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        'Payé': 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
        'En attente': 'bg-amber-400/10 text-amber-400 border-amber-400/20',
        'En retard': 'bg-red-400/10 text-red-400 border-red-400/20',
    };

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles['En attente']}`}>
            {status}
        </span>
    );
};

export default function InvoicesPage() {
    const router = useRouter();

    return (
        <PageContainer
            title="Factures"
            actions={
                <>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Filter className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Download className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => router.push('/shell-demo/invoices/new')}
                        className="flex items-center px-4 py-2 bg-neon-teal text-navy-glass font-bold rounded-lg hover:bg-neon-teal/90 transition-colors shadow-[0_0_15px_rgba(0,180,216,0.3)]"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouvelle Facture
                    </button>
                </>
            }
        >
            <div className="bg-navy-glass/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4 font-medium">Réf</th>
                            <th className="px-6 py-4 font-medium">Client</th>
                            <th className="px-6 py-4 font-medium">Date</th>
                            <th className="px-6 py-4 font-medium">Montant</th>
                            <th className="px-6 py-4 font-medium">Statut</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {INVOICE_DATA.map((inv) => (
                            <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                <td className="px-6 py-4 font-mono text-slate-300">{inv.id}</td>
                                <td className="px-6 py-4 text-white font-medium">{inv.client}</td>
                                <td className="px-6 py-4 text-slate-400">{inv.date}</td>
                                <td className="px-6 py-4 font-mono text-slate-200">${inv.amount}</td>
                                <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-neon-teal transition-colors opacity-0 group-hover:opacity-100">Voir détails</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageContainer>
    );
}
