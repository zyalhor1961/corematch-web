'use client';

import React from 'react';
import { Mail, Phone, MapPin, Building2, Receipt, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    vat_number?: string;
    siret?: string;
    billing_address?: {
      street?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    };
    total_invoiced?: number;
    total_paid?: number;
    total_outstanding?: number;
    invoice_count?: number;
  };
  variant?: 'default' | 'compact';
  onClick?: () => void;
}

export function ClientCard({ client, variant = 'default', onClick }: ClientCardProps) {
  const initials = client.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const hasOutstanding = (client.total_outstanding || 0) > 0;

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
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 p-0.5 shrink-0">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{initials}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white truncate">{client.name}</h4>
            {client.company_name && (
              <p className="text-xs text-slate-400 truncate">{client.company_name}</p>
            )}
          </div>
          {hasOutstanding && (
            <div className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
              {formatCurrency(client.total_outstanding || 0)}
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
      {/* Neural Accent Line */}
      <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar with glow */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 p-0.5">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-white truncate">{client.name}</h3>
          {client.company_name && (
            <p className="text-slate-400 flex items-center gap-1.5 mt-1">
              <Building2 size={14} />
              {client.company_name}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            {client.siret && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-slate-400">
                SIRET: {client.siret}
              </span>
            )}
            {client.vat_number && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-slate-400">
                TVA: {client.vat_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-3 mb-6">
        {client.email && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Mail size={14} className="text-cyan-400" />
            </div>
            <span className="text-sm">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Phone size={14} className="text-cyan-400" />
            </div>
            <span className="text-sm">{client.phone}</span>
          </div>
        )}
        {client.billing_address?.city && (
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <MapPin size={14} className="text-cyan-400" />
            </div>
            <span className="text-sm">
              {[client.billing_address.postal_code, client.billing_address.city].filter(Boolean).join(' ')}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Receipt size={12} />
            <span className="text-xs">Factures</span>
          </div>
          <span className="text-lg font-semibold text-white">{client.invoice_count || 0}</span>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <TrendingUp size={12} />
            <span className="text-xs">Facturé</span>
          </div>
          <span className="text-lg font-semibold text-emerald-400">
            {formatCurrency(client.total_invoiced || 0)}
          </span>
        </div>

        <div className={cn(
          "rounded-xl p-3 border",
          hasOutstanding
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-slate-800/50 border-white/5"
        )}>
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <AlertCircle size={12} className={hasOutstanding ? "text-amber-400" : ""} />
            <span className="text-xs">Impayé</span>
          </div>
          <span className={cn(
            "text-lg font-semibold",
            hasOutstanding ? "text-amber-400" : "text-white"
          )}>
            {formatCurrency(client.total_outstanding || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ClientCard;
