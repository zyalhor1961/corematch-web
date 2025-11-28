'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Search, Clock, Building2, Globe, ExternalLink, Sparkles,
  CheckCircle2, Loader2, ArrowRight, FolderSearch, Users,
  MapPin, Crosshair, Coins, Zap, Plus, AlertCircle, ChevronDown,
  UserSearch, Package, Handshake, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditGuardModal } from '@/components/ui/CreditGuardModal';
import { HunterProgress } from '@/components/CRM/Sourcing/HunterProgress';

// ============================================================
// TYPES
// ============================================================

interface LeadSearch {
  id: string;
  org_id: string;
  query_text: string;
  location: string | null;
  results_count: number;
  created_at: string;
  created_by: string | null;
}

interface SourcedLead {
  id: string;
  search_id: string;
  org_id: string;
  company_name: string;
  url: string | null;
  exa_summary: string | null;
  exa_score: number | null;
  is_enriched: boolean;
  is_converted_to_lead: boolean;
  lead_id: string | null;
  enrichment_data: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const HUNT_CREDIT_COST = 1;

// Search type options
type SearchType = 'clients' | 'suppliers' | 'partners';

const SEARCH_TYPES: { value: SearchType; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'clients',
    label: 'Clients',
    icon: UserSearch,
    description: 'Trouver des prospects et clients potentiels'
  },
  {
    value: 'suppliers',
    label: 'Fournisseurs',
    icon: Package,
    description: 'Trouver des vendeurs et catalogues'
  },
  {
    value: 'partners',
    label: 'Partenaires',
    icon: Handshake,
    description: 'Trouver des partenaires stratégiques'
  },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SourcingPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const supabase = createClientComponentClient();

  // Credit state
  const [creditsBalance, setCreditsBalance] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [orgBusinessContext, setOrgBusinessContext] = useState<string | null>(null);

