'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PdfViewerWithHighlights } from '../Invoices/PdfViewerWithHighlights'; // Reusing existing viewer
import { CheckCircle, Edit3, AlertTriangle, Save, X, Wand2, Loader2 } from 'lucide-react';

interface AccountingValidatorProps {
    invoiceId: string;
    fileUrl: string;
    initialData: any; // The AI suggestion + extraction data
    onClose: () => void;
    onSuccess: () => void;
}

export default function AccountingValidator({ invoiceId, fileUrl, initialData, onClose, onSuccess }: AccountingValidatorProps) {
    const [loading, setLoading] = useState(false);

    // Form State
    const [entry, setEntry] = useState({
        charge_account: '',
        vat_account: '',
        label: '',
        amount_ht: 0,
        amount_tax: 0,
        amount_ttc: 0,
    });

    // Initialize from AI Suggestion
    useEffect(() => {
        if (initialData?.suggested_entry) {
            setEntry({
                charge_account: initialData.suggested_entry.charge_account || '',
                vat_account: initialData.suggested_entry.vat_account || '445660',
                label: initialData.suggested_entry.label || '',
                amount_ht: initialData.suggested_entry.amount_ht || 0,
                amount_tax: initialData.suggested_entry.amount_tax || 0,
                amount_ttc: initialData.suggested_entry.amount_ttc || 0,
            });
        } else if (initialData?.total_amount) {
            // Fallback if no AI suggestion but we have total
            setEntry(prev => ({ ...prev, amount_ttc: initialData.total_amount }));
        }
    }, [initialData]);

    const handleManualMode = () => {
        setEntry({
            charge_account: '',
            vat_account: '',
            label: '',
            amount_ht: 0,
            amount_tax: 0,
            amount_ttc: entry.amount_ttc, // Keep total
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // 0. Get Journal ID for 'AC' (Achats)
            const { data: journal, error: journalError } = await supabase
                .from('erp_journals')
                .select('id')
                .eq('journal_code', 'AC')
                .single();

            if (journalError) throw new Error("Journal 'AC' introuvable. Veuillez initialiser la comptabilité.");

            // 1. Create Journal Entry Header
            const { data: header, error: headerError } = await supabase
                .from('erp_journal_entries')
                .insert({
                    org_id: 'demo-org-id', // TODO: Get from context
                    journal_id: journal.id,
                    source_type: 'supplier_invoice',
                    source_id: invoiceId,
                    entry_date: new Date().toISOString(),
                    description: entry.label,
                    status: 'posted',
                    total_debit: entry.amount_ttc,
                    total_credit: entry.amount_ttc
                })
                .select()
                .single();

            if (headerError) throw headerError;

            // 2. Create Journal Lines
            const lines = [
                // Debit Charge
                {
                    entry_id: header.id,
                    account_code: entry.charge_account,
                    description: entry.label,
                    debit: entry.amount_ht,
                    credit: 0
                },
                // Debit VAT
                {
                    entry_id: header.id,
                    account_code: entry.vat_account,
                    description: "TVA Déductible",
                    debit: entry.amount_tax,
                    credit: 0
                },
                // Credit Vendor (401)
                {
                    entry_id: header.id,
                    account_code: '401000', // TODO: Dynamic vendor account
                    description: entry.label,
                    debit: 0,
                    credit: entry.amount_ttc
                }
            ];

            const { error: linesError } = await supabase
                .from('erp_journal_lines')
                .insert(lines);

            if (linesError) throw linesError;

            // 3. Update Invoice Status
            const { error: invError } = await supabase
                .from('invoices')
                .update({ status: 'VALIDATED' })
                .eq('id', invoiceId);

            if (invError) throw invError;

            onSuccess();

        } catch (error: any) {
            alert("Erreur lors de la sauvegarde: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-[#0B1121] flex text-white font-sans">

            {/* LEFT: PDF Viewer */}
            <div className="w-1/2 border-r border-white/10 flex flex-col bg-slate-900/50">
                <div className="h-14 border-b border-white/10 flex items-center px-6 justify-between bg-[#0B1121]">
                    <span className="font-medium text-slate-400">Document Original</span>
                </div>
                <div className="flex-1 relative overflow-hidden">
                    <PdfViewerWithHighlights
                        url={fileUrl}
                        highlights={[]} // We could pass highlights if we had them here
                        metadata={initialData?._metadata}
                    />
                </div>
            </div>

            {/* RIGHT: Accounting Form */}
            <div className="w-1/2 flex flex-col bg-[#0B1121]">

                {/* Header */}
                <div className="h-14 border-b border-white/10 flex items-center px-8 justify-between bg-[#0B1121]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Validation Comptable</h2>
                            <p className="text-xs text-slate-500">Vérifiez la suggestion de l'IA avant validation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 p-8 overflow-y-auto">

                    {/* AI Badge */}
                    {initialData?.suggested_entry && (
                        <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-3 text-sm text-indigo-300">
                            <Wand2 size={16} />
                            <span>Pré-rempli par l'Intelligence Artificielle (GPT-4o)</span>
                        </div>
                    )}

                    <div className="space-y-6 max-w-xl mx-auto">

                        {/* General Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase">Compte de Charge</label>
                                <input
                                    type="text"
                                    value={entry.charge_account}
                                    onChange={(e) => setEntry({ ...entry, charge_account: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg"
                                    placeholder="6xxxxx"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase">Compte TVA</label>
                                <input
                                    type="text"
                                    value={entry.vat_account}
                                    onChange={(e) => setEntry({ ...entry, vat_account: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase">Libellé de l'écriture</label>
                            <input
                                type="text"
                                value={entry.label}
                                onChange={(e) => setEntry({ ...entry, label: e.target.value })}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="h-px bg-white/10 my-6" />

                        {/* Amounts */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase">Montant HT</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={entry.amount_ht}
                                        onChange={(e) => setEntry({ ...entry, amount_ht: parseFloat(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-right"
                                    />
                                    <span className="absolute right-10 top-3 text-slate-500">€</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase">Montant TVA</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={entry.amount_tax}
                                        onChange={(e) => setEntry({ ...entry, amount_tax: parseFloat(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-right"
                                    />
                                    <span className="absolute right-10 top-3 text-slate-500">€</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400 uppercase">Total TTC</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={entry.amount_ttc}
                                        readOnly
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-slate-300 outline-none font-mono text-right cursor-not-allowed"
                                    />
                                    <span className="absolute right-10 top-3 text-slate-500">€</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={handleManualMode}
                        className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Edit3 size={14} />
                        Passer en saisie manuelle
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all text-sm font-medium flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                            Valider & Écrire
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
