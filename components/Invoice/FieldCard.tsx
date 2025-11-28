'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Target, AlertCircle } from 'lucide-react';

interface FieldCardProps {
  label: string;
  value: string | number | null | undefined;
  confidence?: number; // 0 to 1
  icon?: React.ReactNode;
  type?: 'text' | 'currency' | 'date' | 'mono';
  onEdit?: () => void;
  onFocus?: () => void;
  isEditable?: boolean;
  className?: string;
}

/**
 * FieldCard - Nebula Design System
 *
 * A premium card for displaying extracted invoice fields with:
 * - Glass morphism styling
 * - Confidence ring indicator
 * - Hover glow effect
 * - Edit capabilities
 */
export function FieldCard({
  label,
  value,
  confidence,
  icon,
  type = 'text',
  onEdit,
  onFocus,
  isEditable = false,
  className = '',
}: FieldCardProps) {
  // Format value based on type
  const formatValue = () => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-600 italic">Non détecté</span>;
    }

    switch (type) {
      case 'currency':
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(num)) return String(value);
        return (
          <span className="font-mono tabular-nums">
            {num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-slate-500 ml-1">€</span>
          </span>
        );
      case 'date':
        try {
          const date = new Date(String(value));
          return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
          return String(value);
        }
      case 'mono':
        return <span className="font-mono">{String(value)}</span>;
      default:
        return String(value);
    }
  };

  // Confidence styling
  const getConfidenceStyle = () => {
    if (confidence === undefined || confidence === null) {
      return { color: 'slate', ringColor: 'ring-slate-500/30', dotColor: 'bg-slate-500' };
    }
    if (confidence >= 0.9) {
      return { color: 'emerald', ringColor: 'ring-emerald-500/50', dotColor: 'bg-emerald-400', glow: 'shadow-emerald-500/20' };
    }
    if (confidence >= 0.7) {
      return { color: 'teal', ringColor: 'ring-teal-500/50', dotColor: 'bg-teal-400', glow: 'shadow-teal-500/20' };
    }
    if (confidence >= 0.5) {
      return { color: 'amber', ringColor: 'ring-amber-500/50', dotColor: 'bg-amber-400', glow: 'shadow-amber-500/20' };
    }
    return { color: 'rose', ringColor: 'ring-rose-500/50', dotColor: 'bg-rose-400', glow: 'shadow-rose-500/20' };
  };

  const confStyle = getConfidenceStyle();

  // Calculate ring progress (for SVG arc)
  const ringProgress = confidence !== undefined ? Math.min(confidence, 1) : 0;
  const circumference = 2 * Math.PI * 12; // radius = 12
  const strokeDashoffset = circumference * (1 - ringProgress);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={`
        group relative
        bg-[#1E293B]/60 backdrop-blur-md
        border border-white/5 rounded-xl p-4
        transition-all duration-200
        hover:border-teal-500/30 hover:bg-[#1E293B]/80
        hover:shadow-[0_0_20px_rgba(20,184,166,0.1)]
        ${className}
      `}
    >
      {/* Top Row: Label + Actions */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          {label}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onFocus && (
            <button
              onClick={(e) => { e.stopPropagation(); onFocus(); }}
              className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-teal-400 transition-colors"
              title="Localiser sur le document"
            >
              <Target size={12} />
            </button>
          )}
          {onEdit && isEditable && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors"
              title="Corriger ce champ"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Row: Icon + Value + Confidence Ring */}
      <div className="flex items-center justify-between gap-3">
        {/* Optional Icon */}
        {icon && (
          <div className="flex-shrink-0 text-slate-500">
            {icon}
          </div>
        )}

        {/* Value */}
        <div className="flex-1 text-white text-sm font-medium truncate">
          {formatValue()}
        </div>

        {/* Confidence Ring */}
        {confidence !== undefined && (
          <div className="relative flex-shrink-0" title={`Confiance: ${Math.round(confidence * 100)}%`}>
            {/* SVG Ring */}
            <svg width="32" height="32" className="transform -rotate-90">
              {/* Background Ring */}
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-700/50"
              />
              {/* Progress Ring */}
              <motion.circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className={`
                  ${confidence >= 0.9 ? 'text-emerald-400' : ''}
                  ${confidence >= 0.7 && confidence < 0.9 ? 'text-teal-400' : ''}
                  ${confidence >= 0.5 && confidence < 0.7 ? 'text-amber-400' : ''}
                  ${confidence < 0.5 ? 'text-rose-400' : ''}
                `}
                style={{
                  stroke: 'currentColor',
                  strokeDasharray: circumference,
                  strokeDashoffset: strokeDashoffset,
                }}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>

            {/* Center Percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[8px] font-bold ${
                confidence >= 0.9 ? 'text-emerald-400' :
                confidence >= 0.7 ? 'text-teal-400' :
                confidence >= 0.5 ? 'text-amber-400' :
                'text-rose-400'
              }`}>
                {Math.round(confidence * 100)}
              </span>
            </div>

            {/* Glow Effect for High Confidence */}
            {confidence >= 0.9 && (
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-md -z-10" />
            )}
          </div>
        )}

        {/* Low Confidence Warning */}
        {confidence !== undefined && confidence < 0.5 && (
          <AlertCircle size={14} className="text-rose-400 flex-shrink-0 animate-pulse" />
        )}
      </div>

      {/* Subtle bottom highlight on hover */}
      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

/**
 * FieldCardGroup - Groups multiple FieldCards with a title
 */
interface FieldCardGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldCardGroup({ title, children, className = '' }: FieldCardGroupProps) {
  return (
    <div className={className}>
      <h3 className="text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-3 px-1">
        {title}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

export default FieldCard;
