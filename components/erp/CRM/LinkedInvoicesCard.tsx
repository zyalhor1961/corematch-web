'use client';

import React from 'react';
import { FileText, ExternalLink, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_ttc: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
}

interface LinkedInvoicesCardProps {
  title?: string;
  invoices: Invoice[];
  type: 'client' | 'supplier';
  onViewInvoice?: (invoiceId: string) => void;
  onViewAll?: () => void;
  maxItems?: number;
}

const statusConfig = {
  draft: { label: 'Brouillon', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  sent: { label: 'Envoyée', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  paid: { label: 'Payée', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  partial: { label: 'Partielle', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  overdue: { label: 'En retard', color: 'text-rose-400', bg: 'bg-rose-500/20' },
  cancelled: { label: 'Annulée', color: 'text-slate-500', bg: 'bg-slate-500/20' },
};

export function LinkedInvoicesCard({
  title,
  invoices,
  type,
  onViewInvoice,
  onViewAll,
  maxItems = 5,
}: LinkedInvoicesCardProps) {
  const displayInvoices = invoices.slice(0, maxItems);
  const hasMore = invoices.length > maxItems;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={12} />;
      case 'overdue':
        return <AlertTriangle size={12} />;
      default:
        return <Clock size={12} />;
    }
  };

  return (
    <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Neural Accent Line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent",
        type === 'client' ? "via-cyan-400/50" : "via-emerald-400/50"
      )} />

      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className={type === 'client' ? 'text-cyan-400' : 'text-emerald-400'} />
          <h3 className="font-medium text-white">
            {title || (type === 'client' ? 'Factures clients' : 'Factures fournisseurs')}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400">
            {invoices.length}
          </span>
        </div>
        {onViewAll && hasMore && (
          <button
            onClick={onViewAll}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            Voir tout
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Invoice List */}
      {displayInvoices.length > 0 ? (
        <div className="divide-y divide-white/5">
          {displayInvoices.map((invoice) => {
            const status = statusConfig[invoice.status] || statusConfig.draft;
            return (
              <div
                key={invoice.id}
                onClick={() => onViewInvoice?.(invoice.id)}
                className={cn(
                  "p-4 flex items-center gap-4",
                  "hover:bg-white/5 transition-colors",
                  onViewInvoice && "cursor-pointer"
                )}
              >
                {/* Invoice Number */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">{invoice.invoice_number}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] flex items-center gap-1",
                      status.bg, status.color
                    )}>
                      {getStatusIcon(invoice.status)}
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{formatDate(invoice.invoice_date)}</span>
                    {invoice.due_date && (
                      <>
                        <span>-</span>
                        <span className={invoice.status === 'overdue' ? 'text-rose-400' : ''}>
                          Éch. {formatDate(invoice.due_date)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div className="font-mono font-semibold text-white">
                    {formatCurrency(invoice.total_ttc)}
                  </div>
                  {invoice.balance_due > 0 && invoice.balance_due !== invoice.total_ttc && (
                    <div className="text-xs text-amber-400 mt-0.5">
                      Reste: {formatCurrency(invoice.balance_due)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500">
          <FileText size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune facture</p>
        </div>
      )}

      {/* View All Footer */}
      {hasMore && onViewAll && (
        <div className="p-3 border-t border-white/5 bg-slate-900/30">
          <button
            onClick={onViewAll}
            className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors"
          >
            Voir les {invoices.length - maxItems} autres factures
          </button>
        </div>
      )}
    </div>
  );
}

export default LinkedInvoicesCard;
