'use client';

import React from 'react';
import {
  Building2, User, Mail, Phone, Sparkles, GripVertical,
  TrendingUp, Calendar, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Lead {
  id: string;
  org_id: string;
  company_name: string;
  website?: string;
  logo_url?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  status: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  potential_value: number;
  probability: number;
  currency: string;
  ai_summary?: string;
  ai_next_action?: string;
  last_activity_at: string;
  created_at: string;
}

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const probabilityColors = {
  low: { bg: 'bg-rose-500', text: 'text-rose-400' },      // 0-30%
  medium: { bg: 'bg-amber-500', text: 'text-amber-400' }, // 31-60%
  high: { bg: 'bg-emerald-500', text: 'text-emerald-400' }, // 61-100%
};

export function LeadCard({
  lead,
  onClick,
  isDragging,
  dragHandleProps,
}: LeadCardProps) {
  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const getProbabilityColor = (prob: number) => {
    if (prob <= 30) return probabilityColors.low;
    if (prob <= 60) return probabilityColors.medium;
    return probabilityColors.high;
  };

  const probColor = getProbabilityColor(lead.probability);
  const isWon = lead.status === 'won';

  return (
    <div
      className={cn(
        "group relative backdrop-blur-xl rounded-xl border transition-all cursor-pointer",
        isDragging
          ? "bg-slate-800/90 border-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-105 rotate-2"
          : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10",
        isWon && "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
      )}
      onClick={onClick}
    >
      {/* Won celebration effect */}
      {isWon && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10 animate-pulse" />
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Header: Drag handle + Company */}
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="mt-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 cursor-grab active:cursor-grabbing transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-slate-500" />
          </div>

          {/* Company Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {lead.logo_url ? (
                <img
                  src={lead.logo_url}
                  alt={lead.company_name}
                  className="w-8 h-8 rounded-lg object-cover bg-white/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                  <Building2 size={16} className="text-cyan-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white truncate">{lead.company_name}</h4>
                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500 hover:text-cyan-400 flex items-center gap-1 truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Value Badge */}
          <div className="shrink-0">
            <div className={cn(
              "px-2 py-1 rounded-lg text-xs font-bold font-mono",
              isWon
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/10 text-white"
            )}>
              {formatCurrency(lead.potential_value, lead.currency)}
            </div>
          </div>
        </div>

        {/* Contact */}
        {lead.contact_name && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User size={12} />
            <span className="truncate">{lead.contact_name}</span>
            {lead.contact_email && (
              <Mail size={12} className="text-slate-500 shrink-0" />
            )}
          </div>
        )}

        {/* AI Summary */}
        {lead.ai_summary && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <Sparkles size={12} className="text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 line-clamp-2">{lead.ai_summary}</p>
          </div>
        )}

        {/* Probability Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Probabilité</span>
            <span className={cn("font-medium", probColor.text)}>{lead.probability}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", probColor.bg)}
              style={{ width: `${lead.probability}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Calendar size={10} />
            {formatDate(lead.last_activity_at)}
          </div>
          {lead.ai_next_action && (
            <div className="flex items-center gap-1 text-cyan-400 truncate max-w-[60%]">
              <TrendingUp size={10} className="shrink-0" />
              <span className="truncate">{lead.ai_next_action}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeadCard;
