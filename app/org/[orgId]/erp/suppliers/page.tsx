'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  MapPin,
  Home,
  ChevronRight
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
  siren?: string;
  siret?: string;
  naf_code?: string;
  activite?: string;
  mode_reglement?: string;
  delai_paiement?: number;
  iban?: string;
  bic?: string;
  banque?: string;
  notes?: string;
  total_purchased: number;
  total_outstanding: number;
  invoice_count: number;
  created_at: string;
}

const MODES_REGLEMENT = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'especes', label: 'Espèces' },
  { value: 'prelevement', label: 'Prélèvement automatique' },
  { value: 'lcr', label: 'LCR' },
  { value: 'traite', label: 'Traite' },
];

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
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const actionParam = searchParams.get('action');

  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(actionParam === 'new');
  const [saving, setSaving] = useState(false);

  // Open dialog when action=new is in URL
  useEffect(() => {
    if (actionParam === 'new') {
      setDialogOpen(true);
    }
  }, [actionParam]);

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
    siren: '',
    siret: '',
    naf_code: '',
    activite: '',
    mode_reglement: 'virement',
    delai_paiement: 30,
    iban: '',
    bic: '',
    banque: '',
    notes: '',
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
      setNewSupplier({
        name: '', email: '', phone: '', company_name: '', address: '', city: '', postal_code: '', vat_number: '',
        siren: '', siret: '', naf_code: '', activite: '', mode_reglement: 'virement', delai_paiement: 30,
        iban: '', bic: '', banque: '', notes: ''
      });
      fetchSuppliers();
    } catch (err) {
      console.error('Error creating supplier:', err);
    } finally {
      setSaving(false);
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
        <span className="font-medium text-gray-900 dark:text-white">Fournisseurs</span>
      </nav>

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
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateSupplier}>
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white">Nouveau fournisseur</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400">
                  Ajoutez un nouveau fournisseur à votre carnet
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="general" className="mt-4">
                <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-700">
                  <TabsTrigger value="general" className="text-gray-700 dark:text-gray-300">Général</TabsTrigger>
                  <TabsTrigger value="legal" className="text-gray-700 dark:text-gray-300">Légal</TabsTrigger>
                  <TabsTrigger value="bank" className="text-gray-700 dark:text-gray-300">Bancaire</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Nom du contact *</Label>
                    <Input
                      id="name"
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      placeholder="Jean Dupont"
                      required
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company" className="text-gray-700 dark:text-gray-300">Raison sociale</Label>
                    <Input
                      id="company"
                      value={newSupplier.company_name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, company_name: e.target.value })}
                      placeholder="Entreprise SAS"
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
                    <Label htmlFor="address" className="text-gray-700 dark:text-gray-300">Adresse</Label>
                    <Input
                      id="address"
                      value={newSupplier.address}
                      onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                      placeholder="123 rue du Commerce"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="postal_code" className="text-gray-700 dark:text-gray-300">Code postal</Label>
                      <Input
                        id="postal_code"
                        value={newSupplier.postal_code}
                        onChange={(e) => setNewSupplier({ ...newSupplier, postal_code: e.target.value })}
                        placeholder="75001"
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city" className="text-gray-700 dark:text-gray-300">Ville</Label>
                      <Input
                        id="city"
                        value={newSupplier.city}
                        onChange={(e) => setNewSupplier({ ...newSupplier, city: e.target.value })}
                        placeholder="Paris"
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes" className="text-gray-700 dark:text-gray-300">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newSupplier.notes}
                      onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                      placeholder="Notes sur le fournisseur..."
                      rows={2}
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="legal" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="siren" className="text-gray-700 dark:text-gray-300">SIREN</Label>
                      <Input
                        id="siren"
                        value={newSupplier.siren}
                        onChange={(e) => setNewSupplier({ ...newSupplier, siren: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                        placeholder="123456789"
                        maxLength={9}
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="siret" className="text-gray-700 dark:text-gray-300">SIRET</Label>
                      <Input
                        id="siret"
                        value={newSupplier.siret}
                        onChange={(e) => setNewSupplier({ ...newSupplier, siret: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                        placeholder="12345678900001"
                        maxLength={14}
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vat" className="text-gray-700 dark:text-gray-300">N° TVA intracommunautaire</Label>
                      <Input
                        id="vat"
                        value={newSupplier.vat_number}
                        onChange={(e) => setNewSupplier({ ...newSupplier, vat_number: e.target.value })}
                        placeholder="FR12345678901"
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="naf" className="text-gray-700 dark:text-gray-300">Code NAF/APE</Label>
                      <Input
                        id="naf"
                        value={newSupplier.naf_code}
                        onChange={(e) => setNewSupplier({ ...newSupplier, naf_code: e.target.value })}
                        placeholder="6201Z"
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="activite" className="text-gray-700 dark:text-gray-300">Activité</Label>
                    <Input
                      id="activite"
                      value={newSupplier.activite}
                      onChange={(e) => setNewSupplier({ ...newSupplier, activite: e.target.value })}
                      placeholder="Programmation informatique"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mode_reglement" className="text-gray-700 dark:text-gray-300">Mode de règlement</Label>
                      <Select value={newSupplier.mode_reglement} onValueChange={(v) => setNewSupplier({ ...newSupplier, mode_reglement: v })}>
                        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          {MODES_REGLEMENT.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value} className="text-gray-900 dark:text-white">
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="delai" className="text-gray-700 dark:text-gray-300">Délai de paiement (jours)</Label>
                      <Input
                        id="delai"
                        type="number"
                        min={0}
                        value={newSupplier.delai_paiement}
                        onChange={(e) => setNewSupplier({ ...newSupplier, delai_paiement: parseInt(e.target.value) || 30 })}
                        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="bank" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="banque" className="text-gray-700 dark:text-gray-300">Banque</Label>
                    <Input
                      id="banque"
                      value={newSupplier.banque}
                      onChange={(e) => setNewSupplier({ ...newSupplier, banque: e.target.value })}
                      placeholder="BNP Paribas"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="iban" className="text-gray-700 dark:text-gray-300">IBAN</Label>
                    <Input
                      id="iban"
                      value={newSupplier.iban}
                      onChange={(e) => setNewSupplier({ ...newSupplier, iban: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                      placeholder="FR7630004000031234567890143"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bic" className="text-gray-700 dark:text-gray-300">BIC/SWIFT</Label>
                    <Input
                      id="bic"
                      value={newSupplier.bic}
                      onChange={(e) => setNewSupplier({ ...newSupplier, bic: e.target.value.toUpperCase() })}
                      placeholder="BNPAFRPP"
                      maxLength={11}
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
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
