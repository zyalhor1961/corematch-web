'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/ui/PageContainer';
import { AgentAnalysisCard } from '@/components/Invoice/AgentAnalysisCard';
import { ArrowLeft, Printer, Download, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type Invoice = {
    id: string;
    invoice_number: string;
    client_name: string;
    invoice_date: string;
    due_date: string;
    total_ttc: number;
    status: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const invoiceId = typeof params.invoiceId === 'string' ? params.invoiceId : '';

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoice = async () => {
            if (!invoiceId) return;

            const { data, error } = await supabase
                .from('erp_invoices')
                .select(`
                    *,
                    client:erp_clients(name, company_name, email),
                    items:erp_invoice_lines(description, quantity, unit_price)
                `)
                .eq('id', invoiceId)
                .single();

            if (error) {
                console.error('Error fetching invoice:', error);
            } else if (data) {
                setInvoice({
                    id: data.id,
                    invoice_number: data.invoice_number,
                    client_name: data.client?.company_name || data.client?.name || 'Unknown',
                    invoice_date: data.invoice_date,
                    due_date: data.due_date,
                    total_ttc: data.total_ttc,
                    status: data.status,
                    items: data.items || []
                });
            }
            setLoading(false);
        };

        fetchInvoice();
    }, [invoiceId]);

    // Header Actions
    const actions = (
        <div className="flex gap-2">
            <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                <Printer size={18} />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                <Download size={18} />
            </button>
            <button className="bg-[#00B4D8]/10 text-[#00B4D8] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#00B4D8]/20 transition-colors flex items-center gap-2">
                <Share2 size={16} /> Share
            </button>
        </div>
    );

    return (
        <PageContainer title={`Invoice ${invoice?.invoice_number || invoiceId}`} actions={actions}>

            {/* Back Navigation */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Back to Invoices
            </button>

            {loading ? (
                <div className="flex items-center justify-center min-h-[600px]">
                    <div className="text-slate-400 animate-pulse">Loading invoice...</div>
                </div>
            ) : !invoice ? (
                <div className="flex items-center justify-center min-h-[600px]">
                    <div className="text-slate-400">Invoice not found</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: The Invoice Content (2/3 width) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* The "Paper" Representation */}
                        <div className="bg-white rounded-lg p-8 text-slate-900 shadow-xl min-h-[600px]">
                            <div className="flex justify-between items-start mb-12">
                                <div>
                                    <h1 className="text-4xl font-bold text-slate-800 tracking-tight">INVOICE</h1>
                                    <p className="text-slate-500 mt-1">#{invoice.invoice_number}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="font-bold text-slate-800">CoreMatch Inc.</h3>
                                    <p className="text-sm text-slate-500">123 Tech Blvd</p>
                                    <p className="text-sm text-slate-500">Paris, France</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 mb-12">
                                <div>
                                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Bill To</p>
                                    <p className="font-semibold">{invoice.client_name}</p>
                                    <p className="text-sm text-slate-500">hq@acme.com</p>
                                </div>
                                <div className="text-right">
                                    <div className="mb-2">
                                        <span className="text-xs uppercase font-bold text-slate-400 mr-4">Date</span>
                                        <span className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs uppercase font-bold text-slate-400 mr-4">Due</span>
                                        <span className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <table className="w-full mb-12">
                                <thead>
                                    <tr className="border-b-2 border-slate-100">
                                        <th className="text-left py-3 text-xs uppercase text-slate-400">Description</th>
                                        <th className="text-right py-3 text-xs uppercase text-slate-400">Qty</th>
                                        <th className="text-right py-3 text-xs uppercase text-slate-400">Price</th>
                                        <th className="text-right py-3 text-xs uppercase text-slate-400">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items.map((item, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="py-4 text-sm font-medium">{item.description}</td>
                                            <td className="py-4 text-right text-sm text-slate-500">{item.quantity}</td>
                                            <td className="py-4 text-right text-sm text-slate-500">€{item.unit_price.toFixed(2)}</td>
                                            <td className="py-4 text-right text-sm font-semibold">€{(item.quantity * item.unit_price).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="flex justify-end">
                                <div className="w-1/2">
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-slate-500">Subtotal</span>
                                        <span className="font-medium">€{(invoice.total_ttc / 1.2).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-slate-100">
                                        <span className="text-slate-500">Tax (20%)</span>
                                        <span className="font-medium">€{(invoice.total_ttc - invoice.total_ttc / 1.2).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-4">
                                        <span className="text-lg font-bold text-slate-800">Total</span>
                                        <span className="text-lg font-bold text-[#00B4D8]">€{invoice.total_ttc.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: The AI / OS Layer (1/3 width) */}
                    <div className="space-y-6">

                        {/* 1. The AI Agent Card */}
                        <div className="sticky top-6">
                            <h3 className="text-xs uppercase font-bold text-slate-500 mb-3 tracking-wider">AI Audit</h3>

                            <AgentAnalysisCard
                                invoiceId={invoiceId}
                                amount={invoice.total_ttc}
                            />

                            {/* 2. Metadata / Context */}
                            <div className="mt-6 bg-[#0F172A]/40 border border-white/5 rounded-xl p-5">
                                <h4 className="text-white font-medium mb-4">Properties</h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Payment Terms</span>
                                        <span className="text-slate-200">Net 30</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">GL Account</span>
                                        <span className="text-slate-200 font-mono">706000 (Services)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Created By</span>
                                        <span className="text-slate-200">John Doe</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            )}
        </PageContainer>
    );
}
