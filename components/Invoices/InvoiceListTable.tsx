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
            <div className="w-full overflow-hidden rounded-xl border border-white/5 bg-[#0F172A]/60 backdrop-blur-md">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#020617]/50 text-xs uppercase text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-medium tracking-wider">Reference</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Client</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Date</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Amount</th>
                            <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    No invoices found. Click "New Invoice" to create one.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((invoice) => (
                                <tr
                                    key={invoice.id}
                                    onClick={() => setSelectedInvoiceId(invoice.id)}
                                    className="group cursor-pointer transition-colors hover:bg-white/[0.02]"
                                >
                                    <td className="px-6 py-4 font-mono text-slate-300 group-hover:text-teal-400 transition-colors">
                                        {invoice.invoice_number || invoice.id.slice(0, 8)}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">{invoice.client_name}</td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {new Date(invoice.date_issued).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-200">
                                        €{Number(invoice.total_amount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusStyle(
                                                invoice.status,
                                            )}`}
                                        >
                                            {invoice.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1 text-slate-400 hover:text-white">
                                                <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className="border-t border-white/5 bg-[#020617]/30 px-6 py-4 text-xs text-slate-500 flex justify-between items-center">
                    <span>Showing all {invoices.length} invoices</span>
                </div>
            </div>

            {/* Invoice Drawer */}
            <InvoiceDrawer
                invoiceId={selectedInvoiceId}
                isOpen={!!selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
            />
        </>
    );
}
