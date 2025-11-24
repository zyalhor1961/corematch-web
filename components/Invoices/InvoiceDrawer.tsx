'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, ArrowRight, Download } from 'lucide-react';
import { AgentTimeline } from '@/components/ui/AgentTimeline';
import { useInvoiceAgent } from '@/hooks/useInvoiceAgent';

interface InvoiceDrawerProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceDrawer({ invoiceId, isOpen, onClose }: InvoiceDrawerProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [isOpen]);

  if (!isOpen || !invoiceId) return null;

  // Mock Data for the "Accounting Entry" (In real version, fetch this from DB)
  // This simulates what the AI Accountant decided.
  const accountingEntry = [
    { account: '606000', label: 'Achats non stockés', debit: 6000.00, credit: 0 },
    { account: '445660', label: 'TVA Déductible', debit: 1200.00, credit: 0 },
    { account: '401000', label: 'Fournisseur (Acme)', debit: 0, credit: 7200.00 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative h-full w-full max-w-2xl bg-[#0F172A] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020617]/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Invoice Analysis</h2>
            <p className="text-sm text-slate-400 font-mono">{invoiceId}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* 1. The Document Preview (Placeholder) */}
          <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4 flex items-center justify-between group cursor-pointer hover:border-teal-500/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-lg">
                <FileText className="text-slate-300" size={24} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Invoice_Acme_Oct24.pdf</div>
                <div className="text-xs text-slate-500">PDF • 1.2 MB</div>
              </div>
            </div>
            <button className="p-2 text-teal-400 hover:bg-teal-500/10 rounded-lg">
                <Download size={18} />
            </button>
          </div>

          {/* 2. The AI Timeline (Reused!) */}
          <div>
             <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">AI Audit Trail</h3>
             <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                {/* We can reuse your AgentTimeline here by passing the steps */}
                {/* For now, putting a placeholder to show layout */}
                <div className="text-sm text-slate-400">
                    <span className="text-emerald-400 font-bold">✓</span> Processed by Accountant Agent <br/>
                    <span className="text-emerald-400 font-bold">✓</span> Policy Check Passed
                </div>
             </div>
          </div>

          {/* 3. The "Glass Box" Accounting Entry (The Magic) */}
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">Proposed Ledger Entry</h3>
            <div className="bg-white rounded-lg overflow-hidden shadow-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-mono text-xs">Account</th>
                    <th className="px-4 py-2 text-left">Label</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountingEntry.map((row, i) => (
                    <tr key={i} className="bg-white text-slate-700">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">{row.account}</td>
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.debit > 0 ? `€${row.debit.toFixed(2)}` : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.credit > 0 ? `€${row.credit.toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-800">
                    <tr>
                        <td colSpan={2} className="px-4 py-2 text-right">Total</td>
                        <td className="px-4 py-2 text-right">€7,200.00</td>
                        <td className="px-4 py-2 text-right">€7,200.00</td>
                    </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#020617] flex justify-between items-center">
            <button className="text-slate-400 hover:text-white text-sm">
                Ask DAF a question...
            </button>
            <div className="flex gap-3">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors text-sm">
                    Edit Entry
                </button>
                <button className="px-6 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-medium shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 text-sm">
                    <CheckCircle size={16} /> Validate
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}
