'use client';

/**
 * Document List View Component
 *
 * Professional document management interface for IDP with:
 * - Advanced filtering and search
 * - Status tracking and workflow management
 * - Bulk operations
 * - Export to accounting systems
 * - Audit trail visibility
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  Upload,
  Eye,
  Trash2,
  RefreshCw,
  Calendar,
  DollarSign,
  Building2,
  FileCheck,
  FileWarning,
  FileX,
  ArrowUpDown,
  MoreVertical,
  Edit,
  Archive
} from 'lucide-react';

// Status colors and icons
const STATUS_CONFIG = {
  uploaded: {
    color: '#6B7280',
    bg: '#F3F4F6',
    icon: Upload,
    label: 'Uploaded'
  },
  queued: {
    color: '#8B5CF6',
    bg: '#F5F3FF',
    icon: Clock,
    label: 'Queued'
  },
  processing: {
    color: '#3B82F6',
    bg: '#EFF6FF',
    icon: RefreshCw,
    label: 'Processing'
  },
  processed: {
    color: '#10B981',
    bg: '#ECFDF5',
    icon: FileCheck,
    label: 'Processed'
  },
  needs_validation: {
    color: '#F59E0B',
    bg: '#FFFBEB',
    icon: FileWarning,
    label: 'Needs Review'
  },
  validated: {
    color: '#059669',
    bg: '#D1FAE5',
    icon: CheckCircle,
    label: 'Validated'
  },
  approved: {
    color: '#059669',
    bg: '#D1FAE5',
    icon: CheckCircle,
    label: 'Approved'
  },
  exported: {
    color: '#8B5CF6',
    bg: '#F5F3FF',
    icon: Download,
    label: 'Exported'
  },
  archived: {
    color: '#6B7280',
    bg: '#F9FAFB',
    icon: Archive,
    label: 'Archived'
  },
  failed: {
    color: '#EF4444',
    bg: '#FEF2F2',
    icon: FileX,
    label: 'Failed'
  },
  rejected: {
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: AlertCircle,
    label: 'Rejected'
  }
};

const DOCUMENT_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'delivery_note', label: 'Delivery Note' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'contract', label: 'Contract' },
  { value: 'tax_document', label: 'Tax Document' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'customs_declaration', label: 'Customs Declaration' },
  { value: 'general', label: 'General' }
];

export interface IDPDocument {
  id: string;
  org_id: string;
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  document_type: string;
  status: string;
  overall_confidence?: number;
  page_count: number;
  field_count: number;
  validation_errors_count: number;
  currency_code?: string;
  total_amount?: number;
  tax_amount?: number;
  net_amount?: number;
  document_date?: string;
  vendor_name?: string;
  vendor_vat?: string;
  invoice_number?: string;
  created_at: string;
  processed_at?: string;
  validated_at?: string;
  exported_at?: string;
  tags?: string[];
}

interface DocumentListViewProps {
  documents: IDPDocument[];
  onRefresh: () => void;
  onViewDocument: (doc: IDPDocument) => void;
  onDeleteDocument: (id: string) => void;
  onExportDocuments: (ids: string[]) => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
}

export const DocumentListView: React.FC<DocumentListViewProps> = ({
  documents,
  onRefresh,
  onViewDocument,
  onDeleteDocument,
  onExportDocuments,
  isLoading = false,
  isDarkMode = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'confidence' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.filename.toLowerCase().includes(query) ||
        doc.vendor_name?.toLowerCase().includes(query) ||
        doc.invoice_number?.toLowerCase().includes(query) ||
        doc.original_filename.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(doc => statusFilter.includes(doc.status));
    }

    // Type filter
    if (typeFilter.length > 0) {
      filtered = filtered.filter(doc => typeFilter.includes(doc.document_type));
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(doc =>
        doc.document_date && doc.document_date >= dateRange.start
      );
    }
    if (dateRange.end) {
      filtered = filtered.filter(doc =>
        doc.document_date && doc.document_date <= dateRange.end
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = (a.created_at || '').localeCompare(b.created_at || '');
          break;
        case 'amount':
          comparison = (a.total_amount || 0) - (b.total_amount || 0);
          break;
        case 'confidence':
          comparison = (a.overall_confidence || 0) - (b.overall_confidence || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [documents, searchQuery, statusFilter, typeFilter, dateRange, sortBy, sortOrder]);

  // Toggle document selection
  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedDocs(new Set(filteredDocuments.map(d => d.id)));
  }, [filteredDocuments]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedDocs(new Set());
  }, []);

  // Format currency
  const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(amount);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredDocuments.length;
    const processed = filteredDocuments.filter(d => d.status === 'processed' || d.status === 'validated' || d.status === 'approved').length;
    const needsReview = filteredDocuments.filter(d => d.status === 'needs_validation').length;
    const totalAmount = filteredDocuments.reduce((sum, d) => sum + (d.total_amount || 0), 0);

    return { total, processed, needsReview, totalAmount };
  }, [filteredDocuments]);

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      {/* Header */}
      <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Document Library</h1>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Manage and process your documents with Azure Document Intelligence
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Documents
              </span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>

          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Processed
              </span>
            </div>
            <div className="text-2xl font-bold">{stats.processed}</div>
          </div>

          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Needs Review
              </span>
            </div>
            <div className="text-2xl font-bold">{stats.needsReview}</div>
          </div>

          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Amount
              </span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount, 'EUR')}</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search by filename, vendor, invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Status Filter */}
          <select
            multiple
            value={statusFilter}
            onChange={(e) => setStatusFilter(Array.from(e.target.selectedOptions, option => option.value))}
            className={`px-4 py-2 rounded-lg border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            multiple
            value={typeFilter}
            onChange={(e) => setTypeFilter(Array.from(e.target.selectedOptions, option => option.value))}
            className={`px-4 py-2 rounded-lg border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">All Types</option>
            {DOCUMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* Sort */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
            title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedDocs.size > 0 && (
          <div className={`mt-3 flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
            <span className="text-sm font-medium">
              {selectedDocs.size} selected
            </span>
            <button
              onClick={() => onExportDocuments(Array.from(selectedDocs))}
              className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Export Selected
            </button>
            <button
              onClick={selectAll}
              className="text-sm px-3 py-1 rounded bg-slate-600 text-white hover:bg-slate-700"
            >
              Select All ({filteredDocuments.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-sm px-3 py-1 rounded bg-slate-600 text-white hover:bg-slate-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`} />
            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              No Documents Found
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {searchQuery || statusFilter.length || typeFilter.length
                ? 'Try adjusting your filters'
                : 'Upload your first document to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
              const statusConfig = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG];
              const StatusIcon = statusConfig?.icon || FileText;

              return (
                <div
                  key={doc.id}
                  className={`p-4 rounded-lg border transition-all ${
                    selectedDocs.has(doc.id)
                      ? isDarkMode
                        ? 'bg-blue-900/30 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : isDarkMode
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={() => toggleDocSelection(doc.id)}
                      className="mt-1 w-4 h-4 rounded"
                    />

                    {/* Icon */}
                    <div
                      className="p-3 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: statusConfig?.bg }}
                    >
                      <StatusIcon className="w-6 h-6" style={{ color: statusConfig?.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base truncate">{doc.filename}</h3>
                          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {doc.original_filename !== doc.filename && (
                              <span className="truncate block">{doc.original_filename}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span
                            className="px-2 py-1 text-xs font-medium rounded"
                            style={{
                              backgroundColor: statusConfig?.bg,
                              color: statusConfig?.color
                            }}
                          >
                            {statusConfig?.label}
                          </span>
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-5 gap-4 text-sm mb-3">
                        <div>
                          <span className={`block text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            Type
                          </span>
                          <span className="font-medium">
                            {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}
                          </span>
                        </div>

                        {doc.vendor_name && (
                          <div>
                            <span className={`block text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                              Vendor
                            </span>
                            <span className="font-medium truncate block">{doc.vendor_name}</span>
                          </div>
                        )}

                        {doc.total_amount && (
                          <div>
                            <span className={`block text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                              Amount
                            </span>
                            <span className="font-medium">{formatCurrency(doc.total_amount, doc.currency_code)}</span>
                          </div>
                        )}

                        {doc.document_date && (
                          <div>
                            <span className={`block text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                              Date
                            </span>
                            <span className="font-medium">{new Date(doc.document_date).toLocaleDateString()}</span>
                          </div>
                        )}

                        {doc.overall_confidence !== undefined && (
                          <div>
                            <span className={`block text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                              Confidence
                            </span>
                            <span className={`font-medium ${
                              doc.overall_confidence >= 0.95 ? 'text-green-600' :
                              doc.overall_confidence >= 0.80 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {(doc.overall_confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                          {doc.page_count} page{doc.page_count !== 1 ? 's' : ''} · {doc.field_count} fields · {formatFileSize(doc.file_size_bytes)} ·
                          Uploaded {new Date(doc.created_at).toLocaleString()}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onViewDocument(doc)}
                            className={`p-2 rounded-lg transition-all ${
                              isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                            }`}
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteDocument(doc.id)}
                            className={`p-2 rounded-lg transition-all ${
                              isDarkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-600'
                            }`}
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
