'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, FileText, Download, ExternalLink, MessageSquare, Edit3 } from 'lucide-react';
import { AgentTimeline } from '@/components/ui/AgentTimeline';
import { useInvoiceAgent } from '@/hooks/useInvoiceAgent';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface InvoiceDrawerProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceDrawer({ invoiceId, isOpen, onClose }: InvoiceDrawerProps) {
  const supabase = createClientComponentClient();
  const [isValidating, setIsValidating] = useState(false);

  // 1. HOOK: Get the Real AI Data for this specific invoice
  // (Ensure invoiceId is passed as string, fallback to empty string if null to prevent hook error)
  const { steps, status } = useInvoiceAgent(invoiceId || '');

  // Prevent scrolling body when drawer is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [isOpen]);

  if (!isOpen || !invoiceId) return null;

  // 2. ACTION: Validate Invoice
  const handleValidate = async () => {
    setIsValidating(true);
    // Update Supabase
    const { error } = await supabase
        .from('invoices') // or 'jobs' depending on where you store the master status
        .update({ status: 'APPROVED' }) // Update your DB status column
        .eq('id', invoiceId);

    if (!error) {
        // Also update the Job status to reflect human override
        await supabase.from('jobs').update({ result: 'APPROVED' }).eq('invoice_id', invoiceId);
        onClose(); // Close drawer on success
        // Optional: Add a toast notification here
    }
    setIsValidating(false);
  };

  // Mock Entry (We will fetch this from Python later)
  const accountingEntry = [
    { account: '606000', label: 'Achats non stockés', debit: 6000.00, credit: 0 },
    { account: '445660', label: 'TVA Déductible', debit: 1200.00, credit: 0 },
    { account: '401000', label: 'Fournisseur (Acme)', debit: 0, credit: 7200.00 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative h-full w-full max-w-2xl bg-[#0F172A] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020617]/50">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Analyse Facture</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${
                    status === 'completed' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                    {status === 'processing' ? 'IA en cours...' : 'Audit IA Terminé'}
                </span>
                <p className="text-xs text-slate-500 font-mono">ID: {invoiceId.slice(0,8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* 1. Document Card */}
          <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4 flex items-center justify-between group hover:border-teal-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#1E293B] rounded-lg border border-white/5">
                <FileText className="text-slate-300" size={24} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Facture_Originale.pdf</div>
                <div className="text-xs text-slate-500">PDF • 1.2 MB • Reçu via Email</div>
              </div>
            </div>
            <div className="flex gap-2">
                <button className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors" title="Voir">
                    <ExternalLink size={18} />
                </button>
                <button className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors" title="Télécharger">
                    <Download size={18} />
                </button>
            </div>
          </div>

          {/* 2. The REAL AI Timeline */}
          <div>
             <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">Piste d&apos;Audit (IA)</h3>
             <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5">
                {/* Injecting the Real Component Here */}
                <AgentTimeline steps={steps} jobId={invoiceId} />
             </div>
          </div>

          {/* 3. Accounting Entries (Paper Style) */}
          <div>
            <div className="flex justify-between items-end mb-4">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Écritures Comptables (Brouillard)</h3>
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle size={12} /> Équilibrée
                </span>
            </div>

            <div className="bg-white rounded-lg overflow-hidden shadow-lg text-slate-900">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider">Compte</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider">Libellé</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider">Débit</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wider">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountingEntry.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600">{row.account}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{row.debit > 0 ? `${row.debit.toFixed(2)}` : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{row.credit > 0 ? `${row.credit.toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                    <tr>
                        <td colSpan={2} className="px-4 py-3 text-right uppercase text-[10px] text-slate-500 tracking-wider">Total</td>
                        <td className="px-4 py-3 text-right font-mono">7 200.00</td>
                        <td className="px-4 py-3 text-right font-mono">7 200.00</td>
                    </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-6 border-t border-white/5 bg-[#020617] flex justify-between items-center">
            <button className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-2">
                <MessageSquare size={16} />
                <span>Demander au DAF</span>
            </button>
            <div className="flex gap-3">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors text-sm font-medium flex items-center gap-2">
                    <Edit3 size={16} /> Modifier
                </button>
                <button
                    onClick={handleValidate}
                    disabled={isValidating}
                    className="px-6 py-2 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-white font-medium shadow-[0_0_20px_rgba(0,180,216,0.2)] transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isValidating ? 'Validation...' : (
                        <>
                            <CheckCircle size={16} />
                            Valider
                        </>
                    )}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}
