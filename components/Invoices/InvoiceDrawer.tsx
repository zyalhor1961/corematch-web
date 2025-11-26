'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, CheckCircle, FileText, Download, ExternalLink, MessageSquare, Edit3, Play, Loader2, Maximize2, Trash2 } from 'lucide-react';
import { AgentTimeline } from '@/components/ui/AgentTimeline';
import { useInvoiceAgent } from '@/hooks/useInvoiceAgent';
import { supabase } from '@/lib/supabase/client';
import { createPortal } from 'react-dom';
import { PdfViewerWithHighlights } from './PdfViewerWithHighlights';
import AccountingValidator from '../Invoice/AccountingValidator';

interface InvoiceDrawerProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// --- Composant pour les champs intelligents ---
const SmartField = ({ label, data }: { label: string, data: any }) => {
  if (!data) return null;

  // Formatage de la valeur
  let displayValue = data.value;
  if (typeof data.value === 'object' && data.value?.amount) displayValue = `${data.value.amount} €`;

  // Couleur de confiance
  const confidenceColor = data.confidence > 0.8 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="group relative flex justify-between items-center py-2 border-b border-white/5">
      <span className="text-slate-400 text-xs uppercase tracking-wider">{label}</span>
      <span className="font-mono text-white font-medium cursor-help border-b border-dotted border-slate-600">
        {displayValue}
      </span>

      {/* LE POP-UP (TOOLTIP) */}
      <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-white/10 rounded-lg p-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Preuve IA</div>
        <div className="text-xs text-white bg-white/5 p-1 rounded mb-2 font-mono">
          "{data.content}"
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Confiance :</span>
          <span className={`font-bold ${confidenceColor}`}>{(data.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function InvoiceDrawer({ invoiceId, isOpen, onClose }: InvoiceDrawerProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isAccountingOpen, setIsAccountingOpen] = useState(false);

  // 1. GET THE ANALYZE FUNCTION
  // Ensure we get 'analyzeInvoice' from the hook
  const { steps, status, analyzeInvoice } = useInvoiceAgent(invoiceId || '');
  const [extractionData, setExtractionData] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);

  // Use Portal to escape stacking contexts
  const [mounted, setMounted] = useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If Accounting Modal is open, ignore clicks (let the modal handle them)
      if (isAccountingOpen) return;

      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose, isAccountingOpen]);

  // Fetch extraction data when invoiceId changes
  useEffect(() => {
    const fetchDetails = async () => {
      if (!invoiceId) return;
      const { data } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (data) {
        setInvoice(data);
        setExtractionData(data.extraction_data);
      }
    };
    fetchDetails();
  }, [invoiceId, status]); // Re-fetch when status changes (e.g. after analysis)

  // Construct highlights from extraction data
  const highlights = useMemo(() => {
    if (!extractionData) return [];

    const list: any[] = [];

    // Helper to add highlight
    const addHighlight = (fieldKey: string, label: string, color: string) => {
      const field = extractionData[fieldKey];
      if (field && field.box && field.box.length > 0) {
        list.push({
          box: field.box,
          page: field.page || 1,
          label: label,
          color: color
        });
      }
    };

    addHighlight('vendor_name', 'Vendor', '#facc15'); // Yellow (keep for contrast)
    addHighlight('invoice_date', 'Date', '#00b4d8');   // Teal
    addHighlight('total_amount', 'Total', '#4ade80'); // Green (keep for money)

    console.log("DEBUG: Extraction Data:", extractionData);
    console.log("DEBUG: Generated Highlights:", list);

    return list;
  }, [extractionData]);

  if (!isOpen || !invoiceId || !mounted || !invoice) return null;

  // A. START ANALYSIS
  const handleStartAnalysis = () => {
    // Trigger the Python Brain manually
    analyzeInvoice(invoice.total_amount || 0);
  };

  // B. VALIDATE
  const handleValidate = async () => {
    setIsValidating(true);
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'APPROVED' })
      .eq('id', invoiceId);

    if (error) {
      alert("Erreur lors de la validation: " + error.message);
    } else {
      // Also update the Job logic
      await supabase.from('jobs').update({ result: 'APPROVED' }).eq('invoice_id', invoiceId);

      // FORCE REFRESH THE PAGE TO SHOW CHANGES
      window.location.reload();
    }
    setIsValidating(false);
  };

  // C. ASK DAF (Placeholder for opening the chat)
  const handleAskDAF = () => {
    alert("🤖 Ask DAF: 'Pourquoi cette facture est-elle bloquée ?'\n(Opening Chat Module...)");
  };

  // D. EDIT
  const handleEdit = () => {
    alert("✏️ Mode édition activé.\n(Vous pouvez maintenant modifier les montants)");
  };

  // Mock Accounting Entry
  // Assumption: invoice.total_amount is TTC (Total Including Tax)
  // We assume a standard 20% VAT rate for this demo
  const totalTTC = invoice.total_amount || 0;
  const vatRate = 0.20;
  const totalHT = totalTTC / (1 + vatRate);
  const totalVAT = totalTTC - totalHT;

  const accountingEntry = [
    { account: '606000', label: 'Achats non stockés', debit: totalHT, credit: 0 },
    { account: '445660', label: 'TVA Déductible', debit: totalVAT, credit: 0 },
    { account: '401000', label: 'Fournisseur', debit: 0, credit: totalTTC },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end font-sans pointer-events-none">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-500 pointer-events-auto ${mounted ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`relative w-full max-w-5xl bg-[#0B1121] h-full shadow-2xl border-l border-white/10 flex flex-col transition-transform duration-500 ease-out pointer-events-auto ${mounted ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0B1121] z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-light text-white">
              Invoice <span className="font-mono text-slate-400">#{invoice.id.slice(0, 8)}</span>
            </h2>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${invoice.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              invoice.status === 'NEEDS_APPROVAL' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-slate-800 text-slate-400 border-white/5'
              }`}>
              {invoice.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: PDF Viewer */}
          <div className="flex-1 bg-slate-900/50 relative border-r border-white/5 flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-[#0B1121]/50">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Original Document</span>
              <div className="flex gap-2">
                <button className="p-1 hover:bg-white/5 rounded text-slate-400">
                  <Download size={14} />
                </button>
                <button className="p-1 hover:bg-white/5 rounded text-slate-400">
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative bg-slate-900">
              {invoice.file_url ? (
                <PdfViewerWithHighlights
                  url={invoice.file_url}
                  highlights={highlights}
                  metadata={extractionData?._metadata}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No document available
                </div>
              )}
            </div>
          </div>

          {/* Right: Analysis & Chat */}
          <div className="w-[400px] flex flex-col bg-[#0B1121] border-l border-white/5">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* AI Audit Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">AI Audit Trail</h3>
                  {(status === 'idle' || steps.length === 0) && (
                    <button
                      onClick={handleStartAnalysis}
                      className="flex items-center gap-2 text-xs bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                    >
                      <Play size={10} fill="currentColor" /> Start Audit
                    </button>
                  )}
                </div>
                <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5 min-h-[100px]">
                  {steps.length === 0 && status !== 'processing' ? (
                    <div className="text-center py-6 text-slate-600 text-xs italic">
                      Click "Start Audit" to analyze document.
                    </div>
                  ) : (
                    <AgentTimeline steps={steps} jobId={invoiceId} />
                  )}
                </div>
              </div>

              {/* Extraction Data */}
              {extractionData && (
                <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5">
                  <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Smart Extraction</h3>
                  <div className="space-y-1">
                    <SmartField label="Vendor" data={extractionData.vendor_name} />
                    <SmartField label="Date" data={extractionData.invoice_date} />
                    <SmartField label="Invoice #" data={extractionData.invoice_id} />
                    <SmartField label="Total" data={extractionData.total_amount} />
                  </div>
                </div>
              )}

              {/* Accounting Entries */}
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Accounting Entries</h3>
                <div className="bg-white rounded border border-slate-200 overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-2 py-2 text-left">Account</th>
                        <th className="px-2 py-2 text-left">Label</th>
                        <th className="px-2 py-2 text-right">Debit</th>
                        <th className="px-2 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {accountingEntry.map((row, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 font-mono font-bold">{row.account}</td>
                          <td className="px-2 py-1.5">{row.label}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{row.debit > 0 ? row.debit.toFixed(2) : '-'}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{row.credit > 0 ? row.credit.toFixed(2) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/5 bg-slate-900/30">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleAskDAF}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-white/5"
                >
                  <MessageSquare size={16} />
                  Ask DAF
                </button>

                {/* DELETE BUTTON */}
                <button
                  onClick={async () => {
                    if (confirm("Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.")) {
                      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
                      if (error) {
                        alert("Erreur lors de la suppression : " + error.message);
                      } else {
                        window.location.reload();
                      }
                    }
                  }}
                  disabled={invoice.status === 'APPROVED' || invoice.status === 'PAID'}
                  className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${invoice.status === 'APPROVED' || invoice.status === 'PAID'
                    ? 'bg-slate-800/50 text-slate-600 border-transparent cursor-not-allowed'
                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  title={invoice.status === 'APPROVED' ? "Impossible de supprimer une facture validée" : "Supprimer définitivement"}
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>

                <button
                  onClick={handleValidate}
                  disabled={isValidating || invoice.status === 'REJECTED'}
                  className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-lg disabled:opacity-50 ${invoice.status === 'REJECTED'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                    }`}
                  title={invoice.status === 'REJECTED' ? "Document rejeté par l'IA" : "Valider pour paiement"}
                >
                  {isValidating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                  {isValidating ? 'Validating...' : invoice.status === 'REJECTED' ? 'Rejeté' : 'Validate'}
                </button>
                <button
                  onClick={() => setIsAccountingOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                >
                  <FileText size={16} />
                  Comptabilité
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Validator Overlay */}
      {isAccountingOpen && invoice && (
        <AccountingValidator
          invoiceId={invoiceId!}
          fileUrl={invoice.file_url}
          initialData={{ ...extractionData, total_amount: invoice.total_amount }}
          onClose={() => setIsAccountingOpen(false)}
          onSuccess={() => {
            setIsAccountingOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>,
    document.body
  );
}
