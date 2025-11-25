'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowRight } from 'lucide-react';
import InvoiceDrawer from './InvoiceDrawer';

type Invoice = {
    id: string;
    invoice_number: string;
    client_name: string;
    date_issued: string;
    total_amount: number;
    status: string;
};

export default function InvoiceListTable({ orgId }: { orgId: string }) {
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching invoices:', error);
                setInvoices([]);
            } else {
                const mapped = (data || []).map((inv: any) => ({
                    id: inv.id,
                    invoice_number: inv.invoice_number,
                    client_name: inv.client_name || 'Unknown',
                    date_issued: inv.date_issued,
                    total_amount: inv.total_amount,
                    status: inv.status,
                }));
                setInvoices(mapped);
            }
            setLoading(false);
        };
        fetchInvoices();
    }, [orgId, supabase]);

    const getStatusStyle = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'pending':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'overdue':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            default:
                return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400 animate-pulse">Loading invoices...</div>;
    }

    return (
        <>
            {/* THE PREMIUM CARD CONTAINER */}
            <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]/40 backdrop-blur-xl shadow-2xl shadow-black/50 relative">

                {/* Subtle Top Gradient Highlight (The "Premium Shine") */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent opacity-50" />

                <table className="w-full text-left text-sm">
                    {/* HEADER: Darker, Matte */}
                    <thead className="bg-transparent text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">Reference</th>
                            <th className="px-6 py-4">Client</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>

                    {/* BODY: High Contrast, Hover Glows */}
                    <tbody className="divide-y divide-white/5">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-slate-600 font-light">
                                    No invoices found. Start by uploading one.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((invoice) => (
                                <tr
                                    key={invoice.id}
                                    onClick={() => setSelectedInvoiceId(invoice.id)}
                                    className="group cursor-pointer transition-all duration-200 hover:bg-white/[0.02]"
                                >
                                    <td className="px-6 py-4 font-mono text-slate-400 group-hover:text-teal-400 transition-colors">
                                        {invoice.invoice_number || invoice.id.slice(0, 8)}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-200 group-hover:text-white">
                                        {invoice.client_name || 'Unknown Client'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(invoice.date_issued).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-300 tracking-wide">
                                        €{Number(invoice.total_amount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {/* Clean Status Badges */}
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${invoice.status === 'APPROVED'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                            : invoice.status === 'NEEDS_APPROVAL'
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                                            }`}>
                                            {invoice.status === 'APPROVED' ? 'Validée' : invoice.status === 'NEEDS_APPROVAL' ? 'À Valider' : invoice.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                            <ArrowRight size={16} className="text-teal-500" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* FOOTER: Clean, minimal */}
                <div className="border-t border-white/5 bg-[#020617] px-6 py-3 text-xs text-slate-600 flex justify-between items-center">
                    <span>Total: {invoices.length}</span>
                    <div className="flex gap-2">
                        <button className="hover:text-white transition-colors">Précédent</button>
                        <button className="hover:text-white transition-colors">Suivant</button>
                    </div>
                </div>
            </div>

            {/* DRAWER (Keep your existing drawer code) */}
            <InvoiceDrawer
                invoiceId={selectedInvoiceId}
                isOpen={!!selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
            />
        </>
    );
}
