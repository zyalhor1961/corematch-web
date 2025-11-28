'use client';

import React from 'react';
import { Mail, Phone, MapPin, Globe, Receipt, TrendingDown, AlertCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupplierCardProps {
  supplier: {
    id: string;
    code?: string;
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    vat_number?: string;
    siret?: string;
    address?: {
      street?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    };
    bank_details?: {
      iban?: string;
      bic?: string;
    };
    total_purchased?: number;
    total_paid?: number;
    total_outstanding?: number;
    invoice_count?: number;
  };
  variant?: 'default' | 'compact';
  onClick?: () => void;
}

export function SupplierCard({ supplier, variant = 'default', onClick }: SupplierCardProps) {
  const initials = supplier.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const hasOutstanding = (supplier.total_outstanding || 0) > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4",
          "hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer",
          "group"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-0.5 shrink-0">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{initials}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white truncate">{supplier.name}</h4>
              {supplier.code && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  {supplier.code}
                </span>
              )}
            </div>
            {supplier.address?.city && (
              <p className="text-xs text-slate-400 truncate">{supplier.address.city}</p>
            )}
          </div>
          {hasOutstanding && (
            <div className="px-2 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-medium">
              {formatCurrency(supplier.total_outstanding || 0)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6",
        "shadow-2xl shadow-black/20",
        onClick && "hover:bg-white/[0.07] hover:border-white/20 transition-all cursor-pointer"
      )}
    >
      {/* Neural Accent Line - Emerald for suppliers */}
      <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar with glow */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-0.5">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white truncate">{supplier.name}</h3>
            {supplier.code && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                {supplier.code}
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {supplier.siret && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-slate-400">
                SIRET: {supplier.siret}
              </span>
            )}
            {supplier.vat_number && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-slate-400">
                TVA: {supplier.vat_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-3 mb-6">
        {supplier.email && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Mail size={14} className="text-emerald-400" />
            </div>
            <span className="text-sm">{supplier.email}</span>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Phone size={14} className="text-emerald-400" />
            </div>
            <span className="text-sm">{supplier.phone}</span>
          </div>
        )}
        {supplier.website && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Globe size={14} className="text-emerald-400" />
            </div>
            <a
              href={supplier.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:text-emerald-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {supplier.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        {supplier.address?.city && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <MapPin size={14} className="text-emerald-400" />
            </div>
            <span className="text-sm">
              {[supplier.address.postal_code, supplier.address.city].filter(Boolean).join(' ')}
            </span>
          </div>
        )}
      </div>

      {/* Bank Details (if available) */}
      {supplier.bank_details?.iban && (
        <div className="mb-6 p-3 rounded-xl bg-slate-800/50 border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <CreditCard size={14} />
            <span className="text-xs uppercase tracking-wider">Coordonnées bancaires</span>
          </div>
          <div className="font-mono text-sm text-slate-300">
            {supplier.bank_details.iban}
            {supplier.bank_details.bic && (
              <span className="ml-2 text-slate-500">({supplier.bank_details.bic})</span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Receipt size={12} />
            <span className="text-xs">Factures</span>
          </div>
          <span className="text-lg font-semibold text-white">{supplier.invoice_count || 0}</span>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <TrendingDown size={12} />
            <span className="text-xs">Acheté</span>
          </div>
          <span className="text-lg font-semibold text-emerald-400">
            {formatCurrency(supplier.total_purchased || 0)}
          </span>
        </div>

        <div className={cn(
          "rounded-xl p-3 border",
          hasOutstanding
            ? "bg-rose-500/10 border-rose-500/20"
            : "bg-slate-800/50 border-white/5"
        )}>
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <AlertCircle size={12} className={hasOutstanding ? "text-rose-400" : ""} />
            <span className="text-xs">A payer</span>
          </div>
          <span className={cn(
            "text-lg font-semibold",
            hasOutstanding ? "text-rose-400" : "text-white"
          )}>
            {formatCurrency(supplier.total_outstanding || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SupplierCard;
