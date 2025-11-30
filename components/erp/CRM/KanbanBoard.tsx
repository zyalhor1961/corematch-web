'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Plus, Sparkles, Target, FileText, Handshake, Trophy, XCircle,
  MoreHorizontal, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadCard, type Lead } from './LeadCard';

export type LeadStatus = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

interface KanbanColumn {
  id: LeadStatus;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick?: (lead: Lead) => void;
  onLeadMove?: (leadId: string, newStatus: LeadStatus) => Promise<void>;
  onAddLead?: (status: LeadStatus) => void;
  isLoading?: boolean;
}

const columns: KanbanColumn[] = [
  {
    id: 'new',
    label: 'Nouveau',
    icon: Sparkles,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
  },
  {
    id: 'qualified',
    label: 'Qualifié',
    icon: Target,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
  },
  {
    id: 'proposal',
    label: 'Proposition',
    icon: FileText,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  {
    id: 'negotiation',
    label: 'Négociation',
    icon: Handshake,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    id: 'won',
    label: 'GAGNÉ',
    icon: Trophy,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    id: 'lost',
    label: 'PERDU',
    icon: XCircle,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
  },
];

export function KanbanBoard({
  leads,
  onLeadClick,
  onLeadMove,
  onAddLead,
  isLoading,
}: KanbanBoardProps) {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Handle scroll state for arrow visibility
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 10);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  }, []);

  // Scroll left/right handlers
  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }, []);

  // Group leads by status
  const leadsByStatus = columns.reduce((acc, col) => {
    acc[col.id] = leads.filter(lead => lead.status === col.id);
    return acc;
  }, {} as Record<LeadStatus, Lead[]>);

  // Calculate totals per column
  const totalsByStatus = columns.reduce((acc, col) => {
    acc[col.id] = leadsByStatus[col.id].reduce((sum, lead) => sum + lead.potential_value, 0);
    return acc;
  }, {} as Record<LeadStatus, number>);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M €`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}k €`;
    }
    return `${amount} €`;
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
    // Add a slight delay to allow the drag image to be set
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedLead(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  }, [dragOverColumn]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedLead || draggedLead.status === newStatus || !onLeadMove) {
      setDraggedLead(null);
      return;
    }

    setIsMoving(true);
    try {
      await onLeadMove(draggedLead.id, newStatus);
    } catch (error) {
      console.error('Failed to move lead:', error);
    } finally {
      setIsMoving(false);
      setDraggedLead(null);
    }
  }, [draggedLead, onLeadMove]);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex-shrink-0 w-72 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4"
          >
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-white/10 rounded w-24" />
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-white/5 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-xl hover:bg-slate-800 transition-all group"
          aria-label="Défiler vers la gauche"
        >
          <ChevronLeft size={24} className="text-white group-hover:text-cyan-400 transition-colors" />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-xl hover:bg-slate-800 transition-all group"
          aria-label="Défiler vers la droite"
        >
          <ChevronRight size={24} className="text-white group-hover:text-cyan-400 transition-colors" />
        </button>
      )}

      {/* Columns Container */}
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollState}
        className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)] px-10 scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
      {columns.map((column) => {
        const columnLeads = leadsByStatus[column.id];
        const columnTotal = totalsByStatus[column.id];
        const Icon = column.icon;
        const isDragOver = dragOverColumn === column.id && draggedLead?.status !== column.id;

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-72 backdrop-blur-xl border rounded-2xl transition-all",
              isDragOver
                ? `bg-white/10 ${column.borderColor} border-2 scale-[1.02]`
                : "bg-white/5 border-white/10",
              column.id === 'won' && "ring-1 ring-emerald-500/20",
              column.id === 'lost' && "ring-1 ring-rose-500/20"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className={cn(
              "p-4 border-b border-white/10 rounded-t-2xl",
              column.id === 'won' && "bg-emerald-500/5",
              column.id === 'lost' && "bg-rose-500/5"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg", column.bgColor)}>
                    <Icon size={14} className={column.color} />
                  </div>
                  <h3 className={cn("font-semibold", column.color)}>
                    {column.label}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-xs text-slate-400">
                    {columnLeads.length}
                  </span>
                </div>
                {onAddLead && column.id !== 'won' && column.id !== 'lost' && (
                  <button
                    onClick={() => onAddLead(column.id)}
                    className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {formatCurrency(columnTotal)}
              </p>
            </div>

            {/* Column Content */}
            <div className={cn(
              "p-2 space-y-2 min-h-[200px] transition-colors rounded-b-2xl",
              isDragOver && "bg-white/5"
            )}>
              {columnLeads.length > 0 ? (
                columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                  >
                    <LeadCard
                      lead={lead}
                      onClick={() => onLeadClick?.(lead)}
                      isDragging={draggedLead?.id === lead.id}
                    />
                  </div>
                ))
              ) : (
                <div className={cn(
                  "h-32 rounded-xl border-2 border-dashed flex items-center justify-center",
                  isDragOver
                    ? `${column.borderColor} ${column.bgColor}`
                    : "border-white/10"
                )}>
                  <p className="text-xs text-slate-500">
                    {isDragOver ? 'Déposer ici' : 'Aucun lead'}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

export default KanbanBoard;
