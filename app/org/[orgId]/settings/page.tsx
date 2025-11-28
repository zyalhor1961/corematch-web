'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Settings, Building2, Users, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  CompanyProfileCard,
  UserManagementCard,
  InviteUserModal,
  AIRulesCard,
  RuleEditorModal,
  type CompanyProfile,
  type OrganizationMember,
  type AIRule,
} from '@/components/erp';

type SettingsTab = 'company' | 'team' | 'ai-rules';

export default function SettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Company Profile State
  const [company, setCompany] = useState<CompanyProfile | null>(null);

  // Team State
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // AI Rules State
  const [aiRules, setAiRules] = useState<AIRule[]>([]);
  const [editingRule, setEditingRule] = useState<AIRule | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Load organization/company data
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgData) {
        setCompany({
          id: orgData.id,
          name: orgData.name,
          legal_name: orgData.legal_name,
          siret: orgData.siret,
          vat_number: orgData.vat_number,
          address: orgData.address,
          city: orgData.city,
          postal_code: orgData.postal_code,
          country: orgData.country,
          phone: orgData.phone,
          email: orgData.email,
          website: orgData.website,
          logo_url: orgData.logo_url,
          fiscal_year_start: orgData.fiscal_year_start || '01-01',
          default_currency: orgData.default_currency || 'EUR',
          accounting_mode: orgData.accounting_mode || 'standard',
        });
      }

      // Load team members
      const { data: membersData } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          status,
          invited_at,
          joined_at,
          users:user_id (
            email,
            raw_user_meta_data
          )
        `)
        .eq('organization_id', orgId);

      if (membersData) {
        setMembers(membersData.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          email: m.users?.email || '',
          full_name: m.users?.raw_user_meta_data?.full_name,
          avatar_url: m.users?.raw_user_meta_data?.avatar_url,
          role: m.role,
          status: m.status || 'active',
          invited_at: m.invited_at,
          joined_at: m.joined_at,
        })));
      }

      // Load AI rules (mock for now - would need erp_ai_rules table)
      setAiRules([
        {
          id: '1',
          name: 'Amazon → Fournitures bureau',
          description: 'Transactions Amazon affectées au compte 606400',
          type: 'account_suggestion',
          trigger: { field: 'counterparty_name', operator: 'contains', value: 'amazon' },
          action: { type: 'set_account', value: '606400' },
          priority: 1,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          match_count: 23,
        },
        {
          id: '2',
          name: 'EDF/Engie → Électricité',
          description: 'Factures énergétiques',
          type: 'account_suggestion',
          trigger: { field: 'counterparty_name', operator: 'regex', value: '(edf|engie|électricité)' },
          action: { type: 'set_account', value: '606100' },
          priority: 2,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          match_count: 12,
        },
      ]);

    } catch (error) {
      console.error('Error loading settings data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Company handlers
  const handleSaveCompany = async (updates: Partial<CompanyProfile>) => {
    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId);

    if (error) throw error;
    setCompany(prev => prev ? { ...prev, ...updates } : null);
  };

  // Team handlers
  const handleInviteUser = async (email: string, role: OrganizationMember['role']) => {
    // In a real app, this would send an invitation email
    const { data, error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        email: email,
        role: role,
        status: 'invited',
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    setMembers(prev => [...prev, {
      id: data.id,
      user_id: '',
      email: email,
      role: role,
      status: 'invited',
      invited_at: data.invited_at,
    }]);
  };

  const handleUpdateRole = async (memberId: string, role: OrganizationMember['role']) => {
    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId);

    if (error) throw error;
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleResendInvite = async (memberId: string) => {
    // In a real app, this would resend the invitation email
    console.log('Resending invite to member:', memberId);
  };

  // AI Rules handlers
  const handleSaveRule = async (rule: Partial<AIRule>) => {
    if (rule.id) {
      // Update existing
      setAiRules(prev => prev.map(r => r.id === rule.id ? { ...r, ...rule, updated_at: new Date().toISOString() } as AIRule : r));
    } else {
      // Create new
      const newRule: AIRule = {
        ...rule,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        match_count: 0,
      } as AIRule;
      setAiRules(prev => [...prev, newRule]);
    }
    setShowRuleEditor(false);
    setEditingRule(null);
  };

  const handleDeleteRule = async (ruleId: string) => {
    setAiRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    setAiRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: isActive } : r));
  };

  const handleReorderRules = async (ruleIds: string[]) => {
    setAiRules(prev => {
      const reordered = ruleIds.map((id, idx) => {
        const rule = prev.find(r => r.id === id);
        return rule ? { ...rule, priority: idx + 1 } : null;
      }).filter(Boolean) as AIRule[];
      return reordered;
    });
  };

  const tabs = [
    { id: 'company' as const, label: 'Entreprise', icon: Building2 },
    { id: 'team' as const, label: 'Équipe', icon: Users },
    { id: 'ai-rules' as const, label: 'Règles IA', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
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
                  <Settings size={24} className="text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Paramètres</h1>
                  <p className="text-sm text-slate-400">Configuration de votre organisation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'company' && company && (
          <CompanyProfileCard
            company={company}
            onSave={handleSaveCompany}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'team' && (
          <>
            <UserManagementCard
              members={members}
              currentUserId={currentUserId}
              onInvite={() => setShowInviteModal(true)}
              onUpdateRole={handleUpdateRole}
              onRemove={handleRemoveMember}
              onResendInvite={handleResendInvite}
              isLoading={isLoading}
            />
            <InviteUserModal
              isOpen={showInviteModal}
              onClose={() => setShowInviteModal(false)}
              onInvite={handleInviteUser}
              existingEmails={members.map(m => m.email)}
            />
          </>
        )}

        {activeTab === 'ai-rules' && (
          <>
            <AIRulesCard
              rules={aiRules}
              onAdd={() => {
                setEditingRule(null);
                setShowRuleEditor(true);
              }}
              onEdit={(rule) => {
                setEditingRule(rule);
                setShowRuleEditor(true);
              }}
              onDelete={handleDeleteRule}
              onToggle={handleToggleRule}
              onReorder={handleReorderRules}
              isLoading={isLoading}
            />
            <RuleEditorModal
              isOpen={showRuleEditor}
              onClose={() => {
                setShowRuleEditor(false);
                setEditingRule(null);
              }}
              onSave={handleSaveRule}
              rule={editingRule}
            />
          </>
        )}
      </div>
    </div>
  );
}
