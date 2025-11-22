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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Receipt,
  Plus,
  ArrowLeft,
  Filter,
  Home,
  ChevronRight,
  Calendar,
  CreditCard,
  Banknote,
  Building2
} from 'lucide-react';
import Link from 'next/link';

interface Expense {
  id: string;
  description: string;
  amount: number;
  vat_amount: number;
  category: string;
  expense_date: string;
  payment_method?: string;
  reference?: string;
  supplier?: {
    id: string;
    name: string;
    company_name?: string;
  };
}

const categories = [
  { value: 'office', label: 'Fournitures bureau' },
  { value: 'travel', label: 'Déplacements' },
  { value: 'meals', label: 'Repas' },
  { value: 'software', label: 'Logiciels' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'telecom', label: 'Télécom / Internet' },
  { value: 'rent', label: 'Loyer' },
  { value: 'insurance', label: 'Assurance' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Autre' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function getCategoryLabel(value: string): string {
  return categories.find(c => c.value === value)?.label || value;
}

function getCategoryBadge(category: string) {
  const colorMap: Record<string, string> = {
    office: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    travel: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    meals: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    software: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    telecom: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    rent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    insurance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    maintenance: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[category] || colorMap.other}`}>
      {getCategoryLabel(category)}
    </span>
  );
}

export default function ExpensesPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    vat_amount: '',
    category: 'other',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'card',
    reference: '',
  });

  async function fetchExpenses() {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('org_id', orgId);
      if (categoryFilter && categoryFilter !== 'all') {
        urlParams.set('category', categoryFilter);
      }

      const res = await fetch(`/api/erp/expenses?${urlParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch expenses');

      const json = await res.json();
      if (json.success) {
        setExpenses(json.data.expenses || []);
        setTotal(json.data.total || 0);
        setTotalAmount(json.data.total_amount || 0);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchExpenses();
  }, [categoryFilter, orgId]);

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!newExpense.description.trim() || !newExpense.amount) return;

    setSaving(true);
    try {
      const res = await fetch('/api/erp/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          ...newExpense,
          amount: parseFloat(newExpense.amount) || 0,
          vat_amount: parseFloat(newExpense.vat_amount) || 0,
        }),
      });

      if (!res.ok) throw new Error('Failed to create expense');

      setDialogOpen(false);
      setNewExpense({
        description: '',
        amount: '',
        vat_amount: '',
        category: 'other',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'card',
        reference: '',
      });
      fetchExpenses();
    } catch (err) {
      console.error('Error creating expense:', err);
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
        <span className="font-medium text-gray-900 dark:text-white">Dépenses</span>
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
              <Receipt className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              Dépenses
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{total} dépense{total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle dépense
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-lg">
            <form onSubmit={handleCreateExpense}>
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white">Nouvelle dépense</DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400">
                  Enregistrez une nouvelle dépense
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description *</Label>
                  <Input
                    id="description"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    placeholder="Description de la dépense"
                    required
                    className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-gray-700 dark:text-gray-300">Montant TTC *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      placeholder="0.00"
                      required
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vat" className="text-gray-700 dark:text-gray-300">TVA</Label>
                    <Input
                      id="vat"
                      type="number"
                      step="0.01"
                      value={newExpense.vat_amount}
                      onChange={(e) => setNewExpense({ ...newExpense, vat_amount: e.target.value })}
                      placeholder="0.00"
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category" className="text-gray-700 dark:text-gray-300">Catégorie</Label>
                    <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                      <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value} className="text-gray-900 dark:text-white">
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date" className="text-gray-700 dark:text-gray-300">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newExpense.expense_date}
                      onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payment" className="text-gray-700 dark:text-gray-300">Paiement</Label>
                    <Select value={newExpense.payment_method} onValueChange={(v) => setNewExpense({ ...newExpense, payment_method: v })}>
                      <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="card" className="text-gray-900 dark:text-white">Carte bancaire</SelectItem>
                        <SelectItem value="cash" className="text-gray-900 dark:text-white">Espèces</SelectItem>
                        <SelectItem value="transfer" className="text-gray-900 dark:text-white">Virement</SelectItem>
                        <SelectItem value="check" className="text-gray-900 dark:text-white">Chèque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reference" className="text-gray-700 dark:text-gray-300">Référence</Label>
                    <Input
                      id="reference"
                      value={newExpense.reference}
                      onChange={(e) => setNewExpense({ ...newExpense, reference: e.target.value })}
                      placeholder="N° facture, etc."
                      className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                  Annuler
                </Button>
                <Button type="submit" disabled={saving || !newExpense.description.trim() || !newExpense.amount} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? 'Création...' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total dépenses</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Nombre de dépenses</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Moyenne</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(total > 0 ? totalAmount / total : 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Filtrer:</span>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all" className="text-gray-900 dark:text-white">Toutes les catégories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value} className="text-gray-900 dark:text-white">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoryFilter !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCategoryFilter('all')}
              className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Aucune dépense</h3>
            <p className="text-gray-600 dark:text-gray-400">Commencez par enregistrer votre première dépense</p>
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle dépense
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Catégorie</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Fournisseur</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Montant</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">TVA</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDate(expense.expense_date)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{expense.description}</div>
                      {expense.reference && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Réf: {expense.reference}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">{getCategoryBadge(expense.category)}</td>
                    <td className="py-3 px-4">
                      {expense.supplier ? (
                        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          {expense.supplier.name}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                      {expense.vat_amount ? formatCurrency(expense.vat_amount) : '-'}
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
