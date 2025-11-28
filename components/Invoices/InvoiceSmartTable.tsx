'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
    Search, Download, ChevronDown, ChevronUp, Filter, Columns,
    X, Check, Calendar, Euro, FileText, Building2, Clock
} from 'lucide-react';
import InvoiceDrawer from './InvoiceDrawer';

// Column definition type
interface ColumnDef {
    key: string;
    label: string;
    labelFr: string;
    visible: boolean;
    sortable: boolean;
    type: 'text' | 'date' | 'amount' | 'status' | 'number';
    width?: string;
}

// Invoice type matching unified schema
interface Invoice {
    id: string;
    invoice_number: string;
    vendor_name: string | null;
    client_name: string | null;
    invoice_date: string | null;
    date_issued: string | null;
    due_date: string | null;
    total_ttc: number | null;
    total_amount: number | null;
    subtotal_ht: number | null;
    total_tax: number | null;
    currency: string | null;
    status: string;
    created_at: string;
    supplier_id: string | null;
    supplier_code: string | null;
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    draft: { label: 'Brouillon', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    pending: { label: 'En attente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    approved: { label: 'Validée', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    rejected: { label: 'Rejetée', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    paid: { label: 'Payée', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    overdue: { label: 'En retard', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    disputed: { label: 'Litige', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
};

// Default columns configuration - all visible by default
const DEFAULT_COLUMNS: ColumnDef[] = [
    { key: 'supplier_code', label: 'Code', labelFr: 'Code', visible: true, sortable: true, type: 'text', width: 'w-20' },
    { key: 'vendor_name', label: 'Supplier', labelFr: 'Fournisseur', visible: true, sortable: true, type: 'text' },
    { key: 'invoice_number', label: 'Invoice No.', labelFr: 'N° Facture', visible: true, sortable: true, type: 'text', width: 'w-32' },
    { key: 'invoice_date', label: 'Invoice Date', labelFr: 'Date Facture', visible: true, sortable: true, type: 'date', width: 'w-28' },
    { key: 'due_date', label: 'Due Date', labelFr: 'Échéance', visible: true, sortable: true, type: 'date', width: 'w-28' },
    { key: 'subtotal_ht', label: 'Net Amount', labelFr: 'Montant HT', visible: true, sortable: true, type: 'amount', width: 'w-28' },
    { key: 'total_tax', label: 'Tax', labelFr: 'TVA', visible: true, sortable: true, type: 'amount', width: 'w-24' },
    { key: 'total_ttc', label: 'Total', labelFr: 'Montant TTC', visible: true, sortable: true, type: 'amount', width: 'w-28' },
    { key: 'status', label: 'Status', labelFr: 'Statut', visible: true, sortable: true, type: 'status', width: 'w-28' },
    { key: 'created_at', label: 'Created', labelFr: 'Créée le', visible: true, sortable: true, type: 'date', width: 'w-28' },
];

interface InvoiceSmartTableProps {
    orgId: string;
}

export default function InvoiceSmartTable({ orgId }: InvoiceSmartTableProps) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // State
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

    // Table controls
    const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // UI toggles
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showStatusFilter, setShowStatusFilter] = useState(false);

