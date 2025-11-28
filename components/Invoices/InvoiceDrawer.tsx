'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { X, CheckCircle, FileText, Download, ExternalLink, MessageSquare, Edit3, Play, Loader2, Maximize2, Trash2, Pencil, Building2, Plus, Link as LinkIcon, Eye, Calendar, Hash, User, Receipt, CreditCard } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SupplierModal from './SupplierModal';
import { AgentTimeline } from '@/components/ui/AgentTimeline';
import { useInvoiceAgent } from '@/hooks/useInvoiceAgent';
import { supabase } from '@/lib/supabase/client';
import { createPortal } from 'react-dom';
import { PdfViewerWithHighlights } from './PdfViewerWithHighlights';
import AccountingValidator from '../Invoice/AccountingValidator';
import { ChunkInspector } from '../Invoice/ChunkInspector';
import { InteractiveOverlay } from '../Invoice/InteractiveOverlay';
import { FieldCard, FieldCardGroup } from '../Invoice/FieldCard';

interface InvoiceDrawerProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// --- Composant pour les champs intelligents ---
interface SmartFieldProps {
  label: string;
  fieldKey: string;
  data: any;
  onFocus?: () => void;
  onEdit?: (fieldKey: string) => void;
  isEditable?: boolean;
}

const SmartField = ({ label, fieldKey, data, onFocus, onEdit, isEditable = false }: SmartFieldProps) => {
  if (data === null || data === undefined) return null;

  // Handle both object format { value, confidence, ... } and primitive values
  const isObject = typeof data === 'object' && data !== null;
  let displayValue = isObject ? data.value : data;

  // Format currency objects (check for 'amount' key, not truthiness since amount can be 0)
  if (typeof displayValue === 'object' && displayValue !== null && 'amount' in displayValue) {
    const amount = displayValue.amount ?? 0;
    const symbol = displayValue.symbol || displayValue.code || '€';
    displayValue = `${amount} ${symbol}`;
  }
  // Handle any remaining objects by converting to string
  if (typeof displayValue === 'object' && displayValue !== null) {
    displayValue = JSON.stringify(displayValue);
  }
  // Format numbers (including string numbers for monetary fields)
  if (typeof displayValue === 'number') {
    displayValue = displayValue.toFixed(2) + ' €';
  }
  // Handle string numbers for monetary fields (total_amount, net_amount, tax_amount)
  const monetaryFields = ['total_amount', 'net_amount', 'tax_amount'];
  if (typeof displayValue === 'string' && monetaryFields.includes(fieldKey)) {
    const num = parseFloat(displayValue);
    if (!isNaN(num)) {
      displayValue = num.toFixed(2) + ' €';
    }
  }
  // Ensure displayValue is always a string or number for React rendering
  if (displayValue === null || displayValue === undefined) {
    displayValue = '-';
  }

  // Couleur de confiance (only for object data with confidence)
  const confidence = isObject ? data.confidence : null;
  const confidenceColor = confidence && confidence > 0.8 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="group relative flex justify-between items-center py-2 border-b border-white/5">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs uppercase tracking-wider">{label}</span>
        {onFocus && (
          <button
            onClick={(e) => { e.stopPropagation(); onFocus(); }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-all"
            title="Show on Invoice"
          >
            <Maximize2 size={10} />
          </button>
        )}
        {/* Edit button for Human-in-the-Loop correction */}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(fieldKey); }}
            className={`p-1 rounded transition-all ${
              isEditable
                ? 'hover:bg-blue-500/20 text-blue-400 hover:text-blue-300'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title={isEditable ? "Click to correct this field by selecting words on the PDF" : "OCR data not available for correction"}
            disabled={!isEditable}
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
      <span className="font-mono text-white font-medium cursor-help border-b border-dotted border-slate-600">
        {displayValue}
      </span>

      {/* LE POP-UP (TOOLTIP) - Only show for object data with confidence */}
      {isObject && confidence !== null && (
        <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-white/10 rounded-lg p-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Preuve IA</div>
          <div className="text-xs text-white bg-white/5 p-1 rounded mb-2 font-mono break-words">
            "{typeof data.content === 'object' ? JSON.stringify(data.content) : (data.content || displayValue)}"
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Confiance :</span>
            <span className={`font-bold ${confidenceColor}`}>
              {typeof confidence === 'number' && !isNaN(confidence) ? `${(confidence * 100).toFixed(0)}%` : 'N/A'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function InvoiceDrawer({ invoiceId, isOpen, onClose }: InvoiceDrawerProps) {
  const params = useParams();
  const orgId = params.orgId as string;
  const [isValidating, setIsValidating] = useState(false);
  const [isAccountingOpen, setIsAccountingOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState<'create' | 'view'>('create');
  const [existingSupplier, setExistingSupplier] = useState<any>(null);

  // Human-in-the-Loop correction state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [targetField, setTargetField] = useState<string | null>(null);

  // Supplier modal selection state (click-to-fill from PDF)
  const [supplierSelectionField, setSupplierSelectionField] = useState<string | null>(null);
  const [supplierSelectedValue, setSupplierSelectedValue] = useState<string | null>(null);

  // 1. GET THE ANALYZE FUNCTION
  // Ensure we get 'analyzeInvoice' from the hook
  const { steps, status, analyzeInvoice } = useInvoiceAgent(invoiceId || '');
  const [extractionData, setExtractionData] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);

  // Use Portal to escape stacking contexts
  const [mounted, setMounted] = useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If Accounting Modal is open, ignore clicks (let the modal handle them)
      if (isAccountingOpen) return;

      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose, isAccountingOpen]);

  // Fetch extraction data when invoiceId changes
  useEffect(() => {
    const fetchDetails = async () => {
      if (!invoiceId) return;
      const { data } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (data) {
        setInvoice(data);
        setExtractionData(data.extraction_data);
        // Debug logging for extraction_data._metadata
        console.log('[InvoiceDrawer] Invoice data:', data);
        console.log('[InvoiceDrawer] extraction_data exists:', !!data.extraction_data);
        if (data.extraction_data?._metadata?.pages?.[0]) {
          const page = data.extraction_data._metadata.pages[0];
          console.log('[InvoiceDrawer] Page 1 metadata:', {
            width: page.width,
            height: page.height,
            unit: page.unit,
            wordsCount: page.words?.length || 0
          });
          if (page.words?.length > 0) {
            console.log('[InvoiceDrawer] First word sample:', page.words[0]);
          }
        }
      }
    };
    fetchDetails();
  }, [invoiceId, status]); // Re-fetch when status changes (e.g. after analysis)

  // Construct highlights from extraction data
  const highlights = useMemo(() => {
    if (!extractionData) return [];

    const list: any[] = [];

    // Helper to add highlight
    const addHighlight = (fieldKey: string, label: string, color: string) => {
      const field = extractionData[fieldKey];
      if (field && field.box && field.box.length > 0) {
        list.push({
          box: field.box,
          page: field.page || 1,
          label: label,
          color: color
        });
      }
    };

    addHighlight('vendor_name', 'Vendor', '#facc15'); // Yellow (keep for contrast)
    addHighlight('invoice_date', 'Date', '#00b4d8');   // Teal
    addHighlight('total_amount', 'Total', '#4ade80'); // Green (keep for money)

    console.log("DEBUG: Extraction Data:", extractionData);
    console.log("DEBUG: Generated Highlights:", list);

    return list;
  }, [extractionData]);

  // E. HUMAN-IN-THE-LOOP CORRECTION - Must be defined before early return (React hooks rules)
  // Activate selection mode for a specific field
  const handleStartCorrection = useCallback((fieldKey: string) => {
    console.log('[HITL] ============ STARTING CORRECTION ============');
    console.log('[HITL] Field:', fieldKey);
    console.log('[HITL] extractionData exists:', !!extractionData);
    console.log('[HITL] extractionData._metadata exists:', !!extractionData?._metadata);

    if (extractionData?._metadata) {
      const meta = extractionData._metadata;
      console.log('[HITL] _metadata keys:', Object.keys(meta));
      console.log('[HITL] _metadata.pages:', meta.pages ? `array[${meta.pages.length}]` : 'undefined');

      if (meta.pages?.[0]) {
        const page = meta.pages[0];
        console.log('[HITL] Page 1 keys:', Object.keys(page));
        console.log('[HITL] Page 1 dimensions:', page.width, 'x', page.height, page.unit);
        console.log('[HITL] Page 1 words count:', page.words?.length ?? 'undefined');
        if (page.words?.[0]) {
          console.log('[HITL] First word:', page.words[0].content, 'polygon:', page.words[0].polygon?.slice(0, 4));
        }
      }
    }
    console.log('[HITL] =========================================');

    setTargetField(fieldKey);
    setIsSelectionMode(true);
  }, [extractionData]);

  // Cancel selection mode
  const handleCancelCorrection = useCallback(() => {
    setIsSelectionMode(false);
    setTargetField(null);
    setSupplierSelectionField(null); // Also cancel supplier selection
  }, []);

  // Apply the correction from selected words
  const handleApplyCorrection = useCallback(async (fieldName: string, newValue: string) => {
    // Check if this is a supplier field selection
    if (fieldName.startsWith('supplier_')) {
      console.log('[InvoiceDrawer] Supplier field selection:', fieldName, newValue);
      setSupplierSelectedValue(newValue);
      setIsSelectionMode(false);
      setTargetField(null);
      return;
    }

    if (!invoiceId) return;

    // Map field names to invoice table columns
    const fieldToColumnMap: Record<string, string> = {
      'vendor_name': 'vendor_name',
      'invoice_number': 'invoice_number',
      'invoice_date': 'invoice_date',
      'due_date': 'due_date',
      'subtotal_ht': 'subtotal_ht',
      'total_tax': 'total_tax',
      'total_ttc': 'total_ttc',
      'reference': 'reference',
      'vendor_siren': 'vendor_siren',
    };

    // Build update object for main invoice columns
    const invoiceUpdate: Record<string, any> = {};
    const columnName = fieldToColumnMap[fieldName];
    if (columnName) {
      // For numeric fields, parse the value
      if (['subtotal_ht', 'total_tax', 'total_ttc'].includes(columnName)) {
        const numValue = parseFloat(newValue.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(numValue)) {
          invoiceUpdate[columnName] = numValue;
          // Also update total_amount for backward compatibility
          if (columnName === 'total_ttc') {
            invoiceUpdate['total_amount'] = numValue;
          }
        }
      } else {
        invoiceUpdate[columnName] = newValue;
      }
      // Also update client_name when vendor_name changes (for display in list)
      if (columnName === 'vendor_name') {
        invoiceUpdate['client_name'] = newValue;
      }
    }

    // Update extraction_data if available
    if (extractionData) {
      const updatedExtractionData = {
        ...extractionData,
        [fieldName]: {
          ...extractionData[fieldName],
          value: newValue,
          content: newValue,
          confidence: 1.0,
          corrected_by: 'human',
          corrected_at: new Date().toISOString()
        }
      };
      invoiceUpdate['extraction_data'] = updatedExtractionData;
    }

    try {
      const { error } = await supabase
        .from('invoices')
        .update(invoiceUpdate)
        .eq('id', invoiceId);

      if (error) {
        console.error('Failed to save correction:', error);
        alert('Erreur: ' + error.message);
      } else {
        // Update local state
        if (invoiceUpdate.extraction_data) {
          setExtractionData(invoiceUpdate.extraction_data);
        }
        // Update invoice local state
        setInvoice((prev: any) => ({ ...prev, ...invoiceUpdate }));
        console.log(`Field "${fieldName}" corrected to: "${newValue}"`);
      }
    } catch (err) {
      console.error('Error saving correction:', err);
    }

    // Exit selection mode
    setIsSelectionMode(false);
    setTargetField(null);
  }, [invoiceId, extractionData]);

  // Open supplier modal for creation with pre-filled data
  const handleOpenCreateSupplier = useCallback(() => {
    setSupplierModalMode('create');
    setExistingSupplier(null);
    setSupplierModalOpen(true);
  }, []);

  // Open supplier modal to view/edit existing supplier
  const handleOpenViewSupplier = useCallback(async () => {
    if (!invoice?.supplier_id) return;

    try {
      // Fetch existing supplier data
      const { data: supplier, error } = await supabase
        .from('erp_suppliers')
        .select('*')
        .eq('id', invoice.supplier_id)
        .single();

      if (error) throw error;

      setExistingSupplier(supplier);
      setSupplierModalMode('view');
      setSupplierModalOpen(true);
    } catch (err) {
      console.error('Error fetching supplier:', err);
    }
  }, [invoice?.supplier_id]);

  // Save supplier (create or update)
  const handleSaveSupplier = useCallback(async (supplierData: any) => {
    if (!invoiceId) return;

    const effectiveOrgId = orgId || invoice?.org_id;
    if (!effectiveOrgId) {
      throw new Error('Organisation non trouvée');
    }

    if (supplierModalMode === 'create') {
      // Create new supplier
      const res = await fetch('/api/erp/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...supplierData, org_id: effectiveOrgId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create supplier');
      }

      const { data: newSupplier } = await res.json();

      // Link to invoice
      const linkRes = await fetch(`/api/erp/invoices/${invoiceId}/link-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: newSupplier.id }),
      });

      if (!linkRes.ok) {
        const linkError = await linkRes.json();
        throw new Error(linkError.error || 'Failed to link supplier');
      }

      setInvoice((prev: any) => ({ ...prev, supplier_id: newSupplier.id }));
      console.log('Supplier created and linked:', newSupplier.id);
    } else {
      // Update existing supplier via API (bypasses RLS)
      const res = await fetch(`/api/erp/suppliers/${existingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update supplier');
      }

      console.log('Supplier updated:', existingSupplier.id);
    }
  }, [invoiceId, orgId, invoice, supplierModalMode, existingSupplier]);

  // Handle supplier field selection request (click-to-fill from PDF)
  const handleSupplierSelectionRequest = useCallback((fieldKey: string) => {
    console.log('[InvoiceDrawer] Supplier selection requested for field:', fieldKey);
    setSupplierSelectionField(fieldKey);
    setIsSelectionMode(true);
    setTargetField(`supplier_${fieldKey}`); // Prefix to distinguish from invoice fields
  }, []);

  // Handle selection correction from InteractiveOverlay
  const handleSelectionCorrect = useCallback((fieldName: string, newValue: string) => {
    console.log('[InvoiceDrawer] Selection correction:', fieldName, newValue);

    // Check if this is a supplier field selection
    if (fieldName.startsWith('supplier_')) {
      setSupplierSelectedValue(newValue);
      setIsSelectionMode(false);
      setTargetField(null);
    } else {
      // Handle regular invoice field correction (existing logic)
      // ... existing correction logic would go here
    }
  }, []);

  // Clear supplier selection after value is applied
  const handleClearSupplierSelection = useCallback(() => {
    setSupplierSelectionField(null);
    setSupplierSelectedValue(null);
  }, []);

  // Check if supplier already exists (by code, name, or SIRET)
  const handleCheckSupplierExists = useCallback(async (
    supplierData: { code?: string; name?: string; siret?: string },
    excludeId?: string
  ): Promise<{ exists: boolean; match_type?: string; supplier?: any }> => {
    const effectiveOrgId = orgId || invoice?.org_id;

    try {
      const response = await fetch('/api/erp/suppliers/check-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: supplierData.code?.trim(),
          name: supplierData.name?.trim(),
          siret: supplierData.siret?.trim(),
          exclude_id: excludeId,
          org_id: effectiveOrgId
        }),
      });

      if (!response.ok) {
        console.error('Error checking supplier exists:', response.statusText);
        return { exists: false };
      }

      const data = await response.json();
      console.log('[handleCheckSupplierExists] Result:', data);
      return {
        exists: data.exists === true,
        match_type: data.match_type,
        supplier: data.supplier
      };
    } catch (err) {
      console.error('Error in handleCheckSupplierExists:', err);
      return { exists: false };
    }
  }, [orgId, invoice?.org_id]);

  // Search for existing suppliers
  const handleSearchSuppliers = useCallback(async (query: string): Promise<any[]> => {
    const effectiveOrgId = orgId || invoice?.org_id;

    console.log('[handleSearchSuppliers] Query:', query, 'OrgId:', effectiveOrgId);

    try {
      const url = `/api/erp/suppliers/search?q=${encodeURIComponent(query)}&org_id=${effectiveOrgId}`;
      console.log('[handleSearchSuppliers] Fetching:', url);

      const response = await fetch(url);

      if (!response.ok) {
        console.error('Error searching suppliers:', response.statusText);
        return [];
      }

      const data = await response.json();
      console.log('[handleSearchSuppliers] Response:', data);
      return data.suppliers || [];
    } catch (err) {
      console.error('Error in handleSearchSuppliers:', err);
      return [];
    }
  }, [orgId, invoice?.org_id]);

  // Link an existing supplier to the invoice
  const handleLinkExistingSupplier = useCallback(async (supplierId: string): Promise<void> => {
    if (!invoiceId) return;

    try {
      const linkRes = await fetch(`/api/erp/invoices/${invoiceId}/link-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplierId }),
      });

      if (!linkRes.ok) {
        const linkError = await linkRes.json();
        throw new Error(linkError.error || 'Failed to link supplier');
      }

      setInvoice((prev: any) => ({ ...prev, supplier_id: supplierId }));
      console.log('Supplier linked:', supplierId);
    } catch (err) {
      console.error('Error linking supplier:', err);
      throw err;
    }
  }, [invoiceId]);

  // Cancel selection mode
  const handleSelectionCancel = useCallback(() => {
    setIsSelectionMode(false);
    setTargetField(null);
    setSupplierSelectionField(null);
  }, []);

  // Get initial data for supplier modal
  const supplierInitialData = useMemo(() => {
    if (supplierModalMode === 'view' && existingSupplier) {
      return existingSupplier;
    }

    // Helper to extract value from extraction data field (can be object or primitive)
    const getExtractedValue = (field: any): string => {
      if (!field) return '';
      if (typeof field === 'object' && field.value !== undefined) {
        return String(field.value || '');
      }
      return String(field || '');
    };

    // Helper to get content (raw text) from extraction field
    const getExtractedContent = (field: any): string => {
      if (!field) return '';
      if (typeof field === 'object' && field.content !== undefined) {
        return String(field.content || '');
      }
      return getExtractedValue(field);
    };

    // Pre-fill from invoice data - check multiple possible field locations
    const vendorName = getExtractedValue(invoice?.vendor_name || invoice?.client_name || extractionData?.VendorName);
    const vendorSiren = getExtractedValue(invoice?.vendor_siren || extractionData?.vendor_siren);
    const vendorSiret = getExtractedValue(invoice?.vendor_siret || extractionData?.vendor_siret);
    const vendorVat = getExtractedValue(invoice?.vendor_vat_number || extractionData?.VendorTaxId);
    const vendorIban = getExtractedValue(invoice?.vendor_iban || extractionData?.IBAN);

    // Try to extract address info from VendorAddress
    const vendorAddressContent = getExtractedContent(extractionData?.VendorAddress);
    const vendorAddressValue = getExtractedValue(extractionData?.VendorAddress);

    // Parse address - try to extract city/postal code if available
    let address = '';
    let city = '';
    let postalCode = '';

    if (vendorAddressContent || vendorAddressValue) {
      const fullAddress = vendorAddressContent || vendorAddressValue;
      address = fullAddress;

      // Try to extract French postal code (5 digits)
      const postalMatch = fullAddress.match(/\b(\d{5})\b/);
      if (postalMatch) {
        postalCode = postalMatch[1];
        // Try to get city after postal code
        const cityMatch = fullAddress.match(/\d{5}\s+([A-Za-zÀ-ÿ\s-]+)/);
        if (cityMatch) {
          city = cityMatch[1].trim();
        }
      }
    }

    console.log('[SupplierModal] Pre-fill data:', {
      vendorName, vendorSiren, vendorSiret, vendorVat, vendorIban,
      address, city, postalCode,
      extractionDataKeys: extractionData ? Object.keys(extractionData) : []
    });

    return {
      name: vendorName,
      siren: vendorSiren,
      siret: vendorSiret,
      vat_number: vendorVat,
      iban: vendorIban,
      address: address,
      city: city,
      postal_code: postalCode,
    };
  }, [supplierModalMode, existingSupplier, invoice, extractionData]);

  if (!isOpen || !invoiceId || !mounted || !invoice) return null;

  // A. START ANALYSIS
  const handleStartAnalysis = () => {
    // Trigger the Python Brain manually
    analyzeInvoice(invoice.total_amount || 0);
  };

  // B. VALIDATE
  const handleValidate = async () => {
    setIsValidating(true);
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'APPROVED' })
      .eq('id', invoiceId);

    if (error) {
      alert("Erreur lors de la validation: " + error.message);
    } else {
      // Also update the Job logic
      await supabase.from('jobs').update({ result: 'APPROVED' }).eq('invoice_id', invoiceId);

      // FORCE REFRESH THE PAGE TO SHOW CHANGES
      window.location.reload();
    }
    setIsValidating(false);
  };

  // C. ASK DAF (Placeholder for opening the chat)
  const handleAskDAF = () => {
    alert("🤖 Ask DAF: 'Pourquoi cette facture est-elle bloquée ?'\n(Opening Chat Module...)");
  };

  // D. EDIT (Legacy placeholder)
  const handleEdit = () => {
    alert("Mode édition activé.\n(Vous pouvez maintenant modifier les montants)");
  };

  // Mock Accounting Entry
  // Assumption: invoice.total_amount is TTC (Total Including Tax)
  // We assume a standard 20% VAT rate for this demo
  const totalTTC = invoice.total_amount || 0;
  const vatRate = 0.20;
  const totalHT = totalTTC / (1 + vatRate);
  const totalVAT = totalTTC - totalHT;

  const accountingEntry = [
    { account: '606000', label: 'Achats non stockés', debit: totalHT, credit: 0 },
    { account: '445660', label: 'TVA Déductible', debit: totalVAT, credit: 0 },
    { account: '401000', label: 'Fournisseur', debit: 0, credit: totalTTC },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end font-sans pointer-events-none">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-500 pointer-events-auto ${mounted ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`relative w-full max-w-[95vw] bg-[#0B1121] h-full shadow-2xl border-l border-white/10 flex flex-col transition-transform duration-500 ease-out pointer-events-auto ${mounted ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0B1121] z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-light text-white">
              Invoice <span className="font-mono text-slate-400">#{invoice.id.slice(0, 8)}</span>
            </h2>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${invoice.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              invoice.status === 'NEEDS_APPROVAL' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-slate-800 text-slate-400 border-white/5'
              }`}>
              {invoice.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: RAG Inspector */}
          <div className="w-[400px] bg-[#0B1121] border-r border-white/5 flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-4 bg-[#0B1121]/50">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">RAG Inspector</span>
            </div>
            <ChunkInspector
              invoiceId={invoiceId}
              className="flex-1 border-none rounded-none bg-transparent"
              extractionData={extractionData}
              onFocusField={(field) => setFocusedField(field)}
            />
          </div>

          {/* Middle: PDF Viewer */}
          <div className="flex-1 bg-slate-900/50 relative border-r border-white/5 flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-[#0B1121]/50">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Original Document</span>
              <div className="flex gap-2">
                <button className="p-1 hover:bg-white/5 rounded text-slate-400">
                  <Download size={14} />
                </button>
                <button className="p-1 hover:bg-white/5 rounded text-slate-400">
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative bg-slate-900">
              {invoice.file_url ? (
                <PdfViewerWithHighlights
                  url={invoice.file_url}
                  highlights={isSelectionMode ? [] : highlights} // Hide highlights in selection mode
                  metadata={extractionData?._metadata}
                  focusedLabel={focusedField}
                  renderOverlay={(pageNumber, pageDimensions) => (
                    <InteractiveOverlay
                      rawAzureData={extractionData?._metadata}
                      isSelectionMode={isSelectionMode}
                      targetField={targetField}
                      onCorrect={handleApplyCorrection}
                      onCancel={handleCancelCorrection}
                      currentPage={pageNumber}
                    />
                  )}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No document available
                </div>
              )}
            </div>
          </div>

          {/* Right: Analysis & Chat */}
          <div className="w-[400px] flex flex-col bg-[#0B1121] border-l border-white/5">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* AI Audit Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">AI Audit Trail</h3>
                  {(status === 'idle' || steps.length === 0) && (
                    <button
                      onClick={handleStartAnalysis}
                      className="flex items-center gap-2 text-xs bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                    >
                      <Play size={10} fill="currentColor" /> Start Audit
                    </button>
                  )}
                </div>
                <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5 min-h-[100px]">
                  {steps.length === 0 && status !== 'processing' ? (
                    <div className="text-center py-6 text-slate-600 text-xs italic">
                      Click "Start Audit" to analyze document.
                    </div>
                  ) : (
                    <AgentTimeline steps={steps} jobId={invoiceId} />
                  )}
                </div>
              </div>

              {/* Extraction Data - Premium Nebula Cards */}
              <FieldCardGroup title="Informations Générales">
                <FieldCard
                  label="N° Facture"
                  value={invoice.invoice_number || extractionData?.InvoiceId?.value || extractionData?.InvoiceId}
                  confidence={extractionData?.InvoiceId?.confidence}
                  icon={<Hash size={14} />}
                  type="mono"
                  onEdit={extractionData ? () => handleStartCorrection('invoice_number') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
                <FieldCard
                  label="Fournisseur"
                  value={invoice.vendor_name || invoice.client_name || extractionData?.VendorName?.value || extractionData?.VendorName}
                  confidence={extractionData?.VendorName?.confidence}
                  icon={<User size={14} />}
                  onFocus={() => setFocusedField('Vendor')}
                  onEdit={extractionData ? () => handleStartCorrection('vendor_name') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
                <FieldCard
                  label="SIREN / SIRET"
                  value={invoice.vendor_siren || invoice.vendor_siret || extractionData?.VendorTaxId?.value || extractionData?.VendorTaxId}
                  confidence={extractionData?.VendorTaxId?.confidence}
                  icon={<Building2 size={14} />}
                  type="mono"
                  onEdit={extractionData ? () => handleStartCorrection('vendor_siren') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
              </FieldCardGroup>

              <FieldCardGroup title="Dates">
                <FieldCard
                  label="Date Facture"
                  value={invoice.invoice_date || extractionData?.InvoiceDate?.value || extractionData?.InvoiceDate}
                  confidence={extractionData?.InvoiceDate?.confidence}
                  icon={<Calendar size={14} />}
                  type="date"
                  onFocus={() => setFocusedField('Date')}
                  onEdit={extractionData ? () => handleStartCorrection('invoice_date') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
                <FieldCard
                  label="Échéance"
                  value={invoice.due_date || extractionData?.DueDate?.value || extractionData?.DueDate}
                  confidence={extractionData?.DueDate?.confidence}
                  icon={<Calendar size={14} />}
                  type="date"
                  onEdit={extractionData ? () => handleStartCorrection('due_date') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
                <FieldCard
                  label="Réf. Commande"
                  value={invoice.reference || extractionData?.PurchaseOrder?.value || extractionData?.PurchaseOrder}
                  confidence={extractionData?.PurchaseOrder?.confidence}
                  icon={<Receipt size={14} />}
                  type="mono"
                  onEdit={extractionData ? () => handleStartCorrection('reference') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
              </FieldCardGroup>

              <FieldCardGroup title="Montants">
                <FieldCard
                  label="Montant HT"
                  value={invoice.subtotal_ht || extractionData?.net_amount?.value || extractionData?.SubTotal?.value || extractionData?.SubTotal}
                  confidence={extractionData?.SubTotal?.confidence || extractionData?.net_amount?.confidence}
                  icon={<CreditCard size={14} />}
                  type="currency"
                  onEdit={extractionData ? () => handleStartCorrection('subtotal_ht') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
                <FieldCard
                  label="TVA"
                  value={invoice.total_tax || extractionData?.tax_amount?.value || extractionData?.TotalTax?.value || extractionData?.TotalTax}
                  confidence={extractionData?.TotalTax?.confidence || extractionData?.tax_amount?.confidence}
                  icon={<Receipt size={14} />}
                  type="currency"
                  onEdit={extractionData ? () => handleStartCorrection('total_tax') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                />
                <FieldCard
                  label="Montant TTC"
                  value={invoice.total_ttc || invoice.total_amount || extractionData?.InvoiceTotal?.value || extractionData?.InvoiceTotal}
                  confidence={extractionData?.InvoiceTotal?.confidence}
                  icon={<CreditCard size={14} />}
                  type="currency"
                  onFocus={() => setFocusedField('Total')}
                  onEdit={extractionData ? () => handleStartCorrection('total_ttc') : undefined}
                  isEditable={!!extractionData?._metadata?.pages?.[0]?.words?.length}
                  className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border-teal-500/20"
                />
              </FieldCardGroup>

              {/* Supplier Linking Section */}
              <div className="bg-[#020617]/40 rounded-xl p-4 border border-white/5">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
                  <Building2 size={14} />
                  Fiche Fournisseur
                </h3>

                {invoice.supplier_id ? (
                  // Supplier is linked - show button to view fiche
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-400">Fournisseur lié</span>
                    <button
                      onClick={handleOpenViewSupplier}
                      className="flex items-center gap-2 text-teal-400 hover:text-teal-300 text-xs font-medium transition-colors"
                    >
                      <Eye size={12} />
                      Voir la fiche
                    </button>
                  </div>
                ) : (invoice.vendor_name || invoice.vendor_siren || invoice.vendor_siret) ? (
                  // No supplier linked but vendor data exists - propose creation
                  <div className="space-y-3">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-xs text-amber-400 font-medium mb-1">Fournisseur non lié</p>
                      <p className="text-xs text-slate-400">
                        Aucun fournisseur existant ne correspond à{' '}
                        <span className="text-white font-mono">
                          {invoice.vendor_siren || invoice.vendor_siret || invoice.vendor_name}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={handleOpenCreateSupplier}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-400 text-xs font-medium rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                    >
                      <Plus size={14} />
                      Créer la fiche fournisseur
                    </button>
                  </div>
                ) : (
                  // No vendor data at all
                  <p className="text-xs text-slate-500 italic py-2">
                    Aucune information fournisseur disponible
                  </p>
                )}
              </div>

              {/* Accounting Entries - Nebula Style */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-3 px-1">Écritures Comptables</h3>
                <div className="bg-[#1E293B]/60 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead className="bg-slate-900/50 text-slate-500 border-b border-white/5">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider">Compte</th>
                        <th className="px-3 py-2 text-left font-bold uppercase tracking-wider">Libellé</th>
                        <th className="px-3 py-2 text-right font-bold uppercase tracking-wider">Débit</th>
                        <th className="px-3 py-2 text-right font-bold uppercase tracking-wider">Crédit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {accountingEntry.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2 font-mono font-bold text-teal-400">{row.account}</td>
                          <td className="px-3 py-2 text-slate-300">{row.label}</td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-400">{row.debit > 0 ? row.debit.toFixed(2) + ' €' : '-'}</td>
                          <td className="px-3 py-2 text-right font-mono text-rose-400">{row.credit > 0 ? row.credit.toFixed(2) + ' €' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-white/10 bg-slate-900/30">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-right text-slate-500 font-bold uppercase text-[9px]">Totaux</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                          {accountingEntry.reduce((sum, r) => sum + r.debit, 0).toFixed(2)} €
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-400">
                          {accountingEntry.reduce((sum, r) => sum + r.credit, 0).toFixed(2)} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/5 bg-slate-900/30">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleAskDAF}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-white/5"
                >
                  <MessageSquare size={16} />
                  Ask DAF
                </button>

                {/* DELETE BUTTON */}
                <button
                  onClick={async () => {
                    if (confirm("Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.")) {
                      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
                      if (error) {
                        alert("Erreur lors de la suppression : " + error.message);
                      } else {
                        window.location.reload();
                      }
                    }
                  }}
                  disabled={invoice.status === 'APPROVED' || invoice.status === 'PAID'}
                  className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${invoice.status === 'APPROVED' || invoice.status === 'PAID'
                    ? 'bg-slate-800/50 text-slate-600 border-transparent cursor-not-allowed'
                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  title={invoice.status === 'APPROVED' ? "Impossible de supprimer une facture validée" : "Supprimer définitivement"}
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>

                {(() => {
                  // Check if supplier is required but not linked
                  // Look for vendor identifier in both invoice fields and extraction_data
                  const vendorSiren = invoice.vendor_siren || extractionData?.vendor_siren?.value;
                  const vendorSiret = invoice.vendor_siret || extractionData?.vendor_siret?.value;
                  const vendorName = invoice.vendor_name || invoice.client_name || extractionData?.VendorName?.value;

                  // Supplier is required if we have any vendor identifier (SIREN, SIRET, or name)
                  const hasVendorData = !!(vendorSiren || vendorSiret || vendorName);
                  const supplierNotLinked = hasVendorData && !invoice.supplier_id;
                  const isRejected = invoice.status === 'REJECTED';
                  const isDisabled = isValidating || isRejected || supplierNotLinked;

                  // Debug log
                  console.log('[Validation Check]', {
                    vendorSiren,
                    vendorSiret,
                    vendorName,
                    hasVendorData,
                    supplier_id: invoice.supplier_id,
                    supplierNotLinked,
                    isDisabled
                  });

                  let title = "Valider pour paiement";
                  let label = "Validate";
                  if (isRejected) {
                    title = "Document rejeté par l'IA";
                    label = "Rejeté";
                  } else if (supplierNotLinked) {
                    title = "Veuillez d'abord lier ou créer la fiche fournisseur";
                    label = "Fournisseur requis";
                  }

                  return (
                    <button
                      onClick={handleValidate}
                      disabled={isDisabled}
                      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        isRejected
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : supplierNotLinked
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                      }`}
                      title={title}
                    >
                      {isValidating ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : supplierNotLinked ? (
                        <Building2 size={16} />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      {isValidating ? 'Validating...' : label}
                    </button>
                  );
                })()}
                <button
                  onClick={() => setIsAccountingOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                >
                  <FileText size={16} />
                  Comptabilité
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Validator Overlay */}
      {isAccountingOpen && invoice && (
        <AccountingValidator
          invoiceId={invoiceId!}
          fileUrl={invoice.file_url}
          initialData={{ ...extractionData, total_amount: invoice.total_amount }}
          onClose={() => setIsAccountingOpen(false)}
          onSuccess={() => {
            setIsAccountingOpen(false);
            window.location.reload();
          }}
          supplierId={invoice.supplier_id}
        />
      )}

      {/* Supplier Modal */}
      <SupplierModal
        isOpen={supplierModalOpen}
        onClose={() => {
          setSupplierModalOpen(false);
          handleSelectionCancel(); // Reset selection mode when closing
        }}
        onSave={handleSaveSupplier}
        initialData={supplierInitialData}
        mode={supplierModalMode}
        title={supplierModalMode === 'create' ? 'Créer Fiche Fournisseur' : 'Fiche Fournisseur'}
        onRequestSelection={handleSupplierSelectionRequest}
        activeSelectionField={supplierSelectionField}
        selectedValue={supplierSelectedValue}
        onClearSelection={handleClearSupplierSelection}
        onCheckSupplierExists={handleCheckSupplierExists}
        onSearchSuppliers={handleSearchSuppliers}
        onLinkExistingSupplier={handleLinkExistingSupplier}
      />
    </div>,
    document.body
  );
}
