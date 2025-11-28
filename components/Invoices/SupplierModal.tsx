'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Building2, Save, Loader2, MapPin, Hash, Banknote, Crosshair, Search, Link as LinkIcon } from 'lucide-react';
import { createPortal } from 'react-dom';

interface SupplierData {
  id?: string;
  code?: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  vat_number?: string;
  vat_code?: string;
  siren?: string;
  siret?: string;
  iban?: string;
  bic?: string;
  banque?: string;
  notes?: string;
}

const VAT_CODES = [
  { value: 'france', label: 'France' },
  { value: 'exonere_france', label: 'Exonéré France' },
  { value: 'intracommunautaire', label: 'Intracommunautaire' },
  { value: 'import', label: 'Import' },
];

const COUNTRIES = [
  { value: 'FR', label: 'France' },
  { value: 'BE', label: 'Belgique' },
  { value: 'CH', label: 'Suisse' },
  { value: 'DE', label: 'Allemagne' },
  { value: 'ES', label: 'Espagne' },
  { value: 'IT', label: 'Italie' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'NL', label: 'Pays-Bas' },
  { value: 'PT', label: 'Portugal' },
  { value: 'GB', label: 'Royaume-Uni' },
  { value: 'US', label: 'États-Unis' },
  { value: 'OTHER', label: 'Autre' },
];

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SupplierData) => Promise<void>;
  initialData: SupplierData;
  mode: 'create' | 'view';
  title?: string;
  /** Callback to request PDF word selection mode */
  onRequestSelection?: (fieldKey: string) => void;
  /** Currently selected field waiting for PDF selection */
  activeSelectionField?: string | null;
  /** Value selected from PDF */
  selectedValue?: string | null;
  /** Clear the selected value after applying */
  onClearSelection?: () => void;
  /** Check if supplier already exists (by code, name, SIRET) */
  onCheckSupplierExists?: (
    supplierData: { code?: string; name?: string; siret?: string },
    excludeId?: string
  ) => Promise<{ exists: boolean; match_type?: string; supplier?: any }>;
  /** Search for existing suppliers */
  onSearchSuppliers?: (query: string) => Promise<any[]>;
  /** Link an existing supplier instead of creating new */
  onLinkExistingSupplier?: (supplierId: string) => Promise<void>;
}

