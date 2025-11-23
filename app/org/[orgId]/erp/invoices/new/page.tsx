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
} from 'lucide-react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email?: string;
  company_name?: string;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

export default function NewInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!clientId) {
      setError('Veuillez sélectionner un client');
      return;
    }

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

      const data = await res.json();
      router.push(`/org/${orgId}/erp/invoices`);
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      setError(err.message || 'Erreur lors de la création de la facture');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href={`/org/${orgId}`}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <Home className="h-4 w-4" />
          <span>Accueil</span>
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link
          href={`/org/${orgId}/erp`}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ERP
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link
          href={`/org/${orgId}/erp/invoices`}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Factures
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">
          Nouvelle facture
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Link href={`/org/${orgId}/erp/invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
            Nouvelle facture
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Créez une nouvelle facture client
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client and dates */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Informations générales
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {clients.map((client) => (
                    <SelectItem
                      key={client.id}
                      value={client.id}
                      className="text-gray-900 dark:text-white"
                    >
                      {client.name}
                      {client.company_name && ` - ${client.company_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && !loadingData && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Link
                    href={`/org/${orgId}/erp/clients?action=new`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Créer un client
                  </Link>{' '}
                  pour commencer
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Référence</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Réf. projet, commande..."
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Date de facture</Label>
              <DateInput
                id="invoiceDate"
                value={invoiceDate}
                onChange={(value) => setInvoiceDate(value)}
                placeholder="jj/mm/aaaa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Date d'échéance</Label>
              <DateInput
                id="dueDate"
                value={dueDate}
                onChange={(value) => setDueDate(value)}
                placeholder="jj/mm/aaaa"
              />
            </div>
          </div>
        </div>

        {/* Invoice lines */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lignes de facture
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une ligne
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-16">
                    Produit
                  </th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Description
                  </th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">
                    Qté
                  </th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-32">
                    Prix unit. HT
                  </th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">
                    TVA %
                  </th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-32">
                    Total HT
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={line.id}
                    className="border-b border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 px-2">
                      <Select
                        value={line.product_id || 'none'}
                        onValueChange={(value) => {
                          if (value !== 'none') {
                            selectProduct(line.id, value);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9 text-sm">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          <SelectItem value="none" className="text-gray-500">
                            Aucun
                          </SelectItem>
                          {products.map((product) => (
                            <SelectItem
                              key={product.id}
                              value={product.id}
                              className="text-gray-900 dark:text-white"
                            >
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.id, { description: e.target.value })
                        }
                        placeholder="Description du service ou produit"
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9 text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, {
                            quantity: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9 text-sm text-right"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) =>
                          updateLine(line.id, {
                            unit_price: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9 text-sm text-right"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={line.vat_rate.toString()}
                        onValueChange={(value) =>
                          updateLine(line.id, { vat_rate: parseFloat(value) })
                        }
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          <SelectItem
                            value="0"
                            className="text-gray-900 dark:text-white"
                          >
                            0%
                          </SelectItem>
                          <SelectItem
                            value="5.5"
                            className="text-gray-900 dark:text-white"
                          >
                            5.5%
                          </SelectItem>
                          <SelectItem
                            value="10"
                            className="text-gray-900 dark:text-white"
                          >
                            10%
                          </SelectItem>
                          <SelectItem
                            value="20"
                            className="text-gray-900 dark:text-white"
                          >
                            20%
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="text-gray-900 dark:text-white font-medium">
                        {formatCurrency(line.total_ht)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                        className="h-8 w-8 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Sous-total HT</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(subtotalHT)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>TVA</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(totalVAT)}
                </span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Total TTC
                </span>
                <span className="font-bold text-lg text-green-600 dark:text-green-400">
                  {formatCurrency(totalTTC)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes and payment terms */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Notes et conditions
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Conditions de paiement</Label>
              <Input
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ex: Paiement à 30 jours"
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes additionnelles pour le client..."
                rows={3}
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            asChild
            className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
          >
            <Link href={`/org/${orgId}/erp/invoices`}>Annuler</Link>
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Création en cours...' : 'Créer la facture'}
          </Button>
        </div>
      </form>
    </div>
  );
}
