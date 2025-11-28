'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Building2, User, Mail, Phone, Globe, DollarSign,
  Sparkles, Save, Loader2, CheckCircle2,
  AlertCircle, AlertTriangle, TrendingUp, Zap, Shield, Users, Handshake,
  Target, Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Lead } from './LeadCard';
import { type LeadStatus } from './KanbanBoard';
import { motion } from 'framer-motion';

// ============================================================
// TYPES & INTERFACES
// ============================================================

interface EnrichmentData {
  company_name?: string;
  website?: string;
  logo_url?: string;
  description?: string;
  sector?: string;
  headquarters?: string;
  employee_count?: string;
  ai_summary?: string;
  ai_score?: number;
  ai_next_action?: string;
  suggested_contact?: {
    name?: string;
    role?: string;
    email_pattern?: string;
  };
  relationship_type?: 'prospect' | 'competitor' | 'partner' | 'unknown';
  relationship_reasoning?: string;
  buying_signals?: string[];
  pain_points?: string[];
}

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lead: Omit<Lead, 'id' | 'created_at' | 'last_activity_at'>) => Promise<void>;
  initialStatus?: LeadStatus;
  orgId: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const statusOptions: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'Nouveau', color: 'bg-slate-500' },
  { value: 'qualified', label: 'Qualifié', color: 'bg-cyan-500' },
  { value: 'proposal', label: 'Proposition', color: 'bg-purple-500' },
  { value: 'negotiation', label: 'Négociation', color: 'bg-amber-500' },
  { value: 'won', label: 'Gagné', color: 'bg-emerald-500' },
  { value: 'lost', label: 'Perdu', color: 'bg-rose-500' },
];

const relationshipConfig = {
  prospect: {
    label: 'Prospect',
    icon: Target,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    emoji: '✅',
  },
  competitor: {
    label: 'Concurrent',
    icon: Shield,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    emoji: '⚠️',
  },
  partner: {
    label: 'Partenaire',
    icon: Handshake,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    emoji: '🤝',
  },
  unknown: {
    label: 'Inconnu',
    icon: Users,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    emoji: '❓',
  },
};

// ============================================================
// MAIN COMPONENT - Simplified for Warm Leads / Manual Entry
// ============================================================

