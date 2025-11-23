'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Home,
  ChevronRight,
  Calculator,
  Building2,
} from 'lucide-react';
import Link from 'next/link';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  company_name?: string;
}

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
}

const VAT_RATES = [
  { value: 0, label: '0%' },
  { value: 5.5, label: '5,5%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function NewPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice lines
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: 20,
      total_ht: 0,
      total_tva: 0,
      total_ttc: 0,
    },
  ]);

  // Totals
  const totals = lines.reduce(
    (acc, line) => ({
      total_ht: acc.total_ht + line.total_ht,
      total_tva: acc.total_tva + line.total_tva,
      total_ttc: acc.total_ttc + line.total_ttc,
    }),
    { total_ht: 0, total_tva: 0, total_ttc: 0 }
  );

  // Fetch suppliers
  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const res = await fetch(`/api/erp/suppliers?org_id=${orgId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setSuppliers(json.data.suppliers || []);
          }
        }
      } catch (err) {
        console.error('Error fetching suppliers:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    }
    fetchSuppliers();
  }, [orgId]);

  // Calculate line totals
  function calculateLine(line: InvoiceLine): InvoiceLine {
    const total_ht = line.quantity * line.unit_price;
    const total_tva = total_ht * (line.vat_rate / 100);
    const total_ttc = total_ht + total_tva;
    return { ...line, total_ht, total_tva, total_ttc };
  }

  function updateLine(id: string, field: keyof InvoiceLine, value: any) {
    setLines(
      lines.map((line) => {
        if (line.id === id) {
          const updated = { ...line, [field]: value };
          return calculateLine(updated);
        }
        return line;
      })
    );
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: String(Date.now()),
        description: '',
        quantity: 1,
        unit_price: 0,
        vat_rate: 20,
        total_ht: 0,
        total_tva: 0,
        total_ttc: 0,
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== id));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!supplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    if (lines.every((l) => l.total_ht === 0)) {
      alert('Veuillez saisir au moins une ligne de facture');
      return;
    }

    setLoading(true);

    try {
      // Create the purchase invoice
      const res = await fetch('/api/erp/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          supplier_id: supplierId,
          invoice_number: invoiceNumber || undefined,
          invoice_date: invoiceDate,
          due_date: dueDate,
          total_ht: totals.total_ht,
          total_tva: totals.total_tva,
          total_ttc: totals.total_ttc,
          notes,
          reference,
          lines: lines.filter((l) => l.description || l.total_ht > 0),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      router.push(`/org/${orgId}/erp/purchases`);
    } catch (err: any) {
      console.error('Error creating purchase:', err);
      alert(err.message || 'Erreur lors de la création de la facture');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={`/org/${orgId}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <Home className="h-4 w-4" />
          <span>Accueil</span>
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link href={`/org/${orgId}/erp`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          ERP
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link href={`/org/${orgId}/erp/purchases`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          Achats
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">Nouvelle facture</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Link href={`/org/${orgId}/erp/purchases`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <ShoppingCart className="h-8 w-8 text-pink-600 dark:text-pink-400" />
            Saisir une facture fournisseur
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Enregistrez une facture d'achat</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Informations générales
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="supplier">Fournisseur *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Sélectionner un fournisseur" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {loadingSuppliers ? (
                    <SelectItem value="loading" disabled className="text-gray-500">
                      Chargement...
                    </SelectItem>
                  ) : suppliers.length === 0 ? (
                    <SelectItem value="none" disabled className="text-gray-500">
                      Aucun fournisseur
                    </SelectItem>
                  ) : (
                    suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id} className="text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {supplier.name}
                          {supplier.company_name && ` (${supplier.company_name})`}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && !loadingSuppliers && (
                <Link
                  href={`/org/${orgId}/erp/suppliers?action=new`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Créer un fournisseur
                </Link>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">N° Facture fournisseur</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="FAC-2024-001"
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Référence / Commande</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="BC-2024-001"
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
                    #
                  </th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    Description
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">
                    Qté
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-32">
                    Prix unitaire
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-28">
                    TVA
                  </th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-28">
                    Total HT
                  </th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-28">
                    Total TTC
                  </th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{index + 1}</td>
                    <td className="py-2 px-2">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                        placeholder="Description du produit/service"
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="text-center bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="text-center bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={String(line.vat_rate)}
                        onValueChange={(v) => updateLine(line.id, 'vat_rate', parseFloat(v))}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          {VAT_RATES.map((rate) => (
                            <SelectItem key={rate.value} value={String(rate.value)} className="text-gray-900 dark:text-white">
                              {rate.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(line.total_ht)}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(line.total_ttc)}
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
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
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total HT</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.total_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">TVA</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(totals.total_tva)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="text-gray-900 dark:text-white">Total TTC</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totals.total_ttc)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Notes</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes internes sur cette facture..."
            rows={3}
            className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/org/${orgId}/erp/purchases`)}
            className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={loading || !supplierId}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>Enregistrement...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer la facture
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
