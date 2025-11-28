'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Layers, Building2, FolderTree, Briefcase, MapPin,
  Save, AlertCircle, Plus, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticAxis, AnalyticValue } from './AnalyticAxesCard';

interface AxisEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (axis: Partial<AnalyticAxis>) => Promise<void>;
  axis?: AnalyticAxis | null;
  mode?: 'axis' | 'value';
  axisId?: string;
  value?: AnalyticValue | null;
  onSaveValue?: (axisId: string, value: Partial<AnalyticValue>) => Promise<void>;
}

const axisTypes = [
  { id: 'cost_center', label: 'Centre de coûts', icon: Building2, description: 'Pour répartir les charges par service ou département' },
  { id: 'project', label: 'Projet', icon: Briefcase, description: 'Pour suivre les coûts par projet client ou interne' },
  { id: 'department', label: 'Département', icon: FolderTree, description: 'Pour ventiler par département ou équipe' },
  { id: 'location', label: 'Site/Localisation', icon: MapPin, description: 'Pour répartir par site géographique' },
  { id: 'custom', label: 'Personnalisé', icon: Layers, description: 'Axe personnalisé selon vos besoins' },
] as const;

export function AxisEditorModal({
  isOpen,
  onClose,
  onSave,
  axis,
  mode = 'axis',
  axisId,
  value,
  onSaveValue,
}: AxisEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Axis form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AnalyticAxis['type']>('cost_center');
  const [isMandatory, setIsMandatory] = useState(false);

  // Value form state
  const [valueCode, setValueCode] = useState('');
  const [valueName, setValueName] = useState('');
  const [valueBudget, setValueBudget] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (mode === 'axis') {
        if (axis) {
          setCode(axis.code);
          setName(axis.name);
          setDescription(axis.description || '');
          setType(axis.type);
          setIsMandatory(axis.is_mandatory);
        } else {
          setCode('');
          setName('');
          setDescription('');
          setType('cost_center');
          setIsMandatory(false);
        }
      } else if (mode === 'value') {
        if (value) {
          setValueCode(value.code);
          setValueName(value.name);
          setValueBudget(value.budget?.toString() || '');
        } else {
          setValueCode('');
          setValueName('');
          setValueBudget('');
        }
      }
    }
  }, [isOpen, axis, mode, value]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'axis') {
        if (!code.trim() || !name.trim()) {
          throw new Error('Le code et le nom sont obligatoires');
        }

        await onSave({
          ...(axis && { id: axis.id }),
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          is_mandatory: isMandatory,
          is_active: axis?.is_active ?? true,
          values: axis?.values ?? [],
        });
      } else if (mode === 'value' && axisId && onSaveValue) {
        if (!valueCode.trim() || !valueName.trim()) {
          throw new Error('Le code et le nom sont obligatoires');
        }

        await onSaveValue(axisId, {
          ...(value && { id: value.id }),
          axis_id: axisId,
          code: valueCode.trim().toUpperCase(),
          name: valueName.trim(),
          budget: valueBudget ? parseFloat(valueBudget) : undefined,
          is_active: value?.is_active ?? true,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const isEditing = mode === 'axis' ? !!axis : !!value;
  const title = mode === 'axis'
    ? (isEditing ? 'Modifier l\'axe' : 'Nouvel axe analytique')
    : (isEditing ? 'Modifier la valeur' : 'Nouvelle valeur');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 backdrop-blur-xl bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
              <Layers size={20} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {mode === 'axis' ? (
            <>
              {/* Axis Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300">Type d'axe</label>
                <div className="grid grid-cols-2 gap-2">
                  {axisTypes.map((t) => {
                    const Icon = t.icon;
                    const isSelected = type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          isSelected
                            ? "border-purple-500/50 bg-purple-500/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={isSelected ? "text-purple-400" : "text-slate-400"} />
                          <span className={cn("text-sm font-medium", isSelected ? "text-white" : "text-slate-300")}>
                            {t.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Code & Name */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="AXE1"
                    maxLength={10}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-slate-300 block mb-2">Nom</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Centre de coûts principal"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Description (optionnel)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de l'axe..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              </div>

              {/* Options */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                  />
                  <span className="text-sm text-slate-300">Obligatoire lors de la saisie</span>
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Value Code & Name */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">Code</label>
                  <input
                    type="text"
                    value={valueCode}
                    onChange={(e) => setValueCode(e.target.value.toUpperCase())}
                    placeholder="VAL1"
                    maxLength={10}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-slate-300 block mb-2">Nom</label>
                  <input
                    type="text"
                    value={valueName}
                    onChange={(e) => setValueName(e.target.value)}
                    placeholder="Service Commercial"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Budget annuel (optionnel)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={valueBudget}
                    onChange={(e) => setValueBudget(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Définir un budget permet de suivre la consommation en temps réel
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEditing ? 'Modifier' : 'Créer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default AxisEditorModal;
