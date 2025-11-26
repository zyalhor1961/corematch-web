'use client';

import React, { useState, useMemo, useEffect } from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { SmartDataGrid } from '@/components/BI/SmartDataGrid';
import { createBrowserClient } from '@supabase/ssr';
import {
    LayoutDashboard,
    Wallet,
    PieChart,
    FileText,
    Scale,
    BookOpen,
    History,
    BarChart3
} from 'lucide-react';
import {
    REPORT_TRANSFORMERS,
    ReportType,
    ReportData
} from '@/lib/reports';

// --- TABS CONFIGURATION ---
const REPORT_TABS: { id: ReportType | 'dashboard'; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'aging_balance', label: 'Balance Âgée', icon: History },
    { id: 'vendor_spend', label: 'Dépenses Fournisseurs', icon: Wallet },
    { id: 'pnl', label: 'Compte de Résultat', icon: PieChart },
    { id: 'vat_report', label: 'Rapport TVA', icon: FileText },
    { id: 'general_ledger', label: 'Grand Livre', icon: BookOpen },
];

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<ReportType | 'dashboard'>('dashboard');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- 1. FETCH DATA ONCE ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setInvoices(data || []);
            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- 2. TRANSFORM DATA BASED ON ACTIVE TAB ---
    const reportData: ReportData | null = useMemo(() => {
        if (activeTab === 'dashboard') return null;

        const transformer = REPORT_TRANSFORMERS[activeTab as ReportType];
        if (!transformer) return null;

        return transformer(invoices);
    }, [activeTab, invoices]);

    // --- 3. DASHBOARD VIEW (DEFAULT) ---
    const dashboardView = useMemo(() => {
        // Calculate summary stats
        const totalSpend = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
        const invoiceCount = invoices.length;
        const pendingCount = invoices.filter(inv => inv.status === 'pending').length;

        // Prepare data for main grid (Raw Invoices)
        const columns = [
            { key: 'invoice_number', label: 'N° Facture', type: 'text' },
            { key: 'client_name', label: 'Fournisseur', type: 'text' },
            { key: 'date_issued', label: 'Date', type: 'date' },
            { key: 'due_date', label: 'Échéance', type: 'date' },
            { key: 'total_amount', label: 'Montant', type: 'currency' },
            { key: 'status', label: 'Statut', type: 'text' },
        ];

        return (
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-[#0F172A]/60 backdrop-blur-xl border border-white/5 rounded-2xl">
                        <div className="text-slate-400 text-sm mb-1">Dépenses Totales</div>
                        <div className="text-3xl font-bold text-white">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalSpend)}
                        </div>
                    </div>
                    <div className="p-6 bg-[#0F172A]/60 backdrop-blur-xl border border-white/5 rounded-2xl">
                        <div className="text-slate-400 text-sm mb-1">Factures Traitées</div>
                        <div className="text-3xl font-bold text-white">{invoiceCount}</div>
                    </div>
                    <div className="p-6 bg-[#0F172A]/60 backdrop-blur-xl border border-white/5 rounded-2xl">
                        <div className="text-slate-400 text-sm mb-1">En Attente</div>
                        <div className="text-3xl font-bold text-amber-400">{pendingCount}</div>
                    </div>
                </div>

                {/* Main Grid */}
                <SmartDataGrid
                    title="Toutes les Factures"
                    data={invoices}
                    columns={columns}
                    className="h-[600px]"
                />
            </div>
        );
    }, [invoices]);

    return (
        <PageContainer
            title="Rapports Financiers"
            subtitle="Analysez vos données financières en temps réel"
        >
            <div className="flex flex-col h-full space-y-6">

                {/* --- TABS NAVIGATION --- */}
                <div className="flex overflow-x-auto pb-2 gap-2 border-b border-white/10">
                    {REPORT_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                  flex items-center gap-2 px-4 py-3 rounded-t-lg transition-all whitespace-nowrap
                  ${isActive
                                        ? 'bg-teal-500/10 text-teal-400 border-b-2 border-teal-500'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}
                `}
                            >
                                <Icon size={18} />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* --- CONTENT AREA --- */}
                <div className="flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
                        </div>
                    ) : activeTab === 'dashboard' ? (
                        dashboardView
                    ) : (
                        <SmartDataGrid
                            key={activeTab} // Force re-mount on tab change
                            title={REPORT_TABS.find(t => t.id === activeTab)?.label}
                            data={reportData?.data || []}
                            columns={reportData?.columns}
                            className="h-[calc(100vh-250px)]"
                        />
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
