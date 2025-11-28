'use client';

import React, { useState } from 'react';
import { BaseDrawer } from './BaseDrawer';
import { Truck, Building2, Mail, Phone, MapPin, Save, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface QuickAddSupplierDrawerProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess?: (supplier: any) => void;
  initialData?: {
    name?: string;
    email?: string;
    vat_number?: string;
    siret?: string;
  };
}

export function QuickAddSupplierDrawer({ open, onClose, orgId, onSuccess, initialData }: QuickAddSupplierDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || '',
    code: '',
    email: initialData?.email || '',
    phone: '',
    website: '',
    vat_number: initialData?.vat_number || '',
    siret: initialData?.siret || '',
    address: {
      street: '',
      city: '',
      postal_code: '',
      country: 'FR',
    },
    bank_details: {
      iban: '',
      bic: '',
      account_name: '',
    },
  });

  // Generate supplier code
  const generateCode = (name: string) => {
    if (!name) return '';
    const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `F${prefix}${random}`;
  };

  const handleChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '');
      setForm(prev => ({
        ...prev,
        address: { ...prev.address, [addressField]: value }
      }));
    } else if (field.startsWith('bank.')) {
      const bankField = field.replace('bank.', '');
      setForm(prev => ({
        ...prev,
        bank_details: { ...prev.bank_details, [bankField]: value }
      }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
      // Auto-generate code when name changes
      if (field === 'name' && !form.code) {
        setForm(prev => ({ ...prev, code: generateCode(value) }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setLoading(true);
    try {
      const supplierCode = form.code || generateCode(form.name);

      const { data, error } = await supabase
        .from('erp_suppliers')
        .insert({
          org_id: orgId,
          name: form.name,
          code: supplierCode,
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          vat_number: form.vat_number || null,
          siret: form.siret || null,
          address: form.address,
          bank_details: form.bank_details.iban ? form.bank_details : null,
        })
        .select()
        .single();

      if (error) throw error;

      onSuccess?.(data);
      onClose();
      // Reset form
      setForm({
        name: '',
        code: '',
        email: '',
        phone: '',
        website: '',
        vat_number: '',
        siret: '',
        address: { street: '', city: '', postal_code: '', country: 'FR' },
        bank_details: { iban: '', bic: '', account_name: '' },
      });
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      alert('Erreur lors de la création: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Update form when initialData changes
  React.useEffect(() => {
    if (initialData) {
      setForm(prev => ({
        ...prev,
        name: initialData.name || prev.name,
        email: initialData.email || prev.email,
        vat_number: initialData.vat_number || prev.vat_number,
        siret: initialData.siret || prev.siret,
        code: initialData.name ? generateCode(initialData.name) : prev.code,
      }));
    }
  }, [initialData]);

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title="Nouveau Fournisseur"
      subtitle="Ajout rapide d'un fournisseur"
      icon={<Truck size={20} />}
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
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nom du fournisseur *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Fournisseur XYZ"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Code
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="FXYZ001"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono"
                />
              </div>
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
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono"
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
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono"
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

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contact@supplier.com"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
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
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Site web
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://www.supplier.com"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
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
                value={form.address.street}
                onChange={(e) => handleChange('address.street', e.target.value)}
                placeholder="123 Rue Example"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Code postal
                </label>
                <input
                  type="text"
                  value={form.address.postal_code}
                  onChange={(e) => handleChange('address.postal_code', e.target.value)}
                  placeholder="75001"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Ville
                </label>
                <input
                  type="text"
                  value={form.address.city}
                  onChange={(e) => handleChange('address.city', e.target.value)}
                  placeholder="Paris"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={14} />
            Coordonnées bancaires
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                IBAN
              </label>
              <input
                type="text"
                value={form.bank_details.iban}
                onChange={(e) => handleChange('bank.iban', e.target.value.toUpperCase())}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  BIC
                </label>
                <input
                  type="text"
                  value={form.bank_details.bic}
                  onChange={(e) => handleChange('bank.bic', e.target.value.toUpperCase())}
                  placeholder="BNPAFRPP"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Titulaire
                </label>
                <input
                  type="text"
                  value={form.bank_details.account_name}
                  onChange={(e) => handleChange('bank.account_name', e.target.value)}
                  placeholder="Nom du compte"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </BaseDrawer>
  );
}

export default QuickAddSupplierDrawer;
