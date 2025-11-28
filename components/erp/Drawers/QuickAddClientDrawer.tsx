'use client';

import React, { useState } from 'react';
import { BaseDrawer } from './BaseDrawer';
import { UserPlus, Building2, Mail, Phone, MapPin, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface QuickAddClientDrawerProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess?: (client: any) => void;
}

export function QuickAddClientDrawer({ open, onClose, orgId, onSuccess }: QuickAddClientDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    vat_number: '',
    siret: '',
    billing_address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'FR',
    },
  });

  const handleChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '');
      setForm(prev => ({
        ...prev,
        billing_address: { ...prev.billing_address, [addressField]: value }
      }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('erp_clients')
        .insert({
          org_id: orgId,
          name: form.name,
          company_name: form.company_name || null,
          email: form.email || null,
          phone: form.phone || null,
          vat_number: form.vat_number || null,
          siret: form.siret || null,
          billing_address: form.billing_address,
        })
        .select()
        .single();

      if (error) throw error;

      onSuccess?.(data);
      onClose();
      // Reset form
      setForm({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        vat_number: '',
        siret: '',
        billing_address: { street: '', city: '', postal_code: '', country: 'FR' },
      });
    } catch (error: any) {
      console.error('Error creating client:', error);
      alert('Erreur lors de la création: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title="Nouveau Client"
      subtitle="Ajout rapide d'un client"
      icon={<UserPlus size={20} />}
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name.trim()}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Créer
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={14} />
            Informations
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Nom du contact *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Jean Dupont"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  SIRET
                </label>
                <input
                  type="text"
                  value={form.siret}
                  onChange={(e) => handleChange('siret', e.target.value)}
                  placeholder="123 456 789 00012"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  N° TVA
                </label>
                <input
                  type="text"
                  value={form.vat_number}
                  onChange={(e) => handleChange('vat_number', e.target.value)}
                  placeholder="FR12345678901"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Mail size={14} />
            Contact
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@example.com"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+33 1 23 45 67 89"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <MapPin size={14} />
            Adresse
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Rue
              </label>
              <input
                type="text"
                value={form.billing_address.street}
                onChange={(e) => handleChange('address.street', e.target.value)}
                placeholder="123 Rue Example"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Code postal
                </label>
                <input
                  type="text"
                  value={form.billing_address.postal_code}
                  onChange={(e) => handleChange('address.postal_code', e.target.value)}
                  placeholder="75001"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Ville
                </label>
                <input
                  type="text"
                  value={form.billing_address.city}
                  onChange={(e) => handleChange('address.city', e.target.value)}
                  placeholder="Paris"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </BaseDrawer>
  );
}

export default QuickAddClientDrawer;
