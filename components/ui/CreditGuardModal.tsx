'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Sparkles, X, AlertTriangle, CreditCard, Zap, MapPin, Target, Lightbulb, Pencil, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditGuardModalProps {
  isOpen: boolean;
  onConfirm: (refinedQuery?: string) => void;
  onCancel: () => void;
  cost: number;
  currentBalance: number;
  actionLabel?: string;
  // Mission summary props
  targetQuery?: string;
  targetLocation?: string;
  // Organization context (who the user is)
  orgBusinessContext?: string;
}

export function CreditGuardModal({
  isOpen,
  onConfirm,
  onCancel,
  cost,
  currentBalance,
  actionLabel = 'Recherche',
  targetQuery,
  targetLocation,
  orgBusinessContext,
}: CreditGuardModalProps) {
  // Internal state for editable query
  const [refinedQuery, setRefinedQuery] = useState(targetQuery || '');
  const [isEditing, setIsEditing] = useState(false);

  // Reset query when modal opens with new targetQuery
  useEffect(() => {
    if (isOpen && targetQuery) {
      setRefinedQuery(targetQuery);
      setIsEditing(false);
    }
  }, [isOpen, targetQuery]);

  const hasEnoughCredits = currentBalance >= cost;
  const remainingAfter = currentBalance - cost;

  // Check if query is too short (potential bad input)
  const currentQuery = refinedQuery || targetQuery || '';
  const isQueryTooShort = currentQuery && currentQuery.trim().length < 5;
  const isQuerySuspicious = currentQuery && (
    currentQuery.trim().length < 5 ||
    /^[a-z]+$/i.test(currentQuery.trim()) && currentQuery.trim().length < 8
  );

  // Handler for confirm - pass refined query back
  const handleConfirm = () => {
    onConfirm(refinedQuery !== targetQuery ? refinedQuery : undefined);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onCancel}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md"
        >
          {/* Glass Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl shadow-2xl">
            {/* Glow Effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

            {/* Close Button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="relative p-6">
              {hasEnoughCredits ? (
                <>
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full blur-lg opacity-40" />
                      <div className="relative p-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10">
                        <Sparkles size={32} className="text-cyan-400" />
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-white text-center mb-4">
                    Confirmer {actionLabel} ?
                  </h2>

                  {/* Mission Summary */}
                  {(targetQuery || targetLocation || orgBusinessContext) && (
                    <div className="mb-4">
                      <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">
                          Résumé de la mission
                        </p>

                        {/* Organization Context - WHO you are */}
                        {orgBusinessContext && (
                          <div className="flex items-start gap-3 mb-3 pb-3 border-b border-white/5">
                            <Building2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 mb-0.5">Votre activité</p>
                              <p className="text-sm font-medium text-emerald-300 break-words">
                                {orgBusinessContext}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Target Query - EDITABLE */}
                        {(targetQuery || refinedQuery) && (
                          <div className="flex items-start gap-3 mb-2">
                            <Target size={16} className={cn(
                              "mt-0.5 flex-shrink-0",
                              isQuerySuspicious ? "text-amber-400" : "text-purple-400"
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className="text-xs text-slate-500">Cible</p>
                                {!isEditing && (
                                  <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                  >
                                    <Pencil size={10} />
                                    Modifier
                                  </button>
                                )}
                              </div>
                              {isEditing ? (
                                <textarea
                                  value={refinedQuery}
                                  onChange={(e) => setRefinedQuery(e.target.value)}
                                  className={cn(
                                    "w-full px-3 py-2 rounded-lg text-sm font-medium",
                                    "bg-slate-800/80 border border-cyan-500/30",
                                    "text-white placeholder-slate-500",
                                    "focus:outline-none focus:ring-2 focus:ring-cyan-500/50",
                                    "resize-none"
                                  )}
                                  rows={2}
                                  placeholder="Décrivez précisément ce que vous recherchez..."
                                  autoFocus
                                  onBlur={() => {
                                    if (refinedQuery.trim()) {
                                      setIsEditing(false);
                                    }
                                  }}
                                />
                              ) : (
                                <p className={cn(
                                  "text-sm font-medium break-words",
                                  isQuerySuspicious ? "text-amber-400" : "text-white"
                                )}>
                                  {refinedQuery || targetQuery}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Target Location */}
                        {targetLocation && (
                          <div className="flex items-start gap-3">
                            <MapPin size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 mb-0.5">Zone</p>
                              <p className="text-sm font-medium text-white break-words">
                                {targetLocation || 'France entière'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Warning for short queries */}
                        {isQuerySuspicious && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <div className="flex items-start gap-2 text-amber-400/80">
                              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                              <p className="text-xs">
                                Requête très courte - les résultats pourraient être imprécis.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tips */}
                      <div className="flex items-start gap-2 mt-3 px-1">
                        <Lightbulb size={12} className="text-slate-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          <span className="text-slate-400">Astuce:</span> Soyez précis pour obtenir les meilleurs leads
                          (ex: "Hôtels ayant besoin de rénovation" au lieu de "Hôtels").
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Cost Display */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-slate-400">Cette action coûte</span>
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                      <Coins size={16} className="text-cyan-400" />
                      <span className="text-cyan-300 font-bold">{cost}</span>
                      <span className="text-cyan-400 text-sm">crédit{cost > 1 ? 's' : ''}</span>
                    </span>
                  </div>

                  {/* Balance Info */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Solde actuel</span>
                      <span className="text-white font-semibold flex items-center gap-1">
                        <Coins size={14} className="text-amber-400" />
                        {currentBalance}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Après {actionLabel.toLowerCase()}</span>
                      <span className={cn(
                        "font-semibold flex items-center gap-1",
                        remainingAfter <= 5 ? "text-amber-400" : "text-emerald-400"
                      )}>
                        <Coins size={14} />
                        {remainingAfter}
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={onCancel}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-600 hover:to-purple-600 transition-colors font-medium shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                    >
                      <Zap size={18} />
                      Confirmer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Empty State - No Credits */}
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-lg" />
                      <div className="relative p-4 rounded-full bg-amber-500/20 border border-amber-500/30">
                        <AlertTriangle size={32} className="text-amber-400" />
                      </div>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white text-center mb-2">
                    Oups ! Réservoir vide
                  </h2>

                  <p className="text-slate-400 text-center mb-6">
                    Vous avez besoin de <span className="text-cyan-400 font-semibold">{cost} crédit{cost > 1 ? 's' : ''}</span> pour cette recherche,
                    mais votre solde est de <span className="text-amber-400 font-semibold">{currentBalance}</span>.
                  </p>

                  {/* Balance Display */}
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-amber-400">
                      <Coins size={20} />
                      <span className="text-2xl font-bold">{currentBalance}</span>
                      <span className="text-sm">crédit{currentBalance !== 1 ? 's' : ''} restant{currentBalance !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={onCancel}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
                    >
                      Fermer
                    </button>
                    <button
                      onClick={() => {
                        // TODO: Implement purchase flow
                        window.open('/pricing', '_blank');
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors font-medium shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
                    >
                      <CreditCard size={18} />
                      Recharger
                    </button>
                  </div>

                  {/* Pricing Hint */}
                  <p className="text-xs text-slate-500 text-center mt-4">
                    50 crédits pour 49€ - Pas d'abonnement
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CreditGuardModal;
