'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Home,
  ChevronRight,
  Calculator,
  User,
  ShoppingCart,
  CheckCircle,
  ArrowRight,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/components/ui/SummaryCards';

interface Client {
  id: string;
  name: string;
  email?: string;
  company_name?: string;
  default_payment_terms?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
  vat_rate: number;
}

interface InvoiceLine {
  id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function calculateLineTotals(line: InvoiceLine): InvoiceLine {
  const total_ht = line.quantity * line.unit_price;
  const total_vat = total_ht * (line.vat_rate / 100);
  const total_ttc = total_ht + total_vat;
  return { ...line, total_ht, total_vat, total_ttc };
}

const STEPS = [
  { id: 1, title: 'Client & Infos', icon: User },
  { id: 2, title: 'Lignes', icon: ShoppingCart },
  { id: 3, title: 'Finalisation', icon: CheckCircle }
];

export default function NewInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [restored, setRestored] = useState(false);

  // Form state
  const [clientId, setClientId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Paiement à 30 jours');
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: generateId(),
      description: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: 20,
      total_ht: 0,
      total_vat: 0,
      total_ttc: 0,
    },
  ]);

  // Calculate totals
  const subtotalHT = lines.reduce((sum, line) => sum + line.total_ht, 0);
  const totalVAT = lines.reduce((sum, line) => sum + line.total_vat, 0);
  const totalTTC = lines.reduce((sum, line) => sum + line.total_ttc, 0);

  // Fetch clients and products
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

  // Auto-save & Restore
  useEffect(() => {
    const saved = localStorage.getItem(`invoice_draft_${orgId}`);
    if (saved && !restored) {
      try {
        const parsed = JSON.parse(saved);
        // Optional: Ask user before restoring? For now, just restore if empty
        if (!clientId) {
          setClientId(parsed.clientId || '');
          setReference(parsed.reference || '');
          setInvoiceDate(parsed.invoiceDate || new Date().toISOString().split('T')[0]);
          setLines(parsed.lines || []);
          setNotes(parsed.notes || '');
          setPaymentTerms(parsed.paymentTerms || 'Paiement à 30 jours');
          setRestored(true);
        }
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    }
  }, [orgId, restored, clientId]);

  useEffect(() => {
    if (restored || clientId || lines.length > 1 || lines[0].description) {
      const draft = { clientId, reference, invoiceDate, lines, notes, paymentTerms };
      localStorage.setItem(`invoice_draft_${orgId}`, JSON.stringify(draft));
    }
  }, [clientId, reference, invoiceDate, lines, notes, paymentTerms, orgId, restored]);

  function addLine() {
    setLines([
      ...lines,
      {
        id: generateId(),
        description: '',
        quantity: 1,
        unit_price: 0,
        vat_rate: 20,
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

  function updateLine(id: string, updates: Partial<InvoiceLine>) {
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

  // Smart Defaults
  useEffect(() => {
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client?.default_payment_terms) {
        setPaymentTerms(client.default_payment_terms);
      }
      // Simulate AI Reference Generation
      if (!reference) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        setReference(`FACT-${dateStr}-${Math.floor(Math.random() * 1000)}`);
      }
    }
  }, [clientId, clients]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validLines = lines.filter((line) => line.description.trim());
    if (validLines.length === 0) {
      setError('Veuillez ajouter au moins une ligne de facture');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/erp/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          reference,
          invoice_date: invoiceDate,
          due_date: dueDate,
          notes,
          payment_terms: paymentTerms,
          lines: validLines.map((line) => ({
            product_id: line.product_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            vat_rate: line.vat_rate,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur lors de la création');
      }

      // Clear draft
      localStorage.removeItem(`invoice_draft_${orgId}`);
      router.push(`/org/${orgId}/erp/invoices`);
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      setError(err.message || 'Erreur lors de la création de la facture');
    } finally {
      setSaving(false);
    }
  }

  const nextStep = () => {
    if (currentStep === 1 && !clientId) {
      setError('Veuillez sélectionner un client');
      return;
    }
    setError(null);
    setCurrentStep(curr => Math.min(curr + 1, 3));
  };

  const prevStep = () => setCurrentStep(curr => Math.max(curr - 1, 1));

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      {/* Header & Steps */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-8 w-8 text-blue-600" />
              Nouvelle Facture
            </h1>
            <p className="text-gray-500 mt-1">Créez une facture en 3 étapes simples</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {restored && <span className="flex items-center gap-1 text-green-600"><RotateCcw className="w-3 h-3" /> Brouillon restauré</span>}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="relative flex justify-between items-center w-full max-w-2xl mx-auto">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-10"></div>
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 animate-in slide-in-from-top-2">
          <p className="text-red-700 dark:text-red-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[400px] p-8 relative overflow-hidden">

        {/* Step 1: Client & Infos */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="client" className="text-base font-semibold">Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.company_name && `- ${client.company_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Sélectionnez le destinataire de la facture</span>
                  <Link href={`/org/${orgId}/erp/clients?action=new`} className="text-blue-600 hover:underline">+ Nouveau client</Link>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="reference" className="text-base font-semibold flex justify-between">
                  Référence
                  {reference && <span className="text-xs font-normal text-blue-600 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Généré par IA</span>}
                </Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                  placeholder="Ex: FACT-2024-001"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="invoiceDate" className="text-base font-semibold">Date d'émission</Label>
                <DateInput
                  id="invoiceDate"
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="dueDate" className="text-base font-semibold">Date d'échéance</Label>
                <DateInput
                  id="dueDate"
                  value={dueDate}
                  onChange={setDueDate}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Lignes */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Articles & Services</h3>
              <Button onClick={addLine} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="p-3 text-left font-medium text-gray-500">Description</th>
                    <th className="p-3 text-right font-medium text-gray-500 w-24">Qté</th>
                    <th className="p-3 text-right font-medium text-gray-500 w-32">Prix HT</th>
                    <th className="p-3 text-right font-medium text-gray-500 w-24">TVA</th>
                    <th className="p-3 text-right font-medium text-gray-500 w-32">Total HT</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lines.map((line) => (
                    <tr key={line.id} className="group hover:bg-gray-50 dark:hover:bg-gray-900/20">
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <Select value={line.product_id || 'none'} onValueChange={(v) => v !== 'none' && selectProduct(line.id, v)}>
                            <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs text-gray-500 focus:ring-0 w-fit">
                              <SelectValue placeholder="Sélectionner un produit (optionnel)" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                            className="h-9 border-0 bg-transparent p-0 focus-visible:ring-0 font-medium placeholder:font-normal"
                            placeholder="Description de la prestation..."
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <Input type="number" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })} className="text-right h-9" />
                      </td>
                      <td className="p-2">
                        <Input type="number" value={line.unit_price} onChange={(e) => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })} className="text-right h-9" />
                      </td>
                      <td className="p-2">
                        <Select value={line.vat_rate.toString()} onValueChange={(v) => updateLine(line.id, { vat_rate: parseFloat(v) })}>
                          <SelectTrigger className="h-9 text-right justify-end"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[0, 5.5, 10, 20].map(rate => <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(line.total_ht)}
                      </td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total HT</span>
                  <span className="font-medium">{formatCurrency(subtotalHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA</span>
                  <span className="font-medium">{formatCurrency(totalVAT)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>Total TTC</span>
                  <span className="text-blue-600">{formatCurrency(totalTTC)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Finalisation */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Conditions & Notes</h3>
                <div className="space-y-3">
                  <Label htmlFor="paymentTerms">Conditions de paiement</Label>
                  <Input id="paymentTerms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="notes">Notes (visible sur la facture)</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Résumé</h3>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 space-y-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm text-gray-500">Client</p>
                      <p className="font-medium">{clients.find(c => c.id === clientId)?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium">{new Date(invoiceDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Nombre de lignes</span>
                      <span>{lines.length}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2">
                      <span>Total à payer</span>
                      <span className="text-blue-600">{formatCurrency(totalTTC)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={currentStep === 1 ? () => router.back() : prevStep} disabled={saving}>
          {currentStep === 1 ? 'Annuler' : 'Précédent'}
        </Button>

        <div className="flex gap-3">
          {currentStep < 3 ? (
            <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 text-white">
              Suivant <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving ? 'Création...' : 'Créer la facture'} <CheckCircle className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
