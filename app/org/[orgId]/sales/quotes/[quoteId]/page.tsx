'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageContainer from '@/components/ui/PageContainer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import {
  ArrowLeft,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  ArrowRight,
  Printer,
  Download,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Building2,
  Mail,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  reference: string | null;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  lead_id: string | null;
  quote_date: string;
  validity_date: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  currency: string;
  payment_terms: string | null;
  notes: string | null;
  converted_to_invoice_id: string | null;
  created_at: string;
}

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_percent: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
}

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: FileText },
  sent: { label: 'Envoyé', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
  accepted: { label: 'Accepté', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  rejected: { label: 'Refusé', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  expired: { label: 'Expiré', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Clock },
  converted: { label: 'Converti', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: ArrowRight },
};

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// A4 Pagination Configuration
const MAX_ITEMS_FIRST_PAGE = 10;
const MAX_ITEMS_OTHER_PAGES = 18;
const FOOTER_LINES_EQUIVALENT = 3;

interface PaginatedPage {
  pageNumber: number;
  items: QuoteLine[];
  isFirstPage: boolean;
  isLastPage: boolean;
  showTotals: boolean;
}

function paginateItems(items: QuoteLine[]): PaginatedPage[] {
  if (items.length === 0) {
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
  const firstPageItems = items.slice(0, MAX_ITEMS_FIRST_PAGE);
  currentIndex = firstPageItems.length;

  const remainingItems = items.length - currentIndex;
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
  while (currentIndex < items.length) {
    const pageItems = items.slice(currentIndex, currentIndex + MAX_ITEMS_OTHER_PAGES);
    currentIndex += pageItems.length;

    const isLastContentPage = currentIndex >= items.length;
    const totalsOnThisPage = isLastContentPage && pageItems.length <= (MAX_ITEMS_OTHER_PAGES - FOOTER_LINES_EQUIVALENT);

    pages.push({
      pageNumber: pages.length + 1,
      items: pageItems,
      isFirstPage: false,
      isLastPage: isLastContentPage && totalsOnThisPage,
      showTotals: totalsOnThisPage,
    });
  }

  // Add extra page for totals if needed
  const lastPage = pages[pages.length - 1];
  if (!lastPage.showTotals) {
    pages.push({
      pageNumber: pages.length + 1,
      items: [],
      isFirstPage: false,
      isLastPage: true,
      showTotals: true,
    });
    pages[pages.length - 2].isLastPage = false;
  }

  return pages;
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const quoteId = params.quoteId as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState<{ invoiceId: string; invoiceNumber: string } | null>(null);

  useEffect(() => {
    loadQuote();
  }, [quoteId]);

  async function loadQuote() {
    setLoading(true);
    try {
      // Load quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;
      setQuote(quoteData);

      // Load lines
      const { data: linesData, error: linesError } = await supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', quoteId)
        .order('position', { ascending: true });

      if (!linesError) {
        setLines(linesData || []);
      }
    } catch (err) {
      console.error('Error loading quote:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: Quote['status']) {
    if (!quote) return;

    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quote.id);

    if (!error) {
      setQuote({ ...quote, status: newStatus });
    }
  }

  async function convertToInvoice() {
    if (!quote) return;

    setConverting(true);
    try {
      // Generate invoice number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const invoiceNumber = `FACT-${dateStr}-${randomNum}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('erp_invoices')
        .insert({
          org_id: orgId,
          invoice_number: invoiceNumber,
          client_id: quote.client_id,
          client_name: quote.client_name,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'draft',
          total_ht: quote.total_ht,
          total_vat: quote.total_vat,
          total_ttc: quote.total_ttc,
          currency: quote.currency,
          notes: quote.notes,
          payment_terms: quote.payment_terms,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice lines from quote lines
      const invoiceLines = lines.map((line, index) => ({
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        total_ht: line.total_ht,
        total_vat: line.total_vat,
        total_ttc: line.total_ttc,
        position: index,
      }));

      const { error: linesError } = await supabase
        .from('erp_invoice_lines')
        .insert(invoiceLines);

      if (linesError) throw linesError;

      // Update quote status
      await supabase
        .from('quotes')
        .update({
          status: 'converted',
          converted_to_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      setConvertSuccess({
        invoiceId: invoice.id,
        invoiceNumber: invoiceNumber,
      });

      // Update local state
      setQuote({
        ...quote,
        status: 'converted',
        converted_to_invoice_id: invoice.id,
      });

    } catch (err) {
      console.error('Error converting to invoice:', err);
      alert('Erreur lors de la conversion');
    } finally {
      setConverting(false);
    }
  }

  async function deleteQuote() {
    if (!quote) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) return;

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quote.id);

    if (!error) {
      router.push(`/org/${orgId}/sales/quotes`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-slate-400">Devis non trouvé</div>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[quote.status]?.icon || FileText;
  const isExpired = quote.validity_date && new Date(quote.validity_date) < new Date();
  const canConvert = quote.status === 'accepted' || quote.status === 'draft' || quote.status === 'sent';

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
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
                  <h1 className="text-xl font-semibold text-white">{quote.quote_number}</h1>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                        STATUS_CONFIG[quote.status]?.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {STATUS_CONFIG[quote.status]?.label}
                    </span>
                    {quote.lead_id && (
                      <span className="text-xs text-purple-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        CRM
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status Actions */}
              {quote.status === 'draft' && (
                <Button
                  variant="outline"
                  onClick={() => updateStatus('sent')}
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Marquer envoyé
                </Button>
              )}
              {quote.status === 'sent' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateStatus('accepted')}
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accepté
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateStatus('rejected')}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Refusé
                  </Button>
                </>
              )}

              {/* Convert to Invoice */}
              {canConvert && quote.status !== 'converted' && (
                <Button
                  onClick={() => setShowConvertModal(true)}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Convertir en Facture
                </Button>
              )}

              {/* Other Actions */}
              <Button variant="outline" className="border-white/10 text-slate-400">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="border-white/10 text-slate-400">
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={deleteQuote}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Quote Preview (A4 Paginated) */}
          <div className="lg:col-span-2 space-y-6">
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
                {/* Page Header */}
                {page.isFirstPage ? (
                  <>
                    {/* Full Header */}
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <h1 className="text-4xl font-bold text-slate-800 tracking-tight">DEVIS</h1>
                        <p className="text-slate-500 mt-1">#{quote.quote_number}</p>
                        {quote.reference && <p className="text-sm text-slate-400">Réf: {quote.reference}</p>}
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
                        <p className="font-semibold text-slate-800">{quote.client_name}</p>
                        {quote.client_email && <p className="text-sm text-slate-500">{quote.client_email}</p>}
                        {quote.client_address && <p className="text-sm text-slate-500">{quote.client_address}</p>}
                      </div>
                      <div className="text-right">
                        <div className="mb-2">
                          <span className="text-xs uppercase font-bold text-slate-400 mr-4">Date</span>
                          <span className="font-medium">{formatDate(quote.quote_date)}</span>
                        </div>
                        {quote.validity_date && (
                          <div>
                            <span className="text-xs uppercase font-bold text-slate-400 mr-4">Valide jusqu'au</span>
                            <span className={cn('font-medium', isExpired && 'text-red-500')}>
                              {formatDate(quote.validity_date)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Compact Header for continuation pages */
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-800">DEVIS</span>
                      <span className="text-slate-500">#{quote.quote_number}</span>
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

                {/* Continuation indicator */}
                {!page.showTotals && page.items.length > 0 && (
                  <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-400">
                      Suite page suivante...
                    </div>
                  </div>
                )}

                {/* Totals */}
                {page.showTotals && (
                  <div className="mt-auto">
                    <div className="flex justify-end">
                      <div className="w-1/2">
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-500">Total HT</span>
                          <span className="font-medium">{formatCurrency(quote.total_ht)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-500">TVA</span>
                          <span className="font-medium">{formatCurrency(quote.total_vat)}</span>
                        </div>
                        <div className="flex justify-between py-4">
                          <span className="text-lg font-bold text-slate-800">Total TTC</span>
                          <span className="text-lg font-bold text-teal-600">
                            {formatCurrency(quote.total_ttc)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Conditions */}
                    {(quote.payment_terms || quote.notes) && (
                      <div className="mt-10 pt-6 border-t border-slate-100">
                        {quote.payment_terms && (
                          <p className="text-sm text-slate-500">
                            <strong>Conditions:</strong> {quote.payment_terms}
                          </p>
                        )}
                        {quote.notes && <p className="text-sm text-slate-500 mt-2">{quote.notes}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Page Footer */}
                <div className="text-center text-xs text-slate-300" style={{ marginTop: 'auto', paddingTop: '20px' }}>
                  Page {page.pageNumber} / {paginateItems(lines).length}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Statut</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">État actuel</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                      STATUS_CONFIG[quote.status]?.color
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {STATUS_CONFIG[quote.status]?.label}
                  </span>
                </div>

                {isExpired && quote.status !== 'converted' && quote.status !== 'accepted' && (
                  <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-500/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    Ce devis a expiré
                  </div>
                )}

                {quote.converted_to_invoice_id && (
                  <div className="pt-3 border-t border-white/10">
                    <Link
                      href={`/org/${orgId}/erp/invoices/${quote.converted_to_invoice_id}`}
                      className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Voir la facture
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Informations</h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Créé le
                  </span>
                  <span className="text-slate-200">{formatDate(quote.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Client
                  </span>
                  <span className="text-slate-200">{quote.client_name}</span>
                </div>
                {quote.client_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </span>
                    <span className="text-slate-200 truncate max-w-32">{quote.client_email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Actions rapides</h3>

              <div className="space-y-2">
                <Link
                  href={`/org/${orgId}/sales/quotes/new?duplicate=${quote.id}`}
                  className="flex items-center gap-2 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Dupliquer ce devis
                </Link>
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center gap-2 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer / PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Invoice Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !converting && !convertSuccess && setShowConvertModal(false)}
          />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {converting ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
                  <ArrowRight className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Conversion en cours...</h3>
                <p className="text-slate-400">Création de la facture</p>
              </div>
            ) : convertSuccess ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Facture créée !</h3>
                <p className="text-slate-400 mb-6">{convertSuccess.invoiceNumber}</p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowConvertModal(false)}
                    className="flex-1 border-white/10"
                  >
                    Fermer
                  </Button>
                  <Button
                    onClick={() => router.push(`/org/${orgId}/erp/invoices/${convertSuccess.invoiceId}`)}
                    className="flex-1"
                  >
                    Voir la facture
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <ArrowRight className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Convertir en Facture</h3>
                  <p className="text-slate-400">
                    Cette action va créer une facture à partir de ce devis.
                    Le devis sera marqué comme "converti".
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">Client</span>
                    <span className="text-white">{quote.client_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Montant TTC</span>
                    <span className="text-teal-400 font-bold">{formatCurrency(quote.total_ttc)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowConvertModal(false)}
                    className="flex-1 border-white/10"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={convertToInvoice}
                    className="flex-1 bg-purple-600 hover:bg-purple-500"
                  >
                    Confirmer
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
