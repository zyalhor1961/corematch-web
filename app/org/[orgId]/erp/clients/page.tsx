'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import PageContainer from '@/components/ui/PageContainer';
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
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  category?: string;
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
  total_invoiced: number;
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


export default function ClientsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const actionParam = searchParams.get('action');

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
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

  // New client form
  const [newClient, setNewClient] = useState({
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

  async function fetchClients() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/erp/clients?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch clients');

      const json = await res.json();
      if (json.success) {
        setClients(json.data.clients || []);
        setTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchClients();
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClient.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/erp/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });

      if (!res.ok) throw new Error('Failed to create client');

      setDialogOpen(false);
      setNewClient({
        name: '', email: '', phone: '', company_name: '', address: '', city: '', postal_code: '', vat_number: '',
        siren: '', siret: '', naf_code: '', activite: '', mode_reglement: 'virement', delai_paiement: 30,
        iban: '', bic: '', banque: '', notes: ''
      });
      fetchClients();
    } catch (err) {
      console.error('Error creating client:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer
      title="Clients"
      breadcrumbs={[
        { label: 'ERP', href: `/org/${orgId}/erp` },
        { label: 'Clients' }
      ]}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateClient}>
              <DialogHeader>
                <DialogTitle className="text-white">Nouveau client</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Ajoutez un nouveau client à votre carnet d'adresses
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="general" className="mt-4">
                <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                  <TabsTrigger value="general" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Général</TabsTrigger>
                  <TabsTrigger value="legal" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Légal</TabsTrigger>
                  <TabsTrigger value="bank" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Bancaire</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-slate-300">Nom du contact *</Label>
                    <Input
                      id="name"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      placeholder="Jean Dupont"
                      required
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company" className="text-slate-300">Raison sociale</Label>
                    <Input
                      id="company"
                      value={newClient.company_name}
                      onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                      placeholder="Entreprise SAS"
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-slate-300">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        placeholder="contact@client.com"
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone" className="text-slate-300">Téléphone</Label>
                      <Input
                        id="phone"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        placeholder="+33 6 12 34 56 78"
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address" className="text-slate-300">Adresse</Label>
                    <Input
                      id="address"
                      value={newClient.address}
                      onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                      placeholder="123 rue du Commerce"
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="postal_code" className="text-slate-300">Code postal</Label>
                      <Input
                        id="postal_code"
                        value={newClient.postal_code}
                        onChange={(e) => setNewClient({ ...newClient, postal_code: e.target.value })}
                        placeholder="75001"
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city" className="text-slate-300">Ville</Label>
                      <Input
                        id="city"
                        value={newClient.city}
                        onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                        placeholder="Paris"
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes" className="text-slate-300">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newClient.notes}
                      onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                      placeholder="Notes sur le client..."
                      rows={2}
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="legal" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="siren" className="text-slate-300">SIREN</Label>
                      <Input
                        id="siren"
                        value={newClient.siren}
                        onChange={(e) => setNewClient({ ...newClient, siren: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                        placeholder="123456789"
                        maxLength={9}
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="siret" className="text-slate-300">SIRET</Label>
                      <Input
                        id="siret"
                        value={newClient.siret}
                        onChange={(e) => setNewClient({ ...newClient, siret: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                        placeholder="12345678900001"
                        maxLength={14}
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vat" className="text-slate-300">N° TVA intracommunautaire</Label>
                      <Input
                        id="vat"
                        value={newClient.vat_number}
                        onChange={(e) => setNewClient({ ...newClient, vat_number: e.target.value })}
                        placeholder="FR12345678901"
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="naf" className="text-slate-300">Code NAF/APE</Label>
                      <Input
                        id="naf"
                        value={newClient.naf_code}
                        onChange={(e) => setNewClient({ ...newClient, naf_code: e.target.value })}
                        placeholder="6201Z"
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="activite" className="text-slate-300">Activité</Label>
                    <Input
                      id="activite"
                      value={newClient.activite}
                      onChange={(e) => setNewClient({ ...newClient, activite: e.target.value })}
                      placeholder="Programmation informatique"
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mode_reglement" className="text-slate-300">Mode de règlement</Label>
                      <Select value={newClient.mode_reglement} onValueChange={(v) => setNewClient({ ...newClient, mode_reglement: v })}>
                        <SelectTrigger className="bg-slate-800/50 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                          {MODES_REGLEMENT.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value} className="text-white hover:bg-slate-800">
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="delai" className="text-slate-300">Délai de paiement (jours)</Label>
                      <Input
                        id="delai"
                        type="number"
                        min={0}
                        value={newClient.delai_paiement}
                        onChange={(e) => setNewClient({ ...newClient, delai_paiement: parseInt(e.target.value) || 30 })}
                        className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="bank" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="banque" className="text-slate-300">Banque</Label>
                    <Input
                      id="banque"
                      value={newClient.banque}
                      onChange={(e) => setNewClient({ ...newClient, banque: e.target.value })}
                      placeholder="BNP Paribas"
                      className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="iban" className="text-slate-300">IBAN</Label>
                    <Input
                      id="iban"
                      value={newClient.iban}
                      onChange={(e) => setNewClient({ ...newClient, iban: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                      placeholder="FR7630004000031234567890143"
                      className="bg-slate-800/50 border-white/10 text-white font-mono placeholder:text-slate-600"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bic" className="text-slate-300">BIC/SWIFT</Label>
                    <Input
                      id="bic"
                      value={newClient.bic}
                      onChange={(e) => setNewClient({ ...newClient, bic: e.target.value.toUpperCase() })}
                      placeholder="BNPAFRPP"
                      maxLength={11}
                      className="bg-slate-800/50 border-white/10 text-white font-mono placeholder:text-slate-600"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                  Annuler
                </Button>
                <Button type="submit" disabled={saving || !newClient.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? 'Création...' : 'Créer le client'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Search */}
        <div className="bg-slate-900/40 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Rechercher</Button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
            <p className="text-sm font-medium text-slate-400 mb-2">Total facturé</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(clients.reduce((sum, c) => sum + (c.total_invoiced || 0), 0))}
            </p>
          </div>
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
            <p className="text-sm font-medium text-slate-400 mb-2">Impayés</p>
            <p className="text-2xl font-bold text-orange-400">
              {formatCurrency(clients.reduce((sum, c) => sum + (c.total_outstanding || 0), 0))}
            </p>
          </div>
          <div className="bg-slate-900/40 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
            <p className="text-sm font-medium text-slate-400 mb-2">Factures émises</p>
            <p className="text-2xl font-bold text-white">
              {clients.reduce((sum, c) => sum + (c.invoice_count || 0), 0)}
            </p>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-slate-900/40 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full bg-slate-800" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-slate-600" />
              <h3 className="mt-4 text-lg font-semibold text-white">Aucun client</h3>
              <p className="text-slate-400">Commencez par ajouter votre premier client</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau client
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Client</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Contact</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Total facturé</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Impayés</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Factures</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-white">{client.name}</div>
                          {client.company_name && (
                            <div className="text-sm text-slate-400 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {client.company_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="text-sm text-slate-300 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-500" />
                              {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="text-sm text-slate-300 flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-500" />
                              {client.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-white">{formatCurrency(client.total_invoiced || 0)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(client.total_outstanding || 0) > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            {formatCurrency(client.total_outstanding)}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-white">
                        {client.invoice_count || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:bg-white/10 hover:text-white">
                          <Link href={`/org/${orgId}/erp/invoices?client_id=${client.id}`}>
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
    </PageContainer>
  );
}
