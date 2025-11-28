'use client';

import React, { useState } from 'react';
import {
  Layers, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Building2, FolderTree, Briefcase, MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AnalyticAxis {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'cost_center' | 'project' | 'department' | 'location' | 'custom';
  is_active: boolean;
  is_mandatory: boolean;
  values: AnalyticValue[];
  created_at: string;
}

export interface AnalyticValue {
  id: string;
  axis_id: string;
  code: string;
  name: string;
  parent_id?: string;
  is_active: boolean;
  budget?: number;
  spent?: number;
}

interface AnalyticAxesCardProps {
  axes: AnalyticAxis[];
  onAddAxis: () => void;
  onEditAxis: (axis: AnalyticAxis) => void;
  onDeleteAxis: (axisId: string) => Promise<void>;
  onToggleAxis: (axisId: string, isActive: boolean) => Promise<void>;
  onAddValue: (axisId: string) => void;
  onEditValue: (axisId: string, value: AnalyticValue) => void;
  onDeleteValue: (axisId: string, valueId: string) => Promise<void>;
  isLoading?: boolean;
}

const axisTypeConfig = {
  cost_center: {
    icon: Building2,
    label: 'Centre de coûts',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
  },
  project: {
    icon: Briefcase,
    label: 'Projet',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
  },
  department: {
    icon: FolderTree,
    label: 'Département',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
  },
  location: {
    icon: MapPin,
    label: 'Site/Localisation',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
  },
  custom: {
    icon: Layers,
    label: 'Personnalisé',
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
  },
};

export function AnalyticAxesCard({
  axes,
  onAddAxis,
  onEditAxis,
  onDeleteAxis,
  onToggleAxis,
  onAddValue,
  onEditValue,
  onDeleteValue,
  isLoading,
}: AnalyticAxesCardProps) {
  const [expandedAxes, setExpandedAxes] = useState<Set<string>>(new Set());
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  const toggleExpand = (axisId: string) => {
    setExpandedAxes(prev => {
      const next = new Set(prev);
      if (next.has(axisId)) {
        next.delete(axisId);
      } else {
        next.add(axisId);
      }
      return next;
    });
  };

  const handleDeleteAxis = async (axisId: string) => {
    setDeletingItem(axisId);
    try {
      await onDeleteAxis(axisId);
    } finally {
      setDeletingItem(null);
    }
  };

  const handleDeleteValue = async (axisId: string, valueId: string) => {
    setDeletingItem(valueId);
    try {
      await onDeleteValue(axisId, valueId);
    } finally {
      setDeletingItem(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getProgress = (spent?: number, budget?: number) => {
    if (!budget || budget === 0) return 0;
    return Math.min((spent || 0) / budget * 100, 100);
  };

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeAxes = axes.filter(a => a.is_active).length;
  const totalValues = axes.reduce((sum, a) => sum + a.values.length, 0);

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
            <Layers size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Axes Analytiques</h3>
            <p className="text-sm text-slate-400">
              {activeAxes} axe{activeAxes > 1 ? 's' : ''} actif{activeAxes > 1 ? 's' : ''}
              {' • '}{totalValues} valeur{totalValues > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={onAddAxis}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nouvel axe
        </button>
      </div>

      {/* Axes List */}
      <div className="divide-y divide-white/5">
        {axes.length > 0 ? (
          axes.map((axis) => {
            const config = axisTypeConfig[axis.type];
            const TypeIcon = config.icon;
            const isExpanded = expandedAxes.has(axis.id);
            const isDeleting = deletingItem === axis.id;

            return (
              <div
                key={axis.id}
                className={cn(
                  "transition-all",
                  !axis.is_active && "opacity-60",
                  isDeleting && "opacity-30"
                )}
              >
                {/* Axis Header */}
                <div className="p-4 flex items-center gap-4">
                  {/* Expand Toggle */}
                  <button
                    onClick={() => toggleExpand(axis.id)}
                    className="p-1 rounded hover:bg-white/5 text-slate-400 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {/* Type Icon */}
                  <div className={cn("p-2 rounded-lg shrink-0", config.bg)}>
                    <TypeIcon size={16} className={config.color} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{axis.code}</span>
                      <span className="font-medium text-white">{axis.name}</span>
                      {axis.is_mandatory && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-400 font-medium">
                          Obligatoire
                        </span>
                      )}
                    </div>
                    {axis.description && (
                      <p className="text-sm text-slate-500 truncate mt-0.5">{axis.description}</p>
                    )}
                  </div>

                  {/* Values Count */}
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{axis.values.length}</span>
                    <span className="text-xs text-slate-500 block">valeur{axis.values.length > 1 ? 's' : ''}</span>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => onToggleAxis(axis.id, !axis.is_active)}
                    className={cn(
                      "p-1 rounded transition-colors",
                      axis.is_active ? "text-emerald-400" : "text-slate-500"
                    )}
                  >
                    {axis.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onAddValue(axis.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-emerald-400 transition-colors"
                      title="Ajouter une valeur"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => onEditAxis(axis)}
                      className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteAxis(axis.id)}
                      disabled={isDeleting}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Values List */}
                {isExpanded && axis.values.length > 0 && (
                  <div className="pb-4 pl-16 pr-4 space-y-2">
                    {axis.values.map((value) => {
                      const progress = getProgress(value.spent, value.budget);
                      const isOverBudget = value.budget && value.spent && value.spent > value.budget;

                      return (
                        <div
                          key={value.id}
                          className={cn(
                            "p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center gap-4",
                            deletingItem === value.id && "opacity-30"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-500">{value.code}</span>
                              <span className="text-white">{value.name}</span>
                              {!value.is_active && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400">
                                  Inactif
                                </span>
                              )}
                            </div>

                            {/* Budget Progress */}
                            {value.budget !== undefined && value.budget > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-slate-500">
                                    {formatCurrency(value.spent || 0)} / {formatCurrency(value.budget)}
                                  </span>
                                  <span className={cn(
                                    "font-medium",
                                    isOverBudget ? "text-rose-400" : "text-slate-400"
                                  )}>
                                    {progress.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      isOverBudget
                                        ? "bg-gradient-to-r from-rose-500 to-red-500"
                                        : progress > 80
                                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                          : "bg-gradient-to-r from-cyan-500 to-emerald-500"
                                    )}
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Value Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onEditValue(axis.id, value)}
                              className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteValue(axis.id, value.id)}
                              className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empty Values State */}
                {isExpanded && axis.values.length === 0 && (
                  <div className="pb-4 pl-16 pr-4">
                    <div className="p-4 rounded-xl bg-slate-900/30 border border-dashed border-white/10 text-center">
                      <p className="text-sm text-slate-500 mb-2">Aucune valeur pour cet axe</p>
                      <button
                        onClick={() => onAddValue(axis.id)}
                        className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                      >
                        Ajouter une valeur
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex items-center justify-center mx-auto mb-4">
              <Layers size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 mb-1">Aucun axe analytique configuré</p>
            <p className="text-sm text-slate-500 mb-4">
              Créez des axes pour ventiler vos charges par projet, centre de coûts, etc.
            </p>
            <button
              onClick={onAddAxis}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              Créer mon premier axe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticAxesCard;
