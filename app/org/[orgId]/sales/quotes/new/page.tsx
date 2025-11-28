'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  FileText,
  Users,
  Search,
  X,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Building2,
  Mail,
  Phone,
  Euro,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  email?: string;
  company_name?: string;
  address?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
  vat_rate: number;
}

interface Lead {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  potential_value: number;
  status: string;
}

interface QuoteLine {
  id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_percent: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function calculateLineTotals(line: QuoteLine): QuoteLine {
  const subtotal = line.quantity * line.unit_price;
  const discountAmount = subtotal * (line.discount_percent / 100);
  const total_ht = subtotal - discountAmount;
  const total_vat = total_ht * (line.vat_rate / 100);
  const total_ttc = total_ht + total_vat;
  return { ...line, total_ht, total_vat, total_ttc };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

// A4 Pagination Configuration
const MAX_ITEMS_FIRST_PAGE = 10; // First page has header/client info
const MAX_ITEMS_OTHER_PAGES = 18; // Subsequent pages have more space
const FOOTER_LINES_EQUIVALENT = 3; // Totals section takes ~3 line equivalents

interface PaginatedPage {
  pageNumber: number;
  items: QuoteLine[];
  isFirstPage: boolean;
  isLastPage: boolean;
  showTotals: boolean;
}

function paginateItems(items: QuoteLine[]): PaginatedPage[] {
  const validItems = items.filter((item) => item.description.trim());

  if (validItems.length === 0) {
    return [{
      pageNumber: 1,
      items: [],
      isFirstPage: true,
      isLastPage: true,
      showTotals: true,
    }];
  }

  const pages: PaginatedPage[] = [];
  let currentIndex = 0;

  // First page
  const firstPageItems = validItems.slice(0, MAX_ITEMS_FIRST_PAGE);
  currentIndex = firstPageItems.length;

  // Check if totals fit on first page
  const remainingItems = validItems.length - currentIndex;
  const isOnlyPage = remainingItems === 0;
  const totalsOnFirstPage = isOnlyPage && firstPageItems.length <= (MAX_ITEMS_FIRST_PAGE - FOOTER_LINES_EQUIVALENT);

  pages.push({
    pageNumber: 1,
    items: firstPageItems,
    isFirstPage: true,
    isLastPage: isOnlyPage && totalsOnFirstPage,
    showTotals: totalsOnFirstPage,
  });

  // Subsequent pages
  while (currentIndex < validItems.length) {
    const pageItems = validItems.slice(currentIndex, currentIndex + MAX_ITEMS_OTHER_PAGES);
    currentIndex += pageItems.length;

    const isLastContentPage = currentIndex >= validItems.length;
    const totalsOnThisPage = isLastContentPage && pageItems.length <= (MAX_ITEMS_OTHER_PAGES - FOOTER_LINES_EQUIVALENT);

    pages.push({
      pageNumber: pages.length + 1,
      items: pageItems,
      isFirstPage: false,
      isLastPage: isLastContentPage && totalsOnThisPage,
      showTotals: totalsOnThisPage,
    });
  }

  // If totals didn't fit on any page, add a final page for totals only
  const lastPage = pages[pages.length - 1];
  if (!lastPage.showTotals) {
    pages.push({
      pageNumber: pages.length + 1,
      items: [],
      isFirstPage: false,
      isLastPage: true,
      showTotals: true,
    });
    // Update the previous last page
    pages[pages.length - 2].isLastPage = false;
  }

  return pages;
}

export default function NewQuotePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const leadIdFromUrl = searchParams.get('leadId');

  // Data loading
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CRM Import Modal
  const [showCRMModal, setShowCRMModal] = useState(false);
  const [wonLeads, setWonLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Form state
  const [quoteNumber, setQuoteNumber] = useState('');
  const [reference, setReference] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [leadId, setLeadId] = useState<string | null>(leadIdFromUrl);
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [validityDate, setValidityDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState('Paiement à 30 jours');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([
    {
      id: generateId(),
      description: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: 20,
      discount_percent: 0,
      total_ht: 0,
      total_vat: 0,
      total_ttc: 0,
    },
  ]);

  // Calculated totals
  const subtotalHT = lines.reduce((sum, line) => sum + line.total_ht, 0);
  const totalVAT = lines.reduce((sum, line) => sum + line.total_vat, 0);
  const totalTTC = lines.reduce((sum, line) => sum + line.total_ttc, 0);

  // Generate quote number
  useEffect(() => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    setQuoteNumber(`DEV-${dateStr}-${randomNum}`);
  }, []);

  // Load clients and products
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        const [clientsRes, productsRes] = await Promise.all([
          fetch('/api/erp/clients?limit=100'),
          fetch('/api/erp/products?limit=100'),
        ]);

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setClients(clientsData.data?.clients || []);
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData.data?.products || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  // Load lead if leadId is provided
  useEffect(() => {
    if (leadIdFromUrl) {
      loadLeadData(leadIdFromUrl);
    }
  }, [leadIdFromUrl]);

  async function loadLeadData(id: string) {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && lead) {
      setLeadId(lead.id);
      setClientName(lead.company_name);
      setClientEmail(lead.contact_email || '');
      // Pre-fill a line with the lead's potential value
      if (lead.potential_value > 0) {
        setLines([
          calculateLineTotals({
            id: generateId(),
            description: `Prestation pour ${lead.company_name}`,
            quantity: 1,
            unit_price: lead.potential_value,
            vat_rate: 20,
            discount_percent: 0,
            total_ht: 0,
            total_vat: 0,
            total_ttc: 0,
          }),
        ]);
      }
    }
  }

  // Load won leads for CRM import
  async function loadWonLeads() {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .in('status', ['won', 'qualified', 'proposal', 'negotiation'])
        .order('created_at', { ascending: false });

      if (!error) {
        setWonLeads(data || []);
      }
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }

  function openCRMModal() {
    loadWonLeads();
    setShowCRMModal(true);
  }

  function importFromLead(lead: Lead) {
    setLeadId(lead.id);
    setClientName(lead.company_name);
    setClientEmail(lead.contact_email || '');

    // Pre-fill a line with the lead's potential value
    if (lead.potential_value > 0) {
      setLines([
        calculateLineTotals({
          id: generateId(),
          description: `Prestation pour ${lead.company_name}`,
          quantity: 1,
          unit_price: lead.potential_value,
          vat_rate: 20,
          discount_percent: 0,
          total_ht: 0,
          total_vat: 0,
          total_ttc: 0,
        }),
      ]);
    }

    setShowCRMModal(false);
  }

  // Line management
  function addLine() {
    setLines([
      ...lines,
      {
        id: generateId(),
        description: '',
        quantity: 1,
        unit_price: 0,
        vat_rate: 20,
        discount_percent: 0,
        total_ht: 0,
        total_vat: 0,
        total_ttc: 0,
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== id));
    }
  }

  function moveLineUp(index: number) {
    if (index === 0) return;
    const newLines = [...lines];
    [newLines[index - 1], newLines[index]] = [newLines[index], newLines[index - 1]];
    setLines(newLines);
  }

  function moveLineDown(index: number) {
    if (index === lines.length - 1) return;
    const newLines = [...lines];
    [newLines[index], newLines[index + 1]] = [newLines[index + 1], newLines[index]];
    setLines(newLines);
  }

  function updateLine(id: string, updates: Partial<QuoteLine>) {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updatedLine = { ...line, ...updates };
          return calculateLineTotals(updatedLine);
        }
        return line;
      })
    );
  }

  function selectProduct(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateLine(lineId, {
        product_id: productId,
        description: product.description || product.name,
        unit_price: product.unit_price,
        vat_rate: product.vat_rate,
      });
    }
  }

  // Client selection
  function selectClient(id: string) {
    const client = clients.find((c) => c.id === id);
    if (client) {
      setClientId(id);
      setClientName(client.company_name || client.name);
      setClientEmail(client.email || '');
      setClientAddress(client.address || '');
    }
  }

  // Save quote
  async function handleSave() {
    setError(null);

    const validLines = lines.filter((line) => line.description.trim());
    if (validLines.length === 0) {
      setError('Veuillez ajouter au moins une ligne');
      return;
    }

    if (!clientName.trim()) {
      setError('Veuillez renseigner le nom du client');
      return;
    }

    setSaving(true);
    try {
      // Create quote
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          org_id: orgId,
          quote_number: quoteNumber,
          reference,
          client_id: clientId || null,
          client_name: clientName,
          client_email: clientEmail,
          client_address: clientAddress,
          lead_id: leadId,
          quote_date: quoteDate,
          validity_date: validityDate,
          payment_terms: paymentTerms,
          notes,
          status: 'draft',
          total_ht: subtotalHT,
          total_vat: totalVAT,
          total_ttc: totalTTC,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Create lines
      const lineInserts = validLines.map((line, index) => ({
        quote_id: quote.id,
        product_id: line.product_id || null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        discount_percent: line.discount_percent,
        position: index,
      }));

      const { error: linesError } = await supabase.from('quote_lines').insert(lineInserts);

      if (linesError) throw linesError;

      router.push(`/org/${orgId}/sales/quotes`);
    } catch (err: any) {
      console.error('Error saving quote:', err);
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  // Filtered leads for modal
  const filteredLeads = leadSearch
    ? wonLeads.filter(
        (l) =>
          l.company_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
          l.contact_name?.toLowerCase().includes(leadSearch.toLowerCase())
      )
    : wonLeads;

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/org/${orgId}/sales/quotes`}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
                  <FileText size={24} className="text-teal-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Nouveau Devis</h1>
                  <p className="text-sm text-slate-400">{quoteNumber}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={openCRMModal}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Users className="h-4 w-4 mr-2" />
                Importer depuis CRM
              </Button>

              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
                <Save className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-[1800px] mx-auto px-6 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Split Screen Layout */}
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Input Form */}
          <div className="space-y-6">
            {/* Client Info */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-400" />
                Informations Client
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Client existant</Label>
                    <Select value={clientId} onValueChange={selectClient}>
                      <SelectTrigger className="bg-slate-800/50 border-white/10 text-slate-200">
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.company_name || client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-slate-300">Nom / Société *</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Nom du client"
                      className="bg-slate-800/50 border-white/10 text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Email</Label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="email@client.com"
                      className="bg-slate-800/50 border-white/10 text-slate-200"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Adresse</Label>
                    <Input
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Adresse"
                      className="bg-slate-800/50 border-white/10 text-slate-200"
                    />
                  </div>
                </div>

                {leadId && (
                  <div className="flex items-center gap-2 text-purple-400 text-sm bg-purple-500/10 px-3 py-2 rounded-lg">
                    <Sparkles className="h-4 w-4" />
                    Importé depuis le CRM
                  </div>
                )}
              </div>
            </div>

            {/* Quote Details */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Détails du Devis</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Référence</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Référence interne"
                    className="bg-slate-800/50 border-white/10 text-slate-200"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Date du devis</Label>
                  <DateInput
                    value={quoteDate}
                    onChange={setQuoteDate}
                    className="bg-slate-800/50 border-white/10 text-slate-200"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Validité jusqu'au</Label>
                  <DateInput
                    value={validityDate}
                    onChange={setValidityDate}
                    className="bg-slate-800/50 border-white/10 text-slate-200"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Conditions de paiement</Label>
                  <Input
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="bg-slate-800/50 border-white/10 text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Lines */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Lignes du devis</h3>

              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div
                    key={line.id}
                    className="bg-slate-800/30 border border-white/5 rounded-lg p-3"
                  >
                    <div className="flex gap-2 items-center">
                      {/* Reorder Controls */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => moveLineUp(index)}
                          disabled={index === 0}
                          className={cn(
                            "p-0.5 rounded transition-colors",
                            index === 0
                              ? "text-slate-600 cursor-not-allowed"
                              : "text-slate-400 hover:text-white hover:bg-white/10"
                          )}
                          title="Monter"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveLineDown(index)}
                          disabled={index === lines.length - 1}
                          className={cn(
                            "p-0.5 rounded transition-colors",
                            index === lines.length - 1
                              ? "text-slate-600 cursor-not-allowed"
                              : "text-slate-400 hover:text-white hover:bg-white/10"
                          )}
                          title="Descendre"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Description */}
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(line.id, { description: e.target.value })}
                        placeholder="Description"
                        className="flex-1 h-8 bg-transparent border-white/10 text-slate-200 text-sm"
                      />

                      {/* Qté */}
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Qté"
                        className="w-16 h-8 bg-transparent border-white/10 text-slate-200 text-right text-sm"
                      />

                      {/* Prix HT */}
                      <Input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) =>
                          updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Prix"
                        className="w-24 h-8 bg-transparent border-white/10 text-slate-200 text-right text-sm"
                      />

                      {/* TVA */}
                      <Select
                        value={line.vat_rate.toString()}
                        onValueChange={(v) => updateLine(line.id, { vat_rate: parseFloat(v) })}
                      >
                        <SelectTrigger className="w-20 h-8 bg-transparent border-white/10 text-slate-200 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10">
                          {[0, 5.5, 10, 20].map((rate) => (
                            <SelectItem key={rate} value={rate.toString()}>
                              {rate}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Total */}
                      <p className="w-24 text-right text-sm font-bold text-teal-400">
                        {formatCurrency(line.total_ht)}
                      </p>

                      {/* Delete */}
                      <button
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                        className={cn(
                          "p-1 rounded transition-colors",
                          lines.length === 1
                            ? "text-slate-600 cursor-not-allowed"
                            : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add Line Button - After all lines */}
                <button
                  onClick={addLine}
                  className="w-full py-3 border-2 border-dashed border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-teal-500/50 hover:bg-teal-500/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une ligne
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes visibles sur le devis..."
                className="mt-2 bg-slate-800/50 border-white/10 text-slate-200"
              />
            </div>
          </div>

          {/* RIGHT: Preview - A4 Paginated */}
          <div className="space-y-6">
            {paginateItems(lines).map((page) => (
              <div
                key={page.pageNumber}
                className="bg-white rounded-xl shadow-2xl text-slate-900 mx-auto"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '20mm',
                  boxSizing: 'border-box',
                }}
              >
                {/* Page Header - Full header on first page, compact on subsequent */}
                {page.isFirstPage ? (
                  <>
                    {/* Full Header */}
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <h1 className="text-4xl font-bold text-slate-800 tracking-tight">DEVIS</h1>
                        <p className="text-slate-500 mt-1">#{quoteNumber}</p>
                        {reference && <p className="text-sm text-slate-400">Réf: {reference}</p>}
                      </div>
                      <div className="text-right">
                        <h3 className="font-bold text-slate-800">CoreMatch</h3>
                        <p className="text-sm text-slate-500">Paris, France</p>
                      </div>
                    </div>

                    {/* Client & Dates */}
                    <div className="grid grid-cols-2 gap-8 mb-10">
                      <div>
                        <p className="text-xs uppercase font-bold text-slate-400 mb-1">Destinataire</p>
                        <p className="font-semibold text-slate-800">{clientName || 'Client'}</p>
                        {clientEmail && <p className="text-sm text-slate-500">{clientEmail}</p>}
                        {clientAddress && <p className="text-sm text-slate-500">{clientAddress}</p>}
                      </div>
                      <div className="text-right">
                        <div className="mb-2">
                          <span className="text-xs uppercase font-bold text-slate-400 mr-4">Date</span>
                          <span className="font-medium">
                            {new Date(quoteDate).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs uppercase font-bold text-slate-400 mr-4">
                            Valide jusqu'au
                          </span>
                          <span className="font-medium">
                            {new Date(validityDate).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Compact Header for continuation pages */
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-800">DEVIS</span>
                      <span className="text-slate-500">#{quoteNumber}</span>
                    </div>
                    <span className="text-sm text-slate-400">
                      Page {page.pageNumber} / {paginateItems(lines).length}
                    </span>
                  </div>
                )}

                {/* Lines Table */}
                {page.items.length > 0 && (
                  <table className="w-full mb-6 table-fixed">
                    <thead>
                      <tr className="border-b-2 border-slate-100">
                        <th className="text-left py-3 text-xs uppercase text-slate-400 w-[50%]">Description</th>
                        <th className="text-right py-3 text-xs uppercase text-slate-400 w-[12%]">Qté</th>
                        <th className="text-right py-3 text-xs uppercase text-slate-400 w-[19%]">Prix HT</th>
                        <th className="text-right py-3 text-xs uppercase text-slate-400 w-[19%]">Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.items.map((line) => (
                        <tr key={line.id} className="border-b border-slate-50">
                          <td className="py-4 text-sm font-medium whitespace-pre-wrap break-words">
                            {line.description}
                            {line.discount_percent > 0 && (
                              <span className="text-xs text-emerald-600 ml-2">
                                (-{line.discount_percent}%)
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-right text-sm text-slate-500">{line.quantity}</td>
                          <td className="py-4 text-right text-sm text-slate-500">
                            {formatCurrency(line.unit_price)}
                          </td>
                          <td className="py-4 text-right text-sm font-semibold">
                            {formatCurrency(line.total_ht)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Subtotal on non-last pages */}
                {!page.showTotals && page.items.length > 0 && (
                  <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-400">
                      Suite page suivante...
                    </div>
                  </div>
                )}

                {/* Totals - Only on the page designated for totals */}
                {page.showTotals && (
                  <div className="mt-auto">
                    <div className="flex justify-end">
                      <div className="w-1/2">
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-500">Total HT</span>
                          <span className="font-medium">{formatCurrency(subtotalHT)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-500">TVA</span>
                          <span className="font-medium">{formatCurrency(totalVAT)}</span>
                        </div>
                        <div className="flex justify-between py-4">
                          <span className="text-lg font-bold text-slate-800">Total TTC</span>
                          <span className="text-lg font-bold text-teal-600">{formatCurrency(totalTTC)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Conditions */}
                    {(paymentTerms || notes) && (
                      <div className="mt-10 pt-6 border-t border-slate-100">
                        {paymentTerms && (
                          <p className="text-sm text-slate-500">
                            <strong>Conditions:</strong> {paymentTerms}
                          </p>
                        )}
                        {notes && <p className="text-sm text-slate-500 mt-2">{notes}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Page Footer */}
                <div className="absolute bottom-5 left-0 right-0 text-center text-xs text-slate-300" style={{ position: 'relative', marginTop: 'auto', paddingTop: '20px' }}>
                  Page {page.pageNumber} / {paginateItems(lines).length}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CRM Import Modal */}
      {showCRMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCRMModal(false)}
          />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Users className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Importer depuis le CRM</h3>
                  <p className="text-sm text-slate-400">Sélectionnez un lead pour créer le devis</p>
                </div>
              </div>
              <button
                onClick={() => setShowCRMModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un lead..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Leads List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingLeads ? (
                <div className="text-center py-12 text-slate-400">Chargement...</div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  Aucun lead trouvé
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => importFromLead(lead)}
                    className="w-full p-4 bg-slate-800/30 border border-white/5 rounded-lg hover:bg-slate-800/50 hover:border-purple-500/30 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{lead.company_name}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                          {lead.contact_name && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {lead.contact_name}
                            </span>
                          )}
                          {lead.contact_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.contact_email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-teal-400">
                          {formatCurrency(lead.potential_value)}
                        </p>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            lead.status === 'won'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-blue-500/20 text-blue-400'
                          )}
                        >
                          {lead.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
