'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  Home,
  ChevronRight,
  CreditCard,
  Hash,
  Calendar,
  Banknote
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  iban?: string;
  bic?: string;
  banque?: string;
  notes?: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  total_ttc: number;
  status: string;
  vendor_name?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

export default function SupplierDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const supplierId = params.supplierId as string;

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch supplier
        const { data: supplierData, error: supplierError } = await supabase
          .from('erp_suppliers')
          .select('*')
          .eq('id', supplierId)
          .single();

        if (supplierError) throw supplierError;
        setSupplier(supplierData);

        // Fetch linked invoices
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date, due_date, total_ttc, status, vendor_name')
          .eq('supplier_id', supplierId)
          .order('invoice_date', { ascending: false });

        setInvoices(invoicesData || []);
      } catch (err) {
        console.error('Error fetching supplier:', err);
      } finally {
        setLoading(false);
      }
    }

    if (supplierId) {
      fetchData();
    }
  }, [supplierId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64 bg-gray-200 dark:bg-gray-700" />
        <Skeleton className="h-64 w-full bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Fournisseur non trouvé</h3>
          <Button asChild className="mt-4">
            <Link href={`/org/${orgId}/erp/suppliers`}>Retour aux fournisseurs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalPurchased = invoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link href={`/org/${orgId}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <Home className="h-4 w-4" />
          <span>Accueil</span>
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link href={`/org/${orgId}/erp/suppliers`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          Fournisseurs
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">{supplier.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="text-gray-600 dark:text-gray-400">
          <Link href={`/org/${orgId}/erp/suppliers`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Building2 className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            {supplier.name}
          </h1>
          {supplier.company_name && (
            <p className="text-gray-600 dark:text-gray-400">{supplier.company_name}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total acheté</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalPurchased)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Factures</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{invoices.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Depuis</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDate(supplier.created_at)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Supplier Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            Informations
          </h2>

          <div className="space-y-3">
            {supplier.email && (
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Mail className="h-4 w-4 text-gray-500" />
                <a href={`mailto:${supplier.email}`} className="hover:underline">{supplier.email}</a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <Phone className="h-4 w-4 text-gray-500" />
                <a href={`tel:${supplier.phone}`} className="hover:underline">{supplier.phone}</a>
              </div>
            )}
            {(supplier.address || supplier.city) && (
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span>{[supplier.address, supplier.postal_code, supplier.city].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Legal Info */}
          {(supplier.siren || supplier.siret || supplier.vat_number) && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase">Informations légales</h3>
              <div className="space-y-2">
                {supplier.siren && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <span>SIREN: <span className="font-mono">{supplier.siren}</span></span>
                  </div>
                )}
                {supplier.siret && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <span>SIRET: <span className="font-mono">{supplier.siret}</span></span>
                  </div>
                )}
                {supplier.vat_number && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    <span>TVA: <span className="font-mono">{supplier.vat_number}</span></span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bank Info */}
          {(supplier.iban || supplier.banque) && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase">Coordonnées bancaires</h3>
              <div className="space-y-2">
                {supplier.banque && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Banknote className="h-4 w-4 text-gray-500" />
                    <span>{supplier.banque}</span>
                  </div>
                )}
                {supplier.iban && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    <span className="font-mono text-sm">{supplier.iban}</span>
                  </div>
                )}
                {supplier.bic && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <span>BIC: <span className="font-mono">{supplier.bic}</span></span>
                  </div>
                )}
              </div>
            </>
          )}

          {supplier.notes && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase">Notes</h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{supplier.notes}</p>
            </>
          )}
        </div>

        {/* Invoices */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-500" />
            Factures ({invoices.length})
          </h2>

          {invoices.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune facture liée</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/org/${orgId}/erp/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(invoice.total_ttc || 0)}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      invoice.status === 'APPROVED' || invoice.status === 'PAID'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : invoice.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