export default function SupplierModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
  title,
  onRequestSelection,
  activeSelectionField,
  selectedValue,
  onClearSelection,
  onCheckSupplierExists,
  onSearchSuppliers,
  onLinkExistingSupplier
}: SupplierModalProps) {
  const [formData, setFormData] = useState<SupplierData>(initialData);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [duplicateError, setDuplicateError] = useState<{ message: string; supplier?: any } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [linking, setLinking] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      console.log('[SupplierModal] Setting form data:', initialData);
      setFormData(initialData);
      setDuplicateError(null);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [isOpen, initialData]);

  // Handle search with debounce
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (onSearchSuppliers) {
        setIsSearching(true);
        try {
          const results = await onSearchSuppliers(query.trim());
          setSearchResults(results);
          setShowSearchResults(true);
        } catch (err) {
          console.error('Search error:', err);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);
  }, [onSearchSuppliers]);

  // Handle linking existing supplier
  const handleLinkSupplier = useCallback(async (supplier: any) => {
    if (!onLinkExistingSupplier) return;

    setLinking(true);
    try {
      await onLinkExistingSupplier(supplier.id);
      onClose();
    } catch (err) {
      console.error('Error linking supplier:', err);
    } finally {
      setLinking(false);
    }
  }, [onLinkExistingSupplier, onClose]);

  // Apply selected value from PDF to the active field
  useEffect(() => {
    if (activeSelectionField && selectedValue) {
      setFormData(prev => ({ ...prev, [activeSelectionField]: selectedValue }));
      onClearSelection?.();
    }
  }, [activeSelectionField, selectedValue, onClearSelection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateError(null);

    // Validate required fields
    if (!formData.code?.trim()) {
      setDuplicateError({ message: 'Le code fournisseur est obligatoire' });
      return;
    }

    if (!formData.name.trim()) {
      return;
    }

    // Check for duplicate supplier (by code, name, SIRET)
    if (onCheckSupplierExists) {
      const result = await onCheckSupplierExists(
        {
          code: formData.code,
          name: formData.name,
          siret: formData.siret
        },
        formData.id
      );

      if (result.exists) {
        // Generate appropriate error message based on match type
        let message = 'Un fournisseur similaire existe déjà';
        switch (result.match_type) {
          case 'siret':
            message = `Un fournisseur avec ce SIRET existe déjà: ${result.supplier?.name} (${result.supplier?.code})`;
            break;
          case 'code':
            message = `Ce code fournisseur existe déjà: ${result.supplier?.name}`;
            break;
          case 'name':
            message = `Un fournisseur avec ce nom existe déjà: ${result.supplier?.code}`;
            break;
        }
        setDuplicateError({ message, supplier: result.supplier });
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      setDuplicateError({ message: err.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SupplierData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear duplicate error when user modifies any identifying field
    if (['code', 'name', 'siret'].includes(field) && duplicateError) {
      setDuplicateError(null);
    }
  };

  // Handle click on the PDF picker button
  const handlePickFromPdf = useCallback((fieldKey: keyof SupplierData) => {
    if (onRequestSelection) {
      onRequestSelection(fieldKey);
    }
  }, [onRequestSelection]);

  // Render input with optional PDF picker button
  const renderInput = (
    fieldKey: keyof SupplierData,
    label: string,
    placeholder: string,
    options?: {
      type?: string;
      maxLength?: number;
      className?: string;
      required?: boolean;
      transform?: (value: string) => string;
      error?: string | null;
    }
  ) => {
    const isActive = activeSelectionField === fieldKey;
    const canPickFromPdf = !!onRequestSelection;
    const hasError = !!options?.error;

    return (
      <div className="relative">
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <div className="relative">
          <input
            type={options?.type || 'text'}
            value={formData[fieldKey] as string || ''}
            onChange={(e) => {
              const value = options?.transform ? options.transform(e.target.value) : e.target.value;
              updateField(fieldKey, value);
            }}
            className={`w-full px-3 py-2 bg-slate-800/50 border rounded-lg text-white text-sm focus:outline-none transition-colors ${
              hasError
                ? 'border-red-500 ring-1 ring-red-500/30'
                : isActive
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-white/10 focus:border-teal-500/50'
            } ${options?.className || ''} ${canPickFromPdf ? 'pr-10' : ''}`}
            placeholder={placeholder}
            maxLength={options?.maxLength}
            required={options?.required}
          />
          {canPickFromPdf && (
            <button
              type="button"
              onClick={() => handlePickFromPdf(fieldKey)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                isActive
                  ? 'text-blue-400 bg-blue-500/20'
                  : 'text-slate-500 hover:text-teal-400 hover:bg-teal-500/10'
              }`}
              title="Sélectionner depuis le PDF"
            >
              <Crosshair size={16} />
            </button>
          )}
        </div>
        {hasError && (
          <p className="text-xs text-red-400 mt-1">
            {options.error}
          </p>
        )}
        {isActive && !hasError && (
          <p className="text-xs text-blue-400 mt-1 animate-pulse">
            Cliquez sur un mot dans le PDF...
          </p>
        )}
      </div>
    );
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex justify-end pointer-events-none font-sans">
      {/* Slide-out Panel from Right - doesn't cover the full screen */}
      <div
        className={`relative w-[420px] h-full bg-[#0B1121] shadow-2xl border-l border-white/10 flex flex-col pointer-events-auto transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">
              {title || (mode === 'create' ? 'Créer Fiche Fournisseur' : 'Fiche Fournisseur')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search Existing Supplier */}
          {mode === 'create' && onSearchSuppliers && onLinkExistingSupplier && (
            <div className="relative">
              <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-2">
                  <Search size={12} />
                  Rechercher un fournisseur existant
                </h4>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                    className="w-full px-3 py-2 pl-9 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50 placeholder-slate-500"
                    placeholder="Tapez un nom, code, SIREN ou SIRET..."
                  />
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  {isSearching && (
                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 animate-spin" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 mx-4 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                    {searchResults.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => handleLinkSupplier(supplier)}
                        disabled={linking}
                        className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors border-b border-white/5 last:border-b-0 flex items-center justify-between group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
                              {supplier.code || '—'}
                            </span>
                            <span className="text-sm text-white font-medium">
                              {supplier.name}
                            </span>
                          </div>
                          {supplier.siret && (
                            <p className="text-xs text-slate-500 mt-1 font-mono">
                              SIRET: {supplier.siret}
                            </p>
                          )}
                        </div>
                        <LinkIcon size={14} className="text-slate-500 group-hover:text-teal-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}

                {showSearchResults && searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
                  <p className="text-xs text-slate-500 mt-2 text-center py-2">
                    Aucun fournisseur trouvé pour "{searchQuery}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-slate-500 uppercase">ou créer nouveau</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {duplicateError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400 font-medium">
                {duplicateError.message}
              </p>
              {duplicateError.supplier && (
                <button
                  type="button"
                  onClick={() => handleLinkSupplier(duplicateError.supplier)}
                  disabled={linking}
                  className="mt-2 text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                >
                  <LinkIcon size={12} />
                  Utiliser le fournisseur existant
                </button>
              )}
            </div>
          )}

          {/* Info Banner */}
          {mode === 'create' && !duplicateError && (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
              <p className="text-xs text-teal-400">
                Vérifiez les informations extraites de la facture et complétez si nécessaire.
              </p>
            </div>
          )}

          {/* General Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Building2 size={14} />
              Informations générales
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  {renderInput('code', 'Code *', 'F001', {
                    maxLength: 10,
                    className: 'font-mono',
                    transform: (v) => v.toUpperCase(),
                    required: true
                  })}
                </div>
                <div className="col-span-2">
                  {renderInput('name', 'Nom du fournisseur *', 'Nom du fournisseur', { required: true })}
                </div>
              </div>

              {renderInput('company_name', 'Raison sociale', 'Raison sociale')}

              <div className="grid grid-cols-2 gap-3">
                {renderInput('email', 'Email', 'email@exemple.com', { type: 'email' })}
                {renderInput('phone', 'Téléphone', '+33 1 23 45 67 89', { type: 'tel' })}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <MapPin size={14} />
              Adresse
            </h3>

            <div className="space-y-3">
              {renderInput('address', 'Adresse', '123 rue du Commerce')}

              <div className="grid grid-cols-2 gap-3">
                {renderInput('postal_code', 'Code postal', '75001')}
                {renderInput('city', 'Ville', 'Paris')}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Pays</label>
                <select
                  value={formData.country || 'FR'}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.value} value={country.value} className="bg-slate-800">
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Legal Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Hash size={14} />
              Informations légales
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {renderInput('siren', 'SIREN', '123456789', { maxLength: 9, className: 'font-mono', transform: (v) => v.replace(/\D/g, '').slice(0, 9) })}
                {renderInput('siret', 'SIRET', '12345678901234', { maxLength: 14, className: 'font-mono', transform: (v) => v.replace(/\D/g, '').slice(0, 14) })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {renderInput('vat_number', 'N° TVA', 'FR12345678901', { className: 'font-mono' })}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Code TVA</label>
                  <select
                    value={formData.vat_code || 'france'}
                    onChange={(e) => updateField('vat_code', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                  >
                    {VAT_CODES.map((code) => (
                      <option key={code.value} value={code.value} className="bg-slate-800">
                        {code.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Banknote size={14} />
              Coordonnées bancaires
            </h3>

            <div className="space-y-3">
              {renderInput('iban', 'IBAN', 'FR7630004000031234567890143', { className: 'font-mono', transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '') })}

              <div className="grid grid-cols-2 gap-3">
                {renderInput('bic', 'BIC/SWIFT', 'BNPAFRPP', { maxLength: 11, className: 'font-mono', transform: (v) => v.toUpperCase() })}
                {renderInput('banque', 'Banque', 'BNP Paribas')}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50 resize-none"
              placeholder="Notes sur le fournisseur..."
              rows={3}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.name.trim() || !formData.code?.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} />
                {mode === 'create' ? 'Créer le fournisseur' : 'Enregistrer'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
