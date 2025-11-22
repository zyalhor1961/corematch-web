'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Plus,
  Search,
  Mail,
  Phone,
  ArrowLeft,
  FileText,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  vat_number?: string;
  payment_terms?: number;
  total_purchased: number;
  total_outstanding: number;
  invoice_count: number;
  created_at: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SuppliersPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New supplier form
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    city: '',
    postal_code: '',
    vat_number: '',
  });

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/erp/suppliers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch suppliers');

      const json = await res.json();
      if (json.success) {
        setSuppliers(json.data.suppliers || []);
        setTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchSuppliers();
  }

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/erp/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });

      if (!res.ok) throw new Error('Failed to create supplier');

      setDialogOpen(false);
      setNewSupplier({ name: '', email: '', phone: '', company_name: '', address: '', city: '', postal_code: '', vat_number: '' });
      fetchSuppliers();
    } catch (err) {
      console.error('Error creating supplier:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Link href={`/org/${orgId}/erp`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Building2 className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              Fournisseurs
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{total} fournisseur{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau fournisseur
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <form onSubmit={handleCreateSupplier}>
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white">Nouveau fournisseur</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400">
                  Ajoutez un nouveau fournisseur à votre carnet
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Nom *</Label>
                  <Input
                    id="name"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="Nom du contact"
                    required
                    className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company" className="text-gray-700 dark:text-gray-300">Entreprise</Label>
                  <Input
                    id="company"
                    value={newSupplier.company_name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, company_name: e.target.value })}
                    placeholder="Nom de l'entreprise"
                    className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="contact@fournisseur.com"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300">Téléphone</Label>
                    <Input
                      id="phone"
                      value={newSupplier.phone}
                      onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                      placeholder="+33 1 23 45 67 89"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vat" className="text-gray-700 dark:text-gray-300">N° TVA</Label>
                  <Input
                    id="vat"
                    value={newSupplier.vat_number}
                    onChange={(e) => setNewSupplier({ ...newSupplier, vat_number: e.target.value })}
                    placeholder="FR12345678901"
                    className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                  Annuler
                </Button>
                <Button type="submit" disabled={saving || !newSupplier.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? 'Création...' : 'Créer le fournisseur'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
          </div>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Rechercher</Button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total acheté</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(suppliers.reduce((sum, s) => sum + (s.total_purchased || 0), 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">À payer</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(suppliers.reduce((sum, s) => sum + (s.total_outstanding || 0), 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Factures reçues</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {suppliers.reduce((sum, s) => sum + (s.invoice_count || 0), 0)}
          </p>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucun fournisseur</h3>
            <p className="text-gray-600 dark:text-gray-400">Commencez par ajouter votre premier fournisseur</p>
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau fournisseur
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Fournisseur</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Contact</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Total acheté</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">À payer</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Factures</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{supplier.name}</div>
                        {supplier.company_name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {supplier.company_name}
                          </div>
                        )}
                        {supplier.vat_number && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">TVA: {supplier.vat_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {supplier.email && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            {supplier.email}
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.city && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {supplier.city}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(supplier.total_purchased || 0)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(supplier.total_outstanding || 0) > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          {formatCurrency(supplier.total_outstanding)}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                      {supplier.invoice_count || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" asChild className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Link href={`/org/${orgId}/erp/expenses?supplier_id=${supplier.id}`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
