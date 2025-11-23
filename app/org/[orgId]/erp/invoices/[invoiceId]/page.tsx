'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/ui/PageContainer';
import { AgentAnalysisCard } from '@/components/Invoice/AgentAnalysisCard';
import { ArrowLeft, Printer, Download, Share2 } from 'lucide-react';

// Mock Data (Replace with Supabase fetch later)
const MOCK_INVOICE = {
    id: 'INV-001',
    client: 'Acme Corp',
    date: '2023-10-24',
    dueDate: '2023-11-24',
    amount: 6000.50,
    status: 'Pending',
    items: [
        { desc: 'Q4 Strategic Consulting', qty: 1, price: 5000.00 },
        { desc: 'Server Infrastructure Setup', qty: 1, price: 1000.50 },
    ]
};

export default function InvoiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const invoiceId = typeof params.invoiceId === 'string' ? params.invoiceId : MOCK_INVOICE.id;

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
        <PageContainer title={`Invoice ${invoiceId}`} actions={actions}>

            {/* Back Navigation */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Back to Invoices
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN: The Invoice Content (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* The "Paper" Representation */}
                    <div className="bg-white rounded-lg p-8 text-slate-900 shadow-xl min-h-[600px]">
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                <h1 className="text-4xl font-bold text-slate-800 tracking-tight">INVOICE</h1>
                                <p className="text-slate-500 mt-1">#{invoiceId}</p>
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
                                <p className="font-semibold">{MOCK_INVOICE.client}</p>
                                <p className="text-sm text-slate-500">hq@acme.com</p>
                            </div>
                            <div className="text-right">
                                <div className="mb-2">
                                    <span className="text-xs uppercase font-bold text-slate-400 mr-4">Date</span>
                                    <span className="font-medium">{MOCK_INVOICE.date}</span>
                                </div>
                                <div>
                                    <span className="text-xs uppercase font-bold text-slate-400 mr-4">Due</span>
                                    <span className="font-medium">{MOCK_INVOICE.dueDate}</span>
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
                                {MOCK_INVOICE.items.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        <td className="py-4 text-sm font-medium">{item.desc}</td>
                                        <td className="py-4 text-right text-sm text-slate-500">{item.qty}</td>
                                        <td className="py-4 text-right text-sm text-slate-500">€{item.price.toFixed(2)}</td>
                                        <td className="py-4 text-right text-sm font-semibold">€{(item.qty * item.price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end">
                            <div className="w-1/2">
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-medium">€{MOCK_INVOICE.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-100">
                                    <span className="text-slate-500">Tax (20%)</span>
                                    <span className="font-medium">€{(MOCK_INVOICE.amount * 0.2).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-4">
                                    <span className="text-lg font-bold text-slate-800">Total</span>
                                    <span className="text-lg font-bold text-[#00B4D8]">€{(MOCK_INVOICE.amount * 1.2).toFixed(2)}</span>
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
                            amount={MOCK_INVOICE.amount}
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
        </PageContainer>
    );
}
