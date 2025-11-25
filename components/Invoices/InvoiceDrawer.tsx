'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, FileText, Download, ExternalLink, MessageSquare, Edit3, Play, Loader2 } from 'lucide-react';
import { AgentTimeline } from '@/components/ui/AgentTimeline';
import { useInvoiceAgent } from '@/hooks/useInvoiceAgent';
import { supabase } from '@/lib/supabase/client';

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

  // 1. GET THE ANALYZE FUNCTION
  // Ensure we get 'analyzeInvoice' from the hook
  const { steps, status, analyzeInvoice } = useInvoiceAgent(invoiceId || '');
  const [extractionData, setExtractionData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
  }, [isOpen]);

  // Fetch extraction data when invoiceId changes
  useEffect(() => {
    const fetchDetails = async () => {
      if (!invoiceId) return;
      const { data } = await supabase.from('invoices').select('extraction_data').eq('id', invoiceId).single();
      if (data) setExtractionData(data.extraction_data);
    };
    fetchDetails();
  }, [invoiceId, status]); // Re-fetch when status changes (e.g. after analysis)

  if (!isOpen || !invoiceId) return null;

  // --- BUTTON LOGIC ---

  // A. START ANALYSIS
  const handleStartAnalysis = () => {
    // Trigger the Python Brain manually
    // You can pass the amount here if you have it, or fetch it.
    // For demo, we pass a dummy amount or the existing one.
    analyzeInvoice(6000.50);
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
    // In a real app, this would open the right sidebar context
    alert("🤖 Ask DAF: 'Pourquoi cette facture est-elle bloquée ?'\n(Opening Chat Module...)");
  };

  // D. EDIT
  const handleEdit = () => {
    alert("✏️ Mode édition activé.\n(Vous pouvez maintenant modifier les montants)");
  };

  // Mock Accounting Entry
  const accountingEntry = [
    { account: '606000', label: 'Achats non stockés', debit: 6000.00, credit: 0 },
    { account: '445660', label: 'TVA Déductible', debit: 1200.00, credit: 0 },
    { account: '401000', label: 'Fournisseur (Acme)', debit: 0, credit: 7200.00 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative h-full w-full max-w-2xl bg-[#0F172A] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020617]/50">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Analyse Facture</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${status === 'completed' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                {status === 'processing' || status === 'pending' ? 'IA en cours...' : status === 'idle' ? 'En attente' : 'Audit IA Terminé'}
              </span>
              <p className="text-xs text-slate-500 font-mono">ID: {invoiceId.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Document Preview */}
          <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4 flex items-center justify-between group hover:border-teal-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#1E293B] rounded-lg border border-white/5"><FileText className="text-slate-300" size={24} /></div>
              <div>
                <div className="text-sm font-medium text-white">Facture_Originale.pdf</div>
                <div className="text-xs text-slate-500">PDF • 1.2 MB</div>
              </div>
            </div>
            <button className="p-2 text-slate-400 hover:text-teal-400 transition-colors"><Download size={18} /></button>
          </div>

          {/* AI AUDIT SECTION (With Logic!) */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Piste d&apos;Audit (IA)</h3>

              {/* SHOW ANALYZE BUTTON IF IDLE */}
              {(status === 'idle' || steps.length === 0) && (
                <button
                  onClick={handleStartAnalysis}
                  className="flex items-center gap-2 text-xs bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                >
                  <Play size={12} fill="currentColor" /> Lancer l&apos;Audit
                </button>
              )}
            </div>

            <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5 min-h-[120px]">
              {/* If no steps and not loading, show empty state */}
              {steps.length === 0 && status !== 'processing' ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Cliquez sur &quot;Lancer l&apos;Audit&quot; pour démarrer l&apos;IA.
                </div>
              ) : (
                <AgentTimeline steps={steps} jobId={invoiceId} />
              )}
            </div>
          </div>

          {/* SECTION DONNÉES EXTRAITES */}
          {extractionData && (
            <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5 mb-6">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">Extraction Intelligente</h3>
              <div className="space-y-1">
                <SmartField label="Fournisseur" data={extractionData.vendor_name} />
                <SmartField label="Date" data={extractionData.invoice_date} />
                <SmartField label="N° Facture" data={extractionData.invoice_id} />
                <SmartField label="Montant Total" data={extractionData.total_amount} />
              </div>
            </div>
          )}

          {/* Accounting Entries */}
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-4">Écritures Comptables (Brouillard)</h3>
            <div className="bg-white rounded-lg overflow-hidden shadow-lg text-slate-900">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] uppercase">Compte</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase">Libellé</th>
                    <th className="px-4 py-3 text-right text-[10px] uppercase">Débit</th>
                    <th className="px-4 py-3 text-right text-[10px] uppercase">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountingEntry.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600">{row.account}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{row.debit > 0 ? row.debit.toFixed(2) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">{row.credit > 0 ? row.credit.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-white/5 bg-[#020617] flex justify-between items-center">
          <button onClick={handleAskDAF} className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-2">
            <MessageSquare size={16} />
            <span>Demander au DAF</span>
          </button>
          <div className="flex gap-3">
            <button onClick={handleEdit} className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors text-sm font-medium flex items-center gap-2">
              <Edit3 size={16} /> Modifier
            </button>
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-6 py-2 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-white font-medium shadow-[0_0_20px_rgba(0,180,216,0.2)] transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {isValidating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              {isValidating ? 'Validation...' : 'Valider'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