export function LeadFormModal({
  isOpen,
  onClose,
  onSave,
  initialStatus = 'new',
  orgId,
}: LeadFormModalProps) {
  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    website: '',
    logo_url: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    status: initialStatus,
    potential_value: 0,
    probability: 20,
    currency: 'EUR',
    ai_summary: '',
    ai_next_action: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Enrichment state
  const [myBusiness, setMyBusiness] = useState('');
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentDomain, setEnrichmentDomain] = useState('');
  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [enrichmentError, setEnrichmentError] = useState('');
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        company_name: '',
        website: '',
        logo_url: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        status: initialStatus,
        potential_value: 0,
        probability: 20,
        currency: 'EUR',
        ai_summary: '',
        ai_next_action: '',
      });
      setErrors({});
      setEnrichmentDomain('');
      setEnrichmentStatus('idle');
      setEnrichmentError('');
      setEnrichmentData(null);
    }
  }, [isOpen, initialStatus]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ============================================================
  // ENRICHMENT LOGIC (Analyze URL)
  // ============================================================

  const handleEnrich = async () => {
    if (!enrichmentDomain.trim()) return;

    setIsEnriching(true);
    setEnrichmentStatus('idle');
    setEnrichmentError('');
    setEnrichmentData(null);

    try {
      const response = await fetch('/api/crm/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: enrichmentDomain,
          myBusiness: myBusiness.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Enrichment failed');
      }

      const data: EnrichmentData = await response.json();
      setEnrichmentData(data);

      // Fill form with enriched data
      setFormData(prev => ({
        ...prev,
        company_name: data.company_name || prev.company_name,
        website: data.website || prev.website,
        logo_url: data.logo_url || prev.logo_url,
        ai_summary: data.ai_summary || prev.ai_summary,
        ai_next_action: data.ai_next_action || prev.ai_next_action,
        probability: data.relationship_type === 'competitor' ? 0 : (data.ai_score || prev.probability),
        contact_name: data.suggested_contact?.name || prev.contact_name,
        contact_email: data.suggested_contact?.email_pattern
          ? data.suggested_contact.email_pattern.replace('prenom.nom', 'contact')
          : prev.contact_email,
      }));

      setEnrichmentStatus('success');
    } catch (error: any) {
      console.error('Enrichment error:', error);
      setEnrichmentStatus('error');
      setEnrichmentError(error.message || 'Enrichissement échoué');
    } finally {
      setIsEnriching(false);
    }
  };

  // ============================================================
  // FORM LOGIC
  // ============================================================

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Le nom de l\'entreprise est requis';
    }

    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Email invalide';
    }

    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'URL invalide (doit commencer par http:// ou https://)';
    }

    if (formData.potential_value < 0) {
      newErrors.potential_value = 'La valeur doit être positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave({
        org_id: orgId,
        company_name: formData.company_name.trim(),
        website: formData.website.trim() || undefined,
        logo_url: formData.logo_url.trim() || undefined,
        contact_name: formData.contact_name.trim() || undefined,
        contact_email: formData.contact_email.trim() || undefined,
        contact_phone: formData.contact_phone.trim() || undefined,
        status: formData.status,
        potential_value: formData.potential_value,
        probability: formData.probability,
        currency: formData.currency,
        ai_summary: formData.ai_summary.trim() || undefined,
        ai_next_action: formData.ai_next_action.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save lead:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  const relationshipType = enrichmentData?.relationship_type || 'unknown';
  const relationshipInfo = relationshipConfig[relationshipType];
  const RelationshipIcon = relationshipInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-white/5 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
              <Building2 size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Nouveau Lead</h2>
              <p className="text-xs text-slate-500">Ajout manuel ou analyse de site</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">

            {/* ✨ ANALYZE SECTION */}
            <div className="backdrop-blur-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-white/5 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                  <Wand2 size={14} />
                  Analyse IA (optionnel)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Entrez un site web pour pré-remplir le formulaire automatiquement
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* My Business Context */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Mon activité <span className="text-purple-400">(aide l'IA à qualifier)</span>
                  </label>
                  <input
                    type="text"
                    value={myBusiness}
                    onChange={(e) => setMyBusiness(e.target.value)}
                    placeholder="Ex: Rénovation bâtiment, SaaS RH, Conseil IT..."
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                  />
                </div>

                {/* Domain Enrichment */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Site web de l'entreprise cible
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={enrichmentDomain}
                        onChange={(e) => setEnrichmentDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleEnrich();
                          }
                        }}
                        placeholder="Ex: marriott.com, nexity.fr, accor.com"
                        className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-3 py-2 text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleEnrich}
                      disabled={isEnriching || !enrichmentDomain.trim()}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all",
                        isEnriching
                          ? "bg-purple-500/30 text-purple-300"
                          : "bg-purple-500 text-white hover:bg-purple-600"
                      )}
                    >
                      {isEnriching ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Analyse...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          Analyser
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Messages */}
                {enrichmentStatus === 'success' && enrichmentData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Relationship Type Badge */}
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      relationshipInfo.bg,
                      relationshipInfo.border
                    )}>
                      <RelationshipIcon size={20} className={relationshipInfo.color} />
                      <div className="flex-1">
                        <p className={cn("font-medium", relationshipInfo.color)}>
                          {relationshipInfo.emoji} Type: {relationshipInfo.label}
                        </p>
                        {enrichmentData.relationship_reasoning && (
                          <p className="text-sm text-slate-400 mt-0.5">
                            {enrichmentData.relationship_reasoning}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Competitor Warning */}
                    {enrichmentData.relationship_type === 'competitor' && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
                        <AlertTriangle size={20} className="text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-rose-300 font-medium">Concurrent détecté</p>
                          <p className="text-sm text-slate-400 mt-1">
                            Vous pouvez quand même l'ajouter pour veille concurrentielle.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Buying Signals */}
                    {enrichmentData.buying_signals && enrichmentData.buying_signals.length > 0 && (
                      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 mb-2">
                          <TrendingUp size={12} />
                          Signaux d'achat détectés
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {enrichmentData.buying_signals.map((signal, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle2 size={14} />
                      Analyse complète !
                    </div>
                  </motion.div>
                )}

                {enrichmentStatus === 'error' && (
                  <div className="flex items-center gap-2 text-rose-400 text-sm">
                    <AlertCircle size={14} />
                    {enrichmentError || 'Erreur lors de l\'analyse'}
                  </div>
                )}
              </div>
            </div>

            {/* Logo Preview */}
            {formData.logo_url && (
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <img
                  src={formData.logo_url}
                  alt="Company Logo"
                  className="w-12 h-12 rounded-lg object-cover bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{formData.company_name || 'Logo détecté'}</p>
                  <p className="text-xs text-slate-400">{formData.website}</p>
                </div>
                {enrichmentData?.relationship_type && enrichmentData.relationship_type !== 'unknown' && (
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    relationshipInfo.bg,
                    relationshipInfo.color
                  )}>
                    {relationshipInfo.emoji} {relationshipInfo.label}
                  </span>
                )}
              </div>
            )}

            {/* Company Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Building2 size={14} />
                Informations entreprise
              </h3>

              {/* Company Name */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Nom de l'entreprise <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="Ex: Acme Corp"
                  className={cn(
                    "w-full bg-white/5 border rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none",
                    errors.company_name ? "border-rose-500" : "border-white/5 focus:border-cyan-500/50"
                  )}
                />
                {errors.company_name && (
                  <p className="text-xs text-rose-400 mt-1">{errors.company_name}</p>
                )}
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Site web</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://example.com"
                    className={cn(
                      "w-full bg-white/5 border rounded-lg pl-10 pr-3 py-2 text-white placeholder:text-slate-500 focus:outline-none",
                      errors.website ? "border-rose-500" : "border-white/5 focus:border-cyan-500/50"
                    )}
                  />
                </div>
                {errors.website && (
                  <p className="text-xs text-rose-400 mt-1">{errors.website}</p>
                )}
              </div>

              {/* Sector & Headquarters from enrichment */}
              {enrichmentData && (enrichmentData.sector || enrichmentData.headquarters) && (
                <div className="grid grid-cols-2 gap-4">
                  {enrichmentData.sector && (
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-xs text-slate-500">Secteur</p>
                      <p className="text-sm text-white">{enrichmentData.sector}</p>
                    </div>
                  )}
                  {enrichmentData.headquarters && (
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-xs text-slate-500">Siège</p>
                      <p className="text-sm text-white">{enrichmentData.headquarters}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <User size={14} />
                Contact principal
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Contact Name */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => handleChange('contact_name', e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Téléphone</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      placeholder="+33 1 23 45 67 89"
                      className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleChange('contact_email', e.target.value)}
                    placeholder="contact@example.com"
                    className={cn(
                      "w-full bg-white/5 border rounded-lg pl-10 pr-3 py-2 text-white placeholder:text-slate-500 focus:outline-none",
                      errors.contact_email ? "border-rose-500" : "border-white/5 focus:border-cyan-500/50"
                    )}
                  />
                </div>
                {errors.contact_email && (
                  <p className="text-xs text-rose-400 mt-1">{errors.contact_email}</p>
                )}
              </div>
            </div>

            {/* Deal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <DollarSign size={14} />
                Opportunité
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Potential Value */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Valeur potentielle (€)</label>
                  <input
                    type="number"
                    value={formData.potential_value}
                    onChange={(e) => handleChange('potential_value', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="100"
                    className={cn(
                      "w-full bg-white/5 border rounded-lg px-3 py-2 text-white font-mono focus:outline-none",
                      errors.potential_value ? "border-rose-500" : "border-white/5 focus:border-cyan-500/50"
                    )}
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value} className="bg-slate-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Probability */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Score de qualification: <span className={cn(
                    "font-medium",
                    formData.probability <= 30 ? "text-rose-400" :
                    formData.probability <= 60 ? "text-amber-400" : "text-emerald-400"
                  )}>{formData.probability}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.probability}
                  onChange={(e) => handleChange('probability', parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Froid</span>
                  <span>Tiède</span>
                  <span>Chaud</span>
                </div>
              </div>
            </div>

            {/* AI Notes */}
            {(formData.ai_summary || formData.ai_next_action) && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                  <Sparkles size={14} />
                  Insights IA
                </h3>

                {formData.ai_summary && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Résumé stratégique</label>
                    <textarea
                      value={formData.ai_summary}
                      onChange={(e) => handleChange('ai_summary', e.target.value)}
                      rows={3}
                      className="w-full bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none resize-none"
                    />
                  </div>
                )}

                {formData.ai_next_action && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Prochaine action</label>
                    <input
                      type="text"
                      value={formData.ai_next_action}
                      onChange={(e) => handleChange('ai_next_action', e.target.value)}
                      className="w-full bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-300 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-4 border-t border-white/5 bg-[#0F172A]/80 backdrop-blur">
            <div className="text-xs text-slate-500">
              {enrichmentData?.relationship_type === 'competitor' && (
                <span className="text-rose-400">⚠️ Concurrent détecté</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2",
                  enrichmentData?.relationship_type === 'competitor'
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-600 hover:to-purple-600 shadow-lg shadow-cyan-500/25"
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {enrichmentData?.relationship_type === 'competitor' ? 'Ajouter (veille)' : 'Créer le lead'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeadFormModal;
