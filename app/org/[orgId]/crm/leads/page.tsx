'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users, Plus, Search, Filter, ArrowLeft, Sparkles, Target,
  TrendingUp, RefreshCw, Download, BarChart2, CheckCircle2, FileText, X
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  KanbanBoard,
  LeadDrawer,
  LeadFormModal,
  type Lead,
  type LeadStatus,
  type LeadActivity,
} from '@/components/erp';

interface ConversionResult {
  success: boolean;
  clientId: string;
  invoiceId: string;
  invoiceNumber: string;
  message: string;
  isNewClient: boolean;
}

export default function LeadsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addToStatus, setAddToStatus] = useState<LeadStatus>('new');

  // Conversion modal state
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Load leads from Supabase
  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch leads from Supabase
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (leadsError) {
        console.error('Error loading leads:', leadsError);
        throw leadsError;
      }

      setLeads(leadsData || []);

      // Fetch all activities for this org's leads
      if (leadsData && leadsData.length > 0) {
        const leadIds = leadsData.map(l => l.id);
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('lead_activities')
          .select('*')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false });

        if (!activitiesError) {
          setActivities(activitiesData || []);
        }
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handler: Convert lead to client + invoice
  const handleConvertToClient = async (leadId: string) => {
    setIsConverting(true);
    setShowConversionModal(true);
    setConversionResult(null);

    try {
      const response = await fetch('/api/crm/convert-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      setConversionResult(data);

      // Refresh leads to get updated data
      loadLeads();
    } catch (error: any) {
      console.error('Conversion error:', error);
      setConversionResult({
        success: false,
        clientId: '',
        invoiceId: '',
        invoiceNumber: '',
        message: error.message || 'Erreur lors de la conversion',
        isNewClient: false,
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Handler: Move lead to new status
  const handleLeadMove = async (leadId: string, newStatus: LeadStatus) => {
    // Optimistic update
    setLeads(prev =>
      prev.map(lead =>
        lead.id === leadId
          ? { ...lead, status: newStatus, last_activity_at: new Date().toISOString() }
          : lead
      )
    );

    // Update in Supabase
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);

    if (error) {
      console.error('Error moving lead:', error);
      // Revert on error
      loadLeads();
      return;
    }

    // ONE-CLICK CLOSE: When lead is moved to "won", auto-convert to client + invoice
    if (newStatus === 'won') {
      await handleConvertToClient(leadId);
    }
  };

  // Handler: Click on lead card
  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDrawerOpen(true);
  };

  // Handler: Save lead changes
  const handleSaveLead = async (updatedLead: Partial<Lead>) => {
    if (!selectedLead) return;

    // Optimistic update
    setLeads(prev =>
      prev.map(lead =>
        lead.id === selectedLead.id
          ? { ...lead, ...updatedLead, last_activity_at: new Date().toISOString() }
          : lead
      )
    );

    setSelectedLead(prev => prev ? { ...prev, ...updatedLead } : null);

    // Update in Supabase
    const { error } = await supabase
      .from('leads')
      .update(updatedLead)
      .eq('id', selectedLead.id);

    if (error) {
      console.error('Error saving lead:', error);
      loadLeads();
    }
  };

  // Handler: Delete lead
  const handleDeleteLead = async (leadId: string) => {
    // Optimistic update
    setLeads(prev => prev.filter(lead => lead.id !== leadId));

    // Delete from Supabase
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.error('Error deleting lead:', error);
      loadLeads();
    }
  };

  // Handler: Add activity
  const handleAddActivity = async (
    leadId: string,
    activity: Omit<LeadActivity, 'id' | 'lead_id' | 'created_at'>
  ) => {
    // Insert into Supabase
    const { data, error } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        activity_type: activity.activity_type,
        content: activity.content,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding activity:', error);
      return;
    }

    if (data) {
      setActivities(prev => [data as LeadActivity, ...prev]);

      // Update lead's last activity locally
      setLeads(prev =>
        prev.map(lead =>
          lead.id === leadId
            ? { ...lead, last_activity_at: new Date().toISOString() }
            : lead
        )
      );
    }
  };

  // Handler: Add new lead
  const handleAddLead = (status: LeadStatus) => {
    setAddToStatus(status);
    setShowAddModal(true);
  };

  // Handler: Create new lead
  const handleCreateLead = async (newLead: Omit<Lead, 'id' | 'created_at' | 'last_activity_at'>) => {
    // Insert into Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert({
        org_id: orgId,
        company_name: newLead.company_name,
        website: newLead.website || null,
        logo_url: newLead.logo_url || null,
        contact_name: newLead.contact_name || null,
        contact_email: newLead.contact_email || null,
        contact_phone: newLead.contact_phone || null,
        status: newLead.status,
        potential_value: newLead.potential_value,
        probability: newLead.probability,
        currency: newLead.currency,
        ai_summary: newLead.ai_summary || null,
        ai_next_action: newLead.ai_next_action || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    if (data) {
      // Add to local state
      setLeads(prev => [...prev, data as Lead]);
    }
  };

  // Calculate pipeline stats
  const pipelineStats = {
    totalValue: leads.reduce((sum, lead) =>
      lead.status !== 'lost' ? sum + lead.potential_value : sum, 0
    ),
    weightedValue: leads.reduce((sum, lead) =>
      lead.status !== 'lost' ? sum + (lead.potential_value * lead.probability / 100) : sum, 0
    ),
    wonValue: leads.reduce((sum, lead) =>
      lead.status === 'won' ? sum + lead.potential_value : sum, 0
    ),
    leadsCount: leads.filter(l => l.status !== 'lost').length,
    avgProbability: leads.length > 0
      ? Math.round(leads.reduce((sum, lead) => sum + lead.probability, 0) / leads.length)
      : 0,
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M €`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}k €`;
    }
    return `${amount} €`;
  };

  // Filter leads by search
  const filteredLeads = searchQuery
    ? leads.filter(lead =>
        lead.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leads;

  // Get activities for selected lead
  const selectedLeadActivities = selectedLead
    ? activities.filter(a => a.lead_id === selectedLead.id)
    : [];

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/org/${orgId}/erp/invoices`}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                  <Users size={24} className="text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Pipeline Commercial</h1>
                  <p className="text-sm text-slate-400">Gestion des leads et opportunités</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-64 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Actions */}
              <button
                onClick={() => loadLeads()}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw size={18} />
              </button>

              <button
                onClick={() => handleAddLead('new')}
                className="px-4 py-2 rounded-lg bg-[#00B4D8] text-white font-semibold hover:bg-[#00a3c4] transition-all shadow-lg shadow-[#00B4D8]/20 flex items-center gap-2"
              >
                <Plus size={16} />
                Nouveau lead
              </button>
            </div>
          </div>

          {/* Pipeline Stats */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <BarChart2 size={12} />
                Pipeline total
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {formatCurrency(pipelineStats.totalValue)}
              </p>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <TrendingUp size={12} />
                Pondéré
              </div>
              <p className="text-lg font-bold text-cyan-400 font-mono">
                {formatCurrency(pipelineStats.weightedValue)}
              </p>
            </div>
            <div className="backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
                <Sparkles size={12} />
                Gagné
              </div>
              <p className="text-lg font-bold text-emerald-400 font-mono">
                {formatCurrency(pipelineStats.wonValue)}
              </p>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Users size={12} />
                Leads actifs
              </div>
              <p className="text-lg font-bold text-white font-mono">
                {pipelineStats.leadsCount}
              </p>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Target size={12} />
                Prob. moyenne
              </div>
              <p className="text-lg font-bold text-purple-400 font-mono">
                {pipelineStats.avgProbability}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-6">
        <KanbanBoard
          leads={filteredLeads}
          onLeadClick={handleLeadClick}
          onLeadMove={handleLeadMove}
          onAddLead={handleAddLead}
          isLoading={isLoading}
        />
      </div>

      {/* Lead Drawer */}
      <LeadDrawer
        lead={selectedLead}
        activities={selectedLeadActivities}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLead(null);
        }}
        onSave={handleSaveLead}
        onDelete={handleDeleteLead}
        onAddActivity={handleAddActivity}
      />

      {/* Add Lead Modal */}
      <LeadFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleCreateLead}
        initialStatus={addToStatus}
        orgId={orgId}
      />

      {/* Conversion Success Modal */}
      {showConversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isConverting && setShowConversionModal(false)}
          />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {isConverting ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Conversion en cours...
                </h3>
                <p className="text-slate-400">
                  Création du client et de la facture
                </p>
              </div>
            ) : conversionResult?.success ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Lead converti avec succès !
                </h3>
                <p className="text-slate-400 mb-6">
                  {conversionResult.isNewClient
                    ? 'Un nouveau client a été créé'
                    : 'Client existant associé'}
                </p>

                <div className="bg-white/5 rounded-xl p-4 mb-6 text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="text-white font-medium">{conversionResult.invoiceNumber}</p>
                      <p className="text-sm text-slate-400">Facture brouillon créée</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConversionModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => {
                      setShowConversionModal(false);
                      router.push(`/org/${orgId}/erp/invoices/${conversionResult.invoiceId}`);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#00B4D8] text-white font-semibold hover:bg-[#00a3c4] transition-all shadow-lg shadow-[#00B4D8]/20 flex items-center justify-center gap-2"
                  >
                    <FileText size={16} />
                    Voir la facture
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Erreur de conversion
                </h3>
                <p className="text-slate-400 mb-6">
                  {conversionResult?.message || 'Une erreur est survenue'}
                </p>
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
