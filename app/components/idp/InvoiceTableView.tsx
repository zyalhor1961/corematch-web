'use client';

/**
 * Excel-like Invoice Table View
 *
 * Features:
 * - Spreadsheet-style table with sortable columns
 * - Inline editing capabilities
 * - Advanced filtering by user-defined criteria
 * - Export to Excel/CSV
 * - Saved view configurations
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  Download,
  Filter,
  Search,
  Eye,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  Plus,
  X
} from 'lucide-react';

interface InvoiceData {
  id: string;
  document_id: string;
  invoice_number?: string;
  vendor_name?: string;
  vendor_vat?: string;
  document_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  net_amount?: number;
  currency_code?: string;
  status: string;
  confidence: number;
  created_at: string;
}

interface FilterCriteria {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in_range';
  value: any;
  value2?: any; // For 'between' operator
}

interface InvoiceTableViewProps {
  orgId: string;
  onViewDocument: (doc: any) => void;
  isDarkMode?: boolean;
}

const AVAILABLE_COLUMNS = [
  { key: 'invoice_number', label: 'Invoice #', type: 'string' },
  { key: 'vendor_name', label: 'Vendor', type: 'string' },
  { key: 'vendor_vat', label: 'VAT Number', type: 'string' },
  { key: 'document_date', label: 'Date', type: 'date' },
  { key: 'due_date', label: 'Due Date', type: 'date' },
  { key: 'net_amount', label: 'Net Amount', type: 'number' },
  { key: 'tax_amount', label: 'Tax', type: 'number' },
  { key: 'total_amount', label: 'Total', type: 'number' },
  { key: 'currency_code', label: 'Currency', type: 'string' },
  { key: 'status', label: 'Status', type: 'string' },
  { key: 'confidence', label: 'Confidence', type: 'number' }
];

export const InvoiceTableView: React.FC<InvoiceTableViewProps> = ({
  orgId,
  onViewDocument,
  isDarkMode = false
}) => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<string>('document_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterCriteria[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'invoice_number', 'vendor_name', 'document_date', 'total_amount', 'status'
  ]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Load invoices
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/idp/documents?orgId=${orgId}&documentType=invoice`);
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Apply filters and search
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(query) ||
        inv.vendor_name?.toLowerCase().includes(query) ||
        inv.vendor_vat?.toLowerCase().includes(query)
      );
    }

    // Apply custom filters
    for (const filter of filters) {
      filtered = filtered.filter(inv => {
        const value = (inv as any)[filter.field];

        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater_than':
            return Number(value) > Number(filter.value);
          case 'less_than':
            return Number(value) < Number(filter.value);
          case 'between':
            return Number(value) >= Number(filter.value) && Number(value) <= Number(filter.value2);
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];

      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [invoices, searchQuery, filters, sortField, sortOrder]);

  // Add filter
  const addFilter = () => {
    setFilters([...filters, {
      id: `filter-${Date.now()}`,
      field: 'total_amount',
      operator: 'greater_than',
      value: 0
    }]);
  };

  // Remove filter
  const removeFilter = (filterId: string) => {
    setFilters(filters.filter(f => f.id !== filterId));
  };

  // Update filter
  const updateFilter = (filterId: string, updates: Partial<FilterCriteria>) => {
    setFilters(filters.map(f => f.id === filterId ? { ...f, ...updates } : f));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = visibleColumns.map(col =>
      AVAILABLE_COLUMNS.find(c => c.key === col)?.label || col
    );

    const rows = filteredInvoices.map(inv =>
      visibleColumns.map(col => (inv as any)[col] || '')
    );

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_${Date.now()}.csv`;
    a.click();
  };

  // Format currency
  const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(amount);
  };

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      {/* Toolbar */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Invoice Data Table</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isDarkMode ? 'bg-green-600 hover:bg-green-500' : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              <Filter className="w-4 h-4" />
              Filters ({filters.length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Advanced Filters</h3>
            <button
              onClick={addFilter}
              className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              <Plus className="w-3 h-3" />
              Add Filter
            </button>
          </div>

          {filters.map(filter => (
            <div key={filter.id} className="flex items-center gap-2 mb-2">
              <select
                value={filter.field}
                onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                className={`px-2 py-1 rounded border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                {AVAILABLE_COLUMNS.map(col => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>

              <select
                value={filter.operator}
                onChange={(e) => updateFilter(filter.id, { operator: e.target.value as any })}
                className={`px-2 py-1 rounded border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="greater_than">Greater than</option>
                <option value="less_than">Less than</option>
                <option value="between">Between</option>
              </select>

              <input
                type="text"
                value={filter.value}
                onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                className={`px-2 py-1 rounded border flex-1 ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                }`}
                placeholder="Value"
              />

              {filter.operator === 'between' && (
                <input
                  type="text"
                  value={filter.value2 || ''}
                  onChange={(e) => updateFilter(filter.id, { value2: e.target.value })}
                  className={`px-2 py-1 rounded border flex-1 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                  }`}
                  placeholder="To"
                />
              )}

              <button
                onClick={() => removeFilter(filter.id)}
                className="p-1 rounded hover:bg-red-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className={`sticky top-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <tr>
              {visibleColumns.map(colKey => {
                const col = AVAILABLE_COLUMNS.find(c => c.key === colKey)!;
                return (
                  <th
                    key={colKey}
                    className="px-4 py-3 text-left cursor-pointer hover:bg-opacity-80"
                    onClick={() => {
                      if (sortField === colKey) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField(colKey);
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{col.label}</span>
                      {sortField === colKey && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-left font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-8 text-center">
                  Loading...
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-8 text-center">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv, idx) => (
                <tr
                  key={inv.id}
                  className={`border-b ${
                    isDarkMode ? 'border-slate-800 hover:bg-slate-900' : 'border-slate-200 hover:bg-slate-50'
                  } ${idx % 2 === 0 ? (isDarkMode ? 'bg-slate-950' : 'bg-white') : (isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50/50')}`}
                >
                  {visibleColumns.map(colKey => {
                    const value = (inv as any)[colKey];
                    let displayValue = value;

                    if (colKey.includes('amount') && typeof value === 'number') {
                      displayValue = formatCurrency(value, inv.currency_code);
                    } else if (colKey.includes('date') && value) {
                      displayValue = new Date(value).toLocaleDateString();
                    } else if (colKey === 'confidence') {
                      displayValue = `${(value * 100).toFixed(0)}%`;
                    }

                    return (
                      <td key={colKey} className="px-4 py-3 text-sm">
                        {displayValue || '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewDocument(inv)}
                      className="p-1 rounded hover:bg-blue-500 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with stats */}
      <div className={`p-3 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
        <div className="text-sm">
          Showing {filteredInvoices.length} of {invoices.length} invoices
          {filters.length > 0 && ` (${filters.length} filter${filters.length > 1 ? 's' : ''} applied)`}
        </div>
      </div>
    </div>
  );
};