  // Hunt state
  const [huntQuery, setHuntQuery] = useState('');
  const [huntLocation, setHuntLocation] = useState('');
  const [radius, setRadius] = useState(20); // Default 20km radius
  const [searchType, setSearchType] = useState<SearchType>('clients');
  const [searchCriteria, setSearchCriteria] = useState('');
  const [isHunting, setIsHunting] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);

  // Search history state
  const [searches, setSearches] = useState<LeadSearch[]>([]);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [sourcedLeads, setSourcedLeads] = useState<SourcedLead[]>([]);
  const [isLoadingSearches, setIsLoadingSearches] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch credits on mount
  useEffect(() => {
    if (orgId) {
      fetchCredits();
      fetchSearches();
    }
  }, [orgId]);

  // Fetch sourced leads when search is selected
  useEffect(() => {
    if (selectedSearchId) {
      fetchSourcedLeads(selectedSearchId);
    } else {
      setSourcedLeads([]);
    }
  }, [selectedSearchId]);

  const fetchCredits = async () => {
    setIsLoadingCredits(true);
    try {
      // Use API route that bypasses RLS
      const response = await fetch(`/api/org/${orgId}/credits`);
      const data = await response.json();

      if (!response.ok) {
        console.error('[Credits] API error:', data);
        throw new Error(data.error || 'Failed to fetch credits');
      }

      console.log('[Credits] Fetched:', data);
      setCreditsBalance(data.credits_balance ?? 0);
      setOrgBusinessContext(data.business_description ?? null);
    } catch (err) {
      console.error('[Credits] Failed to fetch credits:', err);
      setCreditsBalance(0);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const fetchSearches = async () => {
    setIsLoadingSearches(true);
    setError(null);
    try {
      const response = await fetch(`/api/brain/crm/searches/${orgId}`);
      const data = await response.json();

      if (data.success) {
        setSearches(data.searches || []);
        // Auto-select first search if available
        if (data.searches?.length > 0 && !selectedSearchId) {
          setSelectedSearchId(data.searches[0].id);
        }
      } else {
        setError(data.error || 'Failed to load searches');
      }
    } catch (err) {
      console.error('Failed to fetch searches:', err);
      setError('Failed to load searches');
    } finally {
      setIsLoadingSearches(false);
    }
  };

  const fetchSourcedLeads = async (searchId: string) => {
    setIsLoadingLeads(true);
    try {
      const response = await fetch(
        `/api/brain/crm/searches/${orgId}/${searchId}/leads`
      );
      const data = await response.json();

      if (data.success) {
        setSourcedLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to fetch sourced leads:', err);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  // ============================================================
  // HUNTER LOGIC
  // ============================================================

  const handleHuntClick = () => {
    if (!huntQuery.trim()) return;
    setShowCreditModal(true);
  };

  const handleConfirmHunt = async (refinedQuery?: string) => {
    setShowCreditModal(false);

    // Use refined query if provided, otherwise use original huntQuery
    const finalQuery = refinedQuery || huntQuery;

    // Optimistic UI: Decrement balance immediately
    setCreditsBalance(prev => Math.max(0, prev - HUNT_CREDIT_COST));
    setIsHunting(true);
    setError(null);

    try {
      const locationParts = huntLocation?.split(',').map(s => s.trim()) || [];
      const city = locationParts[0] || undefined;
      const region = locationParts[1] || undefined;

      const response = await fetch('/api/brain/growth/hunt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          city,
          region,
          radius: radius, // Radius in km
          orgId: orgId,
          maxResults: 10,
          searchType: searchType,
          criteria: searchCriteria || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for insufficient credits (402)
        if (response.status === 402) {
          // Revert optimistic update
          setCreditsBalance(prev => prev + HUNT_CREDIT_COST);
          setError(data.message || 'Crédits insuffisants');
          return;
        }
        throw new Error(data.error || 'Recherche échouée');
      }

      // Success - Update credit balance from server response (authoritative)
      if (typeof data.credits_remaining === 'number') {
        setCreditsBalance(data.credits_remaining);
      }

      // Refresh searches
      await fetchSearches();

      // Select the new search
      if (data.search_id) {
        setSelectedSearchId(data.search_id);
      }

      // Clear inputs
      setHuntQuery('');
      setHuntLocation('');
      setSearchCriteria('');

    } catch (err) {
      console.error('Hunt error:', err);
      // Revert optimistic update on error
      setCreditsBalance(prev => prev + HUNT_CREDIT_COST);
      setError(err instanceof Error ? err.message : 'Erreur de recherche');
    } finally {
      setIsHunting(false);
    }
  };

  const handleEnrichAndConvert = async (leadId: string) => {
    setEnrichingLeadId(leadId);
    try {
      const response = await fetch(
        `/api/brain/crm/sourced-leads/${leadId}/enrich`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (data.success) {
        setSourcedLeads(prev =>
          prev.map(lead =>
            lead.id === leadId
              ? {
                  ...lead,
                  is_enriched: true,
                  is_converted_to_lead: true,
                  lead_id: data.lead_id,
                  enrichment_data: data.enrichment_data,
                }
              : lead
          )
        );
      } else {
        alert(`Erreur: ${data.error || 'Enrichissement échoué'}`);
      }
    } catch (err) {
      console.error('Failed to enrich lead:', err);
      alert('Erreur lors de l\'enrichissement');
    } finally {
      setEnrichingLeadId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const extractDomain = (url: string | null) => {
    if (!url) return null;
    try {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    } catch {
      return url;
    }
  };

  const selectedSearch = searches.find(s => s.id === selectedSearchId);

  return (
    <div className="min-h-screen bg-[#0A0F1E] p-6">
      {/* Header with Credits */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
              <Crosshair size={24} className="text-purple-400" />
            </div>
            Lead Sourcing
          </h1>
          <p className="text-slate-400 mt-1">
            Trouvez des prospects qualifiés avec l'IA
          </p>
        </div>

        {/* Credits Display */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <Coins size={18} className="text-amber-400" />
          <span className="text-white font-semibold">
            {isLoadingCredits ? '...' : creditsBalance}
          </span>
          <span className="text-amber-400/70 text-sm">crédits</span>
        </div>
      </div>

      {/* Hunter Search Box */}
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-white/5">
        <h2 className="text-sm font-medium text-purple-300 mb-4 flex items-center gap-2">
          <Zap size={16} />
          Nouvelle Recherche
        </h2>

        {/* Search Type Selector */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2">
            Type de recherche
          </label>
          <div className="flex gap-2">
            {SEARCH_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = searchType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setSearchType(type.value)}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl border transition-all",
                    "flex flex-col items-center gap-1",
                    isSelected
                      ? "bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border-purple-500/50 text-white"
                      : "bg-white/5 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-300"
                  )}
                >
                  <Icon size={20} className={isSelected ? "text-purple-400" : ""} />
                  <span className="text-sm font-medium">{type.label}</span>
                  <span className="text-[10px] text-slate-500 text-center hidden md:block">
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Activity/Target Input */}
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">
              {searchType === 'clients' && 'Cible recherchée'}
              {searchType === 'suppliers' && 'Produit / Service recherché'}
              {searchType === 'partners' && 'Type de partenaire recherché'}
            </label>
            <textarea
              value={huntQuery}
              onChange={(e) => setHuntQuery(e.target.value)}
              placeholder={
                searchType === 'clients'
                  ? "Ex: Hôtels et résidences ayant besoin de rénovation façade..."
                  : searchType === 'suppliers'
                  ? "Ex: Machines-outils d'occasion, Pièces détachées industrielles..."
                  : "Ex: Investisseurs en série A, Distributeurs exclusifs..."
              }
              rows={2}
              className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Location Input */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Zone géographique
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={huntLocation}
                onChange={(e) => setHuntLocation(e.target.value)}
                placeholder="Ex: Lyon, Paris..."
                className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-3 py-2 text-white text-sm placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
              />
            </div>

            {/* Radius Slider */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Crosshair size={12} className="text-[#00B4D8]" />
                  Rayon de recherche
                </label>
                <span className="text-xs font-medium text-[#00B4D8]">
                  {radius === 0 ? 'Ville uniquement' : `${radius} km`}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
                    bg-gradient-to-r from-slate-700 to-slate-600
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[#00B4D8]
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:shadow-[#00B4D8]/30
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-white/20
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-[#00B4D8]
                    [&::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:border-white/20"
                  style={{
                    background: `linear-gradient(to right, #00B4D8 0%, #00B4D8 ${radius}%, #334155 ${radius}%, #334155 100%)`
                  }}
                />
                {/* Scale markers */}
                <div className="flex justify-between mt-1 text-[10px] text-slate-600">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100km</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Criteria Input (Optional) */}
        <div className="mt-4">
          <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Filter size={12} />
            Critères spécifiques (optionnel)
          </label>
          <input
            type="text"
            value={searchCriteria}
            onChange={(e) => setSearchCriteria(e.target.value)}
            placeholder={
              searchType === 'clients'
                ? "Ex: Budget > 50k€, Entreprises +50 employés..."
                : searchType === 'suppliers'
                ? "Ex: Occasion, Livraison rapide, Grossiste, Certifié ISO..."
                : "Ex: Expérience B2B, Capital +1M€..."
            }
            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:border-purple-500/50 focus:outline-none"
          />
        </div>

        {/* Hunt Button / Progress */}
        <AnimatePresence mode="wait">
          {isHunting ? (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4"
            >
              <HunterProgress />
            </motion.div>
          ) : (
            <motion.div
              key="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 flex items-center justify-between"
            >
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Coins size={12} className="text-amber-400" />
                Coût: {HUNT_CREDIT_COST} crédit par recherche
              </p>
              <button
                onClick={handleHuntClick}
                disabled={!huntQuery.trim()}
                className="px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Crosshair size={18} />
                Lancer la chasse
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Two-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Search History */}
        <div className="lg:col-span-1">
          <div className="bg-[#0F172A] border border-white/5 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <FolderSearch size={16} />
                Historique des recherches
              </h2>
            </div>

            <div className="max-h-[calc(100vh-450px)] overflow-y-auto">
              {isLoadingSearches ? (
                <div className="p-8 text-center">
                  <Loader2 size={24} className="animate-spin text-purple-400 mx-auto" />
                  <p className="text-slate-500 mt-2 text-sm">Chargement...</p>
                </div>
              ) : searches.length === 0 ? (
                <div className="p-8 text-center">
                  <Search size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Aucune recherche</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Lancez votre première recherche ci-dessus
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {searches.map((search) => (
                    <button
                      key={search.id}
                      onClick={() => setSelectedSearchId(search.id)}
                      className={cn(
                        "w-full p-4 text-left transition-all hover:bg-white/5",
                        selectedSearchId === search.id
                          ? "bg-purple-500/10 border-l-2 border-purple-500"
                          : ""
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {search.query_text}
                          </p>
                          {search.location && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                              <MapPin size={10} />
                              {search.location}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {search.results_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatDate(search.created_at)}
                            </span>
                          </div>
                        </div>
                        {selectedSearchId === search.id && (
                          <ArrowRight size={16} className="text-purple-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Sourced Leads */}
        <div className="lg:col-span-2">
          <div className="bg-[#0F172A] border border-white/5 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Building2 size={16} />
                  Prospects trouvés
                </h2>
                {selectedSearch && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    "{selectedSearch.query_text}" - {selectedSearch.results_count} résultats
                  </p>
                )}
              </div>
              {sourcedLeads.length > 0 && (
                <div className="text-xs text-slate-400">
                  {sourcedLeads.filter(l => l.is_converted_to_lead).length} / {sourcedLeads.length} convertis
                </div>
              )}
            </div>

            <div className="max-h-[calc(100vh-450px)] overflow-y-auto">
              {!selectedSearchId ? (
                <div className="p-12 text-center">
                  <FolderSearch size={48} className="text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Sélectionnez une recherche</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Ou lancez une nouvelle recherche ci-dessus
                  </p>
                </div>
              ) : isLoadingLeads ? (
                <div className="p-12 text-center">
                  <Loader2 size={32} className="animate-spin text-purple-400 mx-auto" />
                  <p className="text-slate-500 mt-3">Chargement des prospects...</p>
                </div>
              ) : sourcedLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <AlertCircle size={48} className="text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Aucun prospect dans cette recherche</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  <AnimatePresence>
                    {sourcedLeads.map((lead, index) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "p-4 transition-all",
                          lead.is_converted_to_lead ? "bg-emerald-500/5" : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Logo */}
                          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {lead.url ? (
                              <img
                                src={`https://logo.clearbit.com/${extractDomain(lead.url)}`}
                                alt={lead.company_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <Building2 size={20} className={cn("text-slate-400", lead.url && "hidden")} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-white">
                                {lead.company_name}
                              </h3>
                              {lead.is_converted_to_lead && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                                  <CheckCircle2 size={10} />
                                  Ajouté
                                </span>
                              )}
                            </div>

                            {lead.url && (
                              <a
                                href={lead.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-slate-500 hover:text-cyan-400 flex items-center gap-1 mt-0.5 w-fit"
                              >
                                <Globe size={10} />
                                {extractDomain(lead.url)}
                                <ExternalLink size={10} />
                              </a>
                            )}

                            {lead.exa_summary && (
                              <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                                {lead.exa_summary}
                              </p>
                            )}
                          </div>

                          {/* Score & Action */}
                          <div className="flex flex-col items-end gap-2">
                            {lead.exa_score !== null && (
                              <div className="text-center">
                                <span className={cn(
                                  "text-lg font-bold",
                                  lead.exa_score >= 80 ? "text-emerald-400" :
                                  lead.exa_score >= 60 ? "text-cyan-400" :
                                  lead.exa_score >= 40 ? "text-amber-400" : "text-slate-400"
                                )}>
                                  {Math.round(lead.exa_score)}%
                                </span>
                                <p className="text-[10px] text-slate-500">Score</p>
                              </div>
                            )}

                            {lead.is_converted_to_lead ? (
                              <a
                                href={`/org/${orgId}/crm`}
                                className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
                              >
                                Voir CRM
                                <ArrowRight size={12} />
                              </a>
                            ) : (
                              <button
                                onClick={() => handleEnrichAndConvert(lead.id)}
                                disabled={enrichingLeadId === lead.id}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all",
                                  enrichingLeadId === lead.id
                                    ? "bg-purple-500/30 text-purple-300 cursor-wait"
                                    : "bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600 shadow-lg shadow-purple-500/20"
                                )}
                              >
                                {enrichingLeadId === lead.id ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" />
                                    Enrichissement...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={12} />
                                    Enrichir & Ajouter
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Credit Guard Modal */}
      <CreditGuardModal
        isOpen={showCreditModal}
        onConfirm={handleConfirmHunt}
        onCancel={() => setShowCreditModal(false)}
        cost={HUNT_CREDIT_COST}
        currentBalance={creditsBalance}
        actionLabel="Recherche"
        targetQuery={huntQuery}
        targetLocation={huntLocation}
        orgBusinessContext={orgBusinessContext || undefined}
      />

      {/* Error Toast */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 right-4 bg-rose-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
        >
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:text-white/80">
            &times;
          </button>
        </motion.div>
      )}
    </div>
  );
}
