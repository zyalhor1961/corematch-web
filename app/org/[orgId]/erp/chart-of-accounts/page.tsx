'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Building2,
  FileText,
  Package,
  Users,
  Wallet,
  TrendingDown,
  TrendingUp,
  Lock,
  Unlock,
} from 'lucide-react';

interface Account {
  id: string;
  code: string;
  label: string;
  account_type: string;
  category: string;
  parent_code?: string;
  level: number;
  is_system: boolean;
  is_active?: boolean;
}

interface ClassData {
  label: string;
  accounts: Account[];
}

const CLASS_ICONS: Record<string, any> = {
  '1': Building2,
  '2': FileText,
  '3': Package,
  '4': Users,
  '5': Wallet,
  '6': TrendingDown,
  '7': TrendingUp,
};

const CLASS_COLORS: Record<string, string> = {
  '1': 'bg-purple-500/10 text-purple-500',
  '2': 'bg-blue-500/10 text-blue-500',
  '3': 'bg-orange-500/10 text-orange-500',
  '4': 'bg-green-500/10 text-green-500',
  '5': 'bg-cyan-500/10 text-cyan-500',
  '6': 'bg-red-500/10 text-red-500',
  '7': 'bg-emerald-500/10 text-emerald-500',
};

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Actif' },
  { value: 'liability', label: 'Passif' },
  { value: 'equity', label: 'Capitaux propres' },
  { value: 'revenue', label: 'Produit' },
  { value: 'expense', label: 'Charge' },
];

export default function ChartOfAccountsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [byClass, setByClass] = useState<Record<string, ClassData>>({});
  const [stats, setStats] = useState({ total: 0, system: 0, custom: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [showCustomOnly, setShowCustomOnly] = useState(false);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form state
  const [newAccount, setNewAccount] = useState({
    code: '',
    label: '',
    account_type: 'expense',
    category: 'other',
    parent_code: '',
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ org_id: orgId });
      if (searchQuery) params.append('search', searchQuery);
      if (selectedClass !== 'all') params.append('class', selectedClass);
      if (showCustomOnly) params.append('custom_only', 'true');

      const response = await fetch(`/api/erp/chart-of-accounts?${params}`);
      const result = await response.json();

      if (result.success) {
        setAccounts(result.data.accounts);
        setByClass(result.data.by_class);
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [orgId, searchQuery, selectedClass, showCustomOnly]);

  const handleCreateAccount = async () => {
    try {
      const response = await fetch('/api/erp/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...newAccount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsAddDialogOpen(false);
        setNewAccount({ code: '', label: '', account_type: 'expense', category: 'other', parent_code: '' });
        fetchAccounts();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount) return;

    try {
      const response = await fetch('/api/erp/chart-of-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAccount.id,
          org_id: orgId,
          label: editingAccount.label,
          category: editingAccount.category,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsEditDialogOpen(false);
        setEditingAccount(null);
        fetchAccounts();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Error updating account:', error);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (!confirm(`Supprimer le compte ${account.code} - ${account.label} ?`)) return;

    try {
      const response = await fetch(
        `/api/erp/chart-of-accounts?id=${account.id}&org_id=${orgId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (result.success) {
        fetchAccounts();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const handleInitializePCG = async () => {
    if (!confirm('Initialiser le Plan Comptable Général 2025 ? Cette action ajoutera ~387 comptes standards.')) return;

    try {
      const response = await fetch('/api/erp/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          action: 'initialize_pcg',
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(result.message);
        fetchAccounts();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Error initializing PCG:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Plan Comptable</h1>
          <p className="text-muted-foreground">
            Plan Comptable Général 2025 (PCG) - Gestion des comptes
          </p>
        </div>
        <div className="flex gap-2">
          {stats.total === 0 && (
            <Button onClick={handleInitializePCG} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Initialiser PCG 2025
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau compte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un compte personnalisé</DialogTitle>
                <DialogDescription>
                  Ajoutez un compte auxiliaire au Plan Comptable
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code compte *</Label>
                    <Input
                      id="code"
                      placeholder="Ex: 411001"
                      value={newAccount.code}
                      onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent">Compte parent</Label>
                    <Input
                      id="parent"
                      placeholder="Ex: 411"
                      value={newAccount.parent_code}
                      onChange={(e) => setNewAccount({ ...newAccount, parent_code: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Libellé *</Label>
                  <Input
                    id="label"
                    placeholder="Ex: Client DUPONT SA"
                    value={newAccount.label}
                    onChange={(e) => setNewAccount({ ...newAccount, label: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type de compte *</Label>
                  <Select
                    value={newAccount.account_type}
                    onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateAccount}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total comptes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comptes PCG (système)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {stats.system}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comptes personnalisés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Unlock className="h-4 w-4 text-muted-foreground" />
              {stats.custom}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un compte..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                <SelectItem value="1">Classe 1 - Capitaux</SelectItem>
                <SelectItem value="2">Classe 2 - Immobilisations</SelectItem>
                <SelectItem value="3">Classe 3 - Stocks</SelectItem>
                <SelectItem value="4">Classe 4 - Tiers</SelectItem>
                <SelectItem value="5">Classe 5 - Financiers</SelectItem>
                <SelectItem value="6">Classe 6 - Charges</SelectItem>
                <SelectItem value="7">Classe 7 - Produits</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showCustomOnly ? 'default' : 'outline'}
              onClick={() => setShowCustomOnly(!showCustomOnly)}
            >
              Personnalisés uniquement
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts by Class */}
      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Chargement...
          </CardContent>
        </Card>
      ) : stats.total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-4">
              Aucun compte trouvé. Initialisez le Plan Comptable Général 2025.
            </p>
            <Button onClick={handleInitializePCG}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Initialiser PCG 2025
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={['4', '5', '6', '7']} className="space-y-2">
          {Object.entries(byClass)
            .filter(([_, data]) => data.accounts.length > 0)
            .map(([classNum, data]) => {
              const Icon = CLASS_ICONS[classNum] || FileText;
              return (
                <AccordionItem key={classNum} value={classNum} className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${CLASS_COLORS[classNum]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Classe {classNum}</div>
                        <div className="text-sm text-muted-foreground">{data.label}</div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {data.accounts.length} comptes
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Code</TableHead>
                            <TableHead>Libellé</TableHead>
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="w-[80px]">Statut</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.accounts.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell className="font-mono font-medium">
                                {account.code}
                              </TableCell>
                              <TableCell>
                                <span style={{ paddingLeft: `${(account.level - 1) * 16}px` }}>
                                  {account.label}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {account.account_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {account.is_system ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    PCG
                                  </Badge>
                                ) : (
                                  <Badge variant="default" className="text-xs">
                                    Perso
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!account.is_system && (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setEditingAccount(account);
                                        setIsEditDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => handleDeleteAccount(account)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
        </Accordion>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le compte</DialogTitle>
            <DialogDescription>
              {editingAccount?.code} - Compte personnalisé
            </DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-label">Libellé</Label>
                <Input
                  id="edit-label"
                  value={editingAccount.label}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, label: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateAccount}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