    // Fetch invoices with supplier code
    useEffect(() => {
        const fetchInvoices = async () => {
            // First, fetch invoices
            const { data, error } = await supabase
                .from('invoices')
                .select('id, invoice_number, vendor_name, client_name, invoice_date, date_issued, due_date, subtotal_ht, total_tax, total_ttc, total_amount, currency, status, created_at, supplier_id')
                .eq('invoice_type', 'inbound')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching invoices:', error);
                setInvoices([]);
                setLoading(false);
                return;
            }

            // Get unique supplier IDs
            const supplierIds = [...new Set((data || []).map(inv => inv.supplier_id).filter(Boolean))];

            // Fetch supplier codes if there are any linked suppliers
            let supplierCodes: Record<string, string> = {};
            if (supplierIds.length > 0) {
                const { data: suppliers } = await supabase
                    .from('erp_suppliers')
                    .select('id, code')
                    .in('id', supplierIds);

                if (suppliers) {
                    supplierCodes = suppliers.reduce((acc, s) => {
                        if (s.code) acc[s.id] = s.code;
                        return acc;
                    }, {} as Record<string, string>);
                }
            }

            // Map supplier code to invoices
            const invoicesWithCode = (data || []).map((inv: any) => ({
                ...inv,
                supplier_code: inv.supplier_id ? supplierCodes[inv.supplier_id] || null : null
            }));

            setInvoices(invoicesWithCode);
            setLoading(false);
        };
        fetchInvoices();
    }, [orgId, supabase]);

    // Filtered data
    const filteredData = useMemo(() => {
        let result = invoices;

        // Search filter (includes supplier code)
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(inv =>
                inv.invoice_number?.toLowerCase().includes(term) ||
                inv.vendor_name?.toLowerCase().includes(term) ||
                inv.client_name?.toLowerCase().includes(term) ||
                inv.supplier_code?.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (statusFilter.length > 0) {
            result = result.filter(inv => statusFilter.includes(inv.status?.toLowerCase()));
        }

        return result;
    }, [invoices, searchTerm, statusFilter]);

    // Sorted data
    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key as keyof Invoice];
            const bVal = b[sortConfig.key as keyof Invoice];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    // Visible columns
    const visibleColumns = columns.filter(col => col.visible);

    // Format cell value
    const formatCell = (invoice: Invoice, column: ColumnDef) => {
        const value = invoice[column.key as keyof Invoice];

        switch (column.type) {
            case 'date':
                if (!value) return <span className="text-slate-600">-</span>;
                return new Date(value as string).toLocaleDateString('fr-FR');

            case 'amount':
                if (value === null || value === undefined) return <span className="text-slate-600">-</span>;
                const currency = invoice.currency || 'EUR';
                const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
                return (
                    <span className="font-mono">
                        {Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbol}
                    </span>
                );

            case 'status':
                const statusKey = (value as string)?.toLowerCase() || 'draft';
                const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${config.bg} ${config.color} border ${config.border}`}>
                        {config.label}
                    </span>
                );

            default:
                if (!value) return <span className="text-slate-600">-</span>;
                // For vendor_name, fallback to client_name
                if (column.key === 'vendor_name') {
                    return invoice.vendor_name || invoice.client_name || '-';
                }
                return String(value);
        }
    };

    // Toggle column visibility
    const toggleColumn = (key: string) => {
        setColumns(prev => prev.map(col =>
            col.key === key ? { ...col, visible: !col.visible } : col
        ));
    };

    // Toggle status filter
    const toggleStatusFilter = (status: string) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    // Handle sort
    const handleSort = (key: string) => {
        const column = columns.find(c => c.key === key);
        if (!column?.sortable) return;

        setSortConfig(prev => {
            if (prev?.key === key) {
                return prev.direction === 'asc'
                    ? { key, direction: 'desc' }
                    : null;
            }
            return { key, direction: 'asc' };
        });
    };

    // Export CSV
    const exportCSV = () => {
        if (sortedData.length === 0) return;

        const headers = visibleColumns.map(c => c.labelFr).join(',');
        const rows = sortedData.map(inv =>
            visibleColumns.map(col => {
                const val = inv[col.key as keyof Invoice];
                return `"${String(val ?? '').replace(/"/g, '""')}"`;
            }).join(',')
        ).join('\n');

        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
        const link = document.createElement('a');
        link.href = encodeURI(csvContent);
        link.download = `achats_fournisseurs_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    if (loading) {
        return (
            <div className="w-full h-64 flex items-center justify-center">
                <div className="animate-pulse text-slate-500">Chargement des factures...</div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-4 w-full max-w-full min-w-0">
                {/* Toolbar */}
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    {/* Left: Search & Filters */}
                    <div className="flex gap-2 items-center">
                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-900/50 border border-white/10 text-white text-xs rounded-lg pl-9 pr-3 py-2 w-56 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowStatusFilter(!showStatusFilter)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${statusFilter.length > 0
                                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                                    : 'bg-slate-900/50 border-white/10 text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Filter size={14} />
                                Statut
                                {statusFilter.length > 0 && (
                                    <span className="bg-teal-500 text-white text-[10px] px-1.5 rounded-full">
                                        {statusFilter.length}
                                    </span>
                                )}
                            </button>

                            {showStatusFilter && (
                                <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 p-2 min-w-48">
                                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                        <button
                                            key={key}
                                            onClick={() => toggleStatusFilter(key)}
                                            className="flex items-center justify-between w-full px-3 py-2 rounded hover:bg-white/5 text-xs"
                                        >
                                            <span className={config.color}>{config.label}</span>
                                            {statusFilter.includes(key) && <Check size={14} className="text-teal-400" />}
                                        </button>
                                    ))}
                                    {statusFilter.length > 0 && (
                                        <button
                                            onClick={() => setStatusFilter([])}
                                            className="flex items-center gap-2 w-full px-3 py-2 mt-1 border-t border-white/10 text-xs text-slate-500 hover:text-white"
                                        >
                                            <X size={12} /> Réinitialiser
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Column picker & Export */}
                    <div className="flex gap-2 items-center">
                        {/* Column Picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnPicker(!showColumnPicker)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-white/10 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors"
                            >
                                <Columns size={14} />
                                Colonnes
                            </button>

                            {showColumnPicker && (
                                <div className="absolute top-full right-0 mt-1 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 p-2 min-w-56">
                                    {columns.map(col => (
                                        <button
                                            key={col.key}
                                            onClick={() => toggleColumn(col.key)}
                                            className="flex items-center justify-between w-full px-3 py-2 rounded hover:bg-white/5 text-xs"
                                        >
                                            <span className={col.visible ? 'text-white' : 'text-slate-500'}>
                                                {col.labelFr}
                                            </span>
                                            {col.visible && <Check size={14} className="text-teal-400" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Export */}
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-white/10 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors"
                        >
                            <Download size={14} />
                            Exporter
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0F172A]/40 backdrop-blur-xl shadow-2xl relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent opacity-50" />

                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/10">
                                <tr>
                                    {visibleColumns.map(col => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className={`px-4 py-3 ${col.width || ''} ${col.sortable ? 'cursor-pointer hover:text-teal-400' : ''} transition-colors`}
                                        >
                                            <div className="flex items-center gap-1">
                                                {col.labelFr}
                                                {sortConfig?.key === col.key && (
                                                    sortConfig.direction === 'asc'
                                                        ? <ChevronUp size={12} className="text-teal-400" />
                                                        : <ChevronDown size={12} className="text-teal-400" />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/5">
                                {sortedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumns.length} className="px-6 py-16 text-center text-slate-600">
                                            {searchTerm || statusFilter.length > 0
                                                ? 'Aucune facture ne correspond aux filtres.'
                                                : 'Aucune facture. Commencez par en télécharger une.'}
                                        </td>
                                    </tr>
                                ) : (
                                    sortedData.map(invoice => (
                                        <tr
                                            key={invoice.id}
                                            onClick={() => setSelectedInvoiceId(invoice.id)}
                                            className="group cursor-pointer transition-all hover:bg-white/[0.02]"
                                        >
                                            {visibleColumns.map(col => (
                                                <td
                                                    key={col.key}
                                                    className={`px-4 py-3 text-xs ${col.width || ''} ${
                                                        col.key === 'supplier_code'
                                                            ? 'font-mono font-semibold text-teal-400 group-hover:text-teal-300'
                                                            : col.key === 'invoice_number'
                                                                ? 'font-mono text-slate-400 group-hover:text-slate-200'
                                                                : col.key === 'vendor_name'
                                                                    ? 'font-medium text-slate-200 group-hover:text-white'
                                                                    : 'text-slate-400'
                                                    } transition-colors`}
                                                >
                                                    {formatCell(invoice, col)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-white/5 bg-slate-900/30 px-4 py-2 text-xs text-slate-500 flex justify-between items-center">
                        <span>{sortedData.length} facture{sortedData.length !== 1 ? 's' : ''}</span>
                        <span>
                            Total: {sortedData.reduce((sum, inv) => sum + (inv.total_ttc || inv.total_amount || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </span>
                    </div>
                </div>
            </div>

            {/* Invoice Drawer */}
            <InvoiceDrawer
                invoiceId={selectedInvoiceId}
                isOpen={!!selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
            />

            {/* Click outside to close dropdowns */}
            {(showColumnPicker || showStatusFilter) && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setShowColumnPicker(false);
                        setShowStatusFilter(false);
                    }}
                />
            )}
        </>
    );
}
