'use client';

import React, { useState } from 'react';
import { Building2, MapPin, Phone, Mail, Globe, FileText, Edit2, Save, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CompanyProfile {
  id: string;
  name: string;
  legal_name?: string;
  siret?: string;
  vat_number?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  fiscal_year_start?: string; // MM-DD format
  default_currency?: string;
  accounting_mode?: 'simplified' | 'standard' | 'full';
}

interface CompanyProfileCardProps {
  company: CompanyProfile;
  onSave: (company: Partial<CompanyProfile>) => Promise<void>;
  isLoading?: boolean;
}

export function CompanyProfileCard({ company, onSave, isLoading }: CompanyProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCompany, setEditedCompany] = useState<Partial<CompanyProfile>>(company);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editedCompany);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving company profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCompany(company);
    setIsEditing(false);
  };

  const updateField = (field: keyof CompanyProfile, value: string) => {
    setEditedCompany(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="relative">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 size={28} className="text-cyan-400" />
              )}
            </div>
            {isEditing && (
              <button className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-cyan-500 text-white shadow-lg">
                <Upload size={12} />
              </button>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{company.name}</h3>
            {company.legal_name && company.legal_name !== company.name && (
              <p className="text-sm text-slate-400">{company.legal_name}</p>
            )}
          </div>
        </div>

        {/* Edit Toggle */}
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Edit2 size={16} />
            Modifier
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Legal Information */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <FileText size={14} />
            Informations légales
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">SIRET</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCompany.siret || ''}
                  onChange={(e) => updateField('siret', e.target.value)}
                  placeholder="123 456 789 00012"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              ) : (
                <p className="text-white font-mono">{company.siret || '—'}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">N° TVA Intracommunautaire</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCompany.vat_number || ''}
                  onChange={(e) => updateField('vat_number', e.target.value)}
                  placeholder="FR12345678901"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              ) : (
                <p className="text-white font-mono">{company.vat_number || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <Mail size={14} />
            Coordonnées
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedCompany.email || ''}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="contact@entreprise.fr"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                ) : (
                  <p className="text-white">{company.email || '—'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Téléphone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedCompany.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+33 1 23 45 67 89"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                ) : (
                  <p className="text-white">{company.phone || '—'}</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Site web</label>
              {isEditing ? (
                <input
                  type="url"
                  value={editedCompany.website || ''}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://www.entreprise.fr"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              ) : (
                <p className="text-white">{company.website || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <MapPin size={14} />
            Adresse
          </h4>
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Adresse</label>
                <input
                  type="text"
                  value={editedCompany.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 rue de la Paix"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Code postal</label>
                  <input
                    type="text"
                    value={editedCompany.postal_code || ''}
                    onChange={(e) => updateField('postal_code', e.target.value)}
                    placeholder="75001"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Ville</label>
                  <input
                    type="text"
                    value={editedCompany.city || ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="Paris"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Pays</label>
                  <input
                    type="text"
                    value={editedCompany.country || ''}
                    onChange={(e) => updateField('country', e.target.value)}
                    placeholder="France"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-white">
              {company.address ? (
                <>
                  <p>{company.address}</p>
                  <p>{company.postal_code} {company.city}</p>
                  {company.country && <p>{company.country}</p>}
                </>
              ) : (
                <p className="text-slate-500">Aucune adresse renseignée</p>
              )}
            </div>
          )}
        </div>

        {/* Accounting Settings */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <FileText size={14} />
            Paramètres comptables
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Début exercice</label>
              {isEditing ? (
                <select
                  value={editedCompany.fiscal_year_start || '01-01'}
                  onChange={(e) => updateField('fiscal_year_start', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="01-01">1er Janvier</option>
                  <option value="04-01">1er Avril</option>
                  <option value="07-01">1er Juillet</option>
                  <option value="10-01">1er Octobre</option>
                </select>
              ) : (
                <p className="text-white">
                  {company.fiscal_year_start === '01-01' ? '1er Janvier' :
                   company.fiscal_year_start === '04-01' ? '1er Avril' :
                   company.fiscal_year_start === '07-01' ? '1er Juillet' :
                   company.fiscal_year_start === '10-01' ? '1er Octobre' : '1er Janvier'}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Devise</label>
              {isEditing ? (
                <select
                  value={editedCompany.default_currency || 'EUR'}
                  onChange={(e) => updateField('default_currency', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CHF">CHF (Fr.)</option>
                </select>
              ) : (
                <p className="text-white">{company.default_currency || 'EUR'}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Mode comptable</label>
              {isEditing ? (
                <select
                  value={editedCompany.accounting_mode || 'standard'}
                  onChange={(e) => updateField('accounting_mode', e.target.value as CompanyProfile['accounting_mode'])}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="simplified">Simplifié</option>
                  <option value="standard">Standard</option>
                  <option value="full">Complet</option>
                </select>
              ) : (
                <p className="text-white capitalize">{company.accounting_mode || 'Standard'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyProfileCard;
