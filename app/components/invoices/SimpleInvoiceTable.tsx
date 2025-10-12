'use client';

import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, XCircle, Clock, DollarSign, Package, RefreshCw, Download, Settings, Trash2, AlertTriangle, Info, Wrench } from 'lucide-react';
import { EnhancedInvoiceViewer } from './EnhancedInvoiceViewer';

interface SimpleInvoice {
  id: string;
  filename: string;
  invoice_number?: string;
  vendor_name?: string;
  document_date?: string;
  total_amount?: number;
  shipping_charge?: number;
  total_with_charges?: number;
  currency_code?: string;
  status: 'processing' | 'completed' | 'warning' | 'failed';
  vat_control_status?: 'passed' | 'warning' | 'failed' | 'pending';
  created_at: string;
  processing_notes?: string;
  item_descriptions?: string;
  storage_path?: string;
  page_count?: number;
}

interface SimpleInvoiceTableProps {
  orgId: string;
  isDarkMode?: boolean;
}

// Available columns configuration
const AVAILABLE_COLUMNS = {
  status: { label: 'Status', visible: true },
  invoice: { label: 'Invoice', visible: true },
  vendor: { label: 'Vendor', visible: true },
  items: { label: 'Items', visible: true },
  date: { label: 'Date', visible: true },
  amount: { label: 'Amount', visible: true },
  charges: { label: '+ Charges', visible: true },
  totalWithCharges: { label: 'Total with Charges', visible: true },
  controls: { label: 'Controls', visible: true }
};

export const SimpleInvoiceTable: React.FC<SimpleInvoiceTableProps> = ({ orgId, isDarkMode = false }) => {
  const [invoices, setInvoices] = useState<SimpleInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState(AVAILABLE_COLUMNS);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load invoices
  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/idp/documents?orgId=${orgId}`);
      const result = await response.json();

      if (result.success) {
        // Map to simple invoice format
        const mapped: SimpleInvoice[] = result.data.map((doc: any) => ({
          id: doc.id,
          filename: doc.original_filename || doc.filename,
          invoice_number: doc.invoice_number,
          vendor_name: doc.vendor_name,
          document_date: doc.document_date,
          total_amount: doc.total_amount,
          shipping_charge: 0, // TODO: Extract from fields
          total_with_charges: doc.total_amount, // TODO: Calculate
          currency_code: doc.currency_code || 'EUR',
          status: doc.status,
          vat_control_status: doc.vat_control_status,
          created_at: doc.created_at,
          processing_notes: doc.processing_notes,
          item_descriptions: doc.item_descriptions || '',
          storage_path: doc.storage_path,
          page_count: doc.page_count || 1
        }));

        setInvoices(mapped);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // Refresh every 10 seconds while there are processing invoices
    const interval = setInterval(() => {
      if (invoices.some(inv => inv.status === 'processing')) {
        loadInvoices();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [orgId]);

  // Handle upload
  const handleUpload = async (file: File | null) => {
    if (!file) return;

    if (!file.type.includes('pdf')) {
      setUploadError('Only PDF files allowed');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', orgId);

      // Use the new simplified endpoint
      const response = await fetch('/api/invoices/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('✅ Invoice processed:', result);

      // Reload invoices
      await loadInvoices();

    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get VAT control badge
  const getVatBadge = (status?: string) => {
    if (!status || status === 'pending') return null;

    const colors = {
      passed: 'bg-green-100 text-green-800 border-green-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      failed: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${colors[status as keyof typeof colors]}`}>
        VAT: {status.toUpperCase()}
      </span>
    );
  };

  // Open PDF viewer
  const viewPdf = async (documentId: string, storagePath: string) => {
    try {
      const response = await fetch(`/api/idp/documents/view-pdf?path=${encodeURIComponent(storagePath)}`);
      const data = await response.json();
      if (data.url) {
        setPdfUrl(data.url);
        setSelectedDocumentId(documentId);
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  // Close PDF viewer
  const closePdfViewer = () => {
    setSelectedDocumentId(null);
    setPdfUrl(null);
  };

  // Delete document
  const deleteDocument = async (documentId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('Delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/idp/documents?id=${documentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadInvoices();
      } else {
        alert('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    }
  };

  // Show debug info
  const showDebugInfo = async (documentId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      const response = await fetch(`/api/idp/documents/${documentId}/debug`);
      const data = await response.json();

      if (data.success) {
        setDebugInfo(data);
        setShowDebugModal(true);
      } else {
        alert('Failed to load debug info');
      }
    } catch (error) {
      console.error('Error loading debug info:', error);
      alert('Error loading debug info');
    }
  };

  // Remap/fix stuck document
  const remapDocument = async (documentId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('Fix this document by remapping its extracted fields?')) {
      return;
    }

    try {
      const response = await fetch(`/api/idp/documents/${documentId}/remap`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert(`Document fixed successfully!\n\nInvoice: ${data.mapped.invoiceNumber}\nVendor: ${data.mapped.vendorName}\nAmount: ${data.mapped.totalAmount} ${data.mapped.currencyCode}`);
        await loadInvoices();
      } else {
        console.error('Remap error details:', data);
        alert(`Failed to fix document:\n${data.error}\n\nDetails: ${data.details || 'No additional details'}\nCode: ${data.code || 'Unknown'}`);
      }
    } catch (error) {
      console.error('Error remapping document:', error);
      alert('Error fixing document');
    }
  };

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey as keyof typeof prev],
        visible: !prev[columnKey as keyof typeof prev].visible
      }
    }));
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = Object.entries(visibleColumns)
      .filter(([_, col]) => col.visible)
      .map(([_, col]) => col.label);

    const rows = invoices.map(invoice => {
      const row: string[] = [];
      if (visibleColumns.status.visible) row.push(invoice.status);
      if (visibleColumns.invoice.visible) row.push(invoice.invoice_number || '');
      if (visibleColumns.vendor.visible) row.push(invoice.vendor_name || '');
      if (visibleColumns.items.visible) row.push(invoice.item_descriptions || '');
      if (visibleColumns.date.visible) row.push(invoice.document_date || '');
      if (visibleColumns.amount.visible) row.push((invoice.total_amount || 0).toString());
      if (visibleColumns.charges.visible) row.push((invoice.shipping_charge || 0).toString());
      if (visibleColumns.totalWithCharges.visible) row.push((invoice.total_with_charges || invoice.total_amount || 0).toString());
      if (visibleColumns.controls.visible) row.push(invoice.vat_control_status || '');
      return row;
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export to Excel (using CSV format with .xlsx extension for simplicity)
  const exportToExcel = () => {
    const headers = Object.entries(visibleColumns)
      .filter(([_, col]) => col.visible)
      .map(([_, col]) => col.label);

    const rows = invoices.map(invoice => {
      const row: string[] = [];
      if (visibleColumns.status.visible) row.push(invoice.status);
      if (visibleColumns.invoice.visible) row.push(invoice.invoice_number || '');
      if (visibleColumns.vendor.visible) row.push(invoice.vendor_name || '');
      if (visibleColumns.items.visible) row.push(invoice.item_descriptions || '');
      if (visibleColumns.date.visible) row.push(invoice.document_date || '');
      if (visibleColumns.amount.visible) row.push((invoice.total_amount || 0).toString());
      if (visibleColumns.charges.visible) row.push((invoice.shipping_charge || 0).toString());
      if (visibleColumns.totalWithCharges.visible) row.push((invoice.total_with_charges || invoice.total_amount || 0).toString());
      if (visibleColumns.controls.visible) row.push(invoice.vat_control_status || '');
      return row;
    });

    // Create HTML table for Excel
    const htmlTable = `
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} rounded-xl shadow-lg`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              📊 Invoice Processing
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
              Simple automatic workflow: Upload → Analyze → Control → Distribute Charges
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Column Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                title="Column Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showColumnSelector && (
                <div className={`absolute right-0 top-12 z-50 w-56 rounded-lg shadow-xl border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                }`}>
                  <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Show Columns
                    </h4>
                  </div>
                  <div className="p-2 max-h-80 overflow-y-auto">
                    {Object.entries(visibleColumns).map(([key, col]) => (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-opacity-10 ${
                          isDarkMode ? 'hover:bg-white' : 'hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumn(key)}
                          className="rounded"
                        />
                        <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                          {col.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export Buttons */}
            <button
              onClick={exportToCSV}
              disabled={invoices.length === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              } disabled:opacity-50`}
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>

            <button
              onClick={exportToExcel}
              disabled={invoices.length === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              } disabled:opacity-50`}
              title="Export to Excel"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>

            <button
              onClick={loadInvoices}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50`}
            >
              {isUploading ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Upload Invoice
                </>
              )}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
            ❌ {uploadError}
          </div>
        )}

        {/* Warning for stuck documents */}
        {invoices.filter(inv => inv.status === 'processing').length > 0 && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Documents stuck in processing</p>
              <p className="text-xs mt-1">
                {invoices.filter(inv => inv.status === 'processing').length} document(s) are stuck in processing status.
                Click the <span className="inline-flex items-center px-1 py-0.5 bg-green-200 rounded"><Wrench className="w-3 h-3 mr-0.5" />green wrench</span> to fix them automatically,
                or the <span className="inline-flex items-center px-1 py-0.5 bg-blue-200 rounded"><Info className="w-3 h-3 mr-0.5" />blue info</span> for details.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}>
            <tr>
              {visibleColumns.status.visible && (
                <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Status
                </th>
              )}
              {visibleColumns.invoice.visible && (
                <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Invoice
                </th>
              )}
              {visibleColumns.vendor.visible && (
                <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Vendor
                </th>
              )}
              {visibleColumns.items.visible && (
                <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Items
                </th>
              )}
              {visibleColumns.date.visible && (
                <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Date
                </th>
              )}
              {visibleColumns.amount.visible && (
                <th className={`px-6 py-3 text-right text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Amount
                </th>
              )}
              {visibleColumns.charges.visible && (
                <th className={`px-6 py-3 text-right text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  + Charges
                </th>
              )}
              {visibleColumns.totalWithCharges.visible && (
                <th className={`px-6 py-3 text-right text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Total with Charges
                </th>
              )}
              {visibleColumns.controls.visible && (
                <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Controls
                </th>
              )}
            </tr>
          </thead>
          <tbody className={isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}>
            {isLoading ? (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(col => col.visible).length} className="px-6 py-12 text-center">
                  <Clock className={`w-8 h-8 mx-auto mb-2 animate-spin ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                  <p className={isDarkMode ? 'text-slate-400' : 'text-gray-600'}>Loading invoices...</p>
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(col => col.visible).length} className="px-6 py-12 text-center">
                  <FileText className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-gray-300'}`} />
                  <p className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    No invoices yet
                  </p>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                    Upload your first PDF invoice to get started
                  </p>
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => invoice.storage_path && viewPdf(invoice.id, invoice.storage_path)}
                  className={`${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'} transition-colors cursor-pointer`}
                >
                  {/* Status */}
                  {visibleColumns.status.visible && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invoice.status)}
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium capitalize ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {invoice.status}
                          </span>
                          {(invoice.status === 'processing' || invoice.status === 'failed') && invoice.processing_notes && (
                            <span className="text-xs text-red-500 flex items-center gap-1 mt-1" title={invoice.processing_notes}>
                              <AlertTriangle className="w-3 h-3" />
                              {invoice.processing_notes.substring(0, 30)}...
                            </span>
                          )}
                        </div>
                        {(invoice.status === 'processing' || invoice.status === 'failed') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => remapDocument(invoice.id, e)}
                              className="p-1 hover:bg-green-100 rounded transition-colors"
                              title="Fix this document (remap fields)"
                            >
                              <Wrench className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={(e) => showDebugInfo(invoice.id, e)}
                              className="p-1 hover:bg-blue-100 rounded transition-colors"
                              title="Show debug info"
                            >
                              <Info className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={(e) => deleteDocument(invoice.id, e)}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Delete this document"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Invoice Number & Filename */}
                  {visibleColumns.invoice.visible && (
                    <td className="px-6 py-4">
                      <div>
                        <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {invoice.invoice_number || 'Processing...'}
                        </p>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          {invoice.filename}
                        </p>
                      </div>
                    </td>
                  )}

                  {/* Vendor */}
                  {visibleColumns.vendor.visible && (
                    <td className="px-6 py-4">
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                        {invoice.vendor_name || '-'}
                      </p>
                    </td>
                  )}

                  {/* Items Description */}
                  {visibleColumns.items.visible && (
                    <td className="px-6 py-4">
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-600'} truncate max-w-[200px]`} title={invoice.item_descriptions}>
                        {invoice.item_descriptions || '-'}
                      </p>
                    </td>
                  )}

                  {/* Date */}
                  {visibleColumns.date.visible && (
                    <td className="px-6 py-4">
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                        {invoice.document_date ? new Date(invoice.document_date).toLocaleDateString() : '-'}
                      </p>
                    </td>
                  )}

                  {/* Original Amount */}
                  {visibleColumns.amount.visible && (
                    <td className="px-6 py-4 text-right">
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {invoice.total_amount ? `${invoice.total_amount.toFixed(2)} ${invoice.currency_code}` : '-'}
                      </p>
                    </td>
                  )}

                  {/* Shipping Charges */}
                  {visibleColumns.charges.visible && (
                    <td className="px-6 py-4 text-right">
                      {invoice.shipping_charge && invoice.shipping_charge > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <Package className="w-4 h-4 text-orange-500" />
                          <p className={`text-sm font-medium text-orange-500`}>
                            +{invoice.shipping_charge.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>-</p>
                      )}
                    </td>
                  )}

                  {/* Total with Charges */}
                  {visibleColumns.totalWithCharges.visible && (
                    <td className="px-6 py-4 text-right">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${isDarkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <p className={`font-bold text-green-600`}>
                          {invoice.total_with_charges ? invoice.total_with_charges.toFixed(2) : invoice.total_amount?.toFixed(2) || '-'} {invoice.currency_code}
                        </p>
                      </div>
                    </td>
                  )}

                  {/* Controls */}
                  {visibleColumns.controls.visible && (
                    <td className="px-6 py-4">
                      {getVatBadge(invoice.vat_control_status)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
            Total: <span className="font-semibold">{invoices.length}</span> invoices
          </p>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className={isDarkMode ? 'text-slate-400' : 'text-gray-600'}>
                {invoices.filter(i => i.status === 'completed').length} Completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className={isDarkMode ? 'text-slate-400' : 'text-gray-600'}>
                {invoices.filter(i => i.status === 'processing').length} Processing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className={isDarkMode ? 'text-slate-400' : 'text-gray-600'}>
                {invoices.filter(i => i.status === 'failed').length} Failed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Modal */}
      {showDebugModal && debugInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setShowDebugModal(false)}
        >
          <div
            className="relative w-[90vw] max-w-4xl h-[90vh] bg-white rounded-lg shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-800 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Debug Information</h3>
                <button
                  onClick={() => setShowDebugModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Diagnostics */}
              <div className="mb-6">
                <h4 className="text-md font-bold text-slate-900 mb-3">Diagnostics</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-600">Status</div>
                    <div className="text-sm font-semibold text-slate-900">{debugInfo.diagnostics.status}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-600">Time Since Upload</div>
                    <div className="text-sm font-semibold text-slate-900">{debugInfo.diagnostics.time_since_upload}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-600">Extracted Fields</div>
                    <div className="text-sm font-semibold text-slate-900">{debugInfo.document.extracted_fields_count}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-600">Has Invoice Number</div>
                    <div className="text-sm font-semibold text-slate-900">{debugInfo.diagnostics.has_invoice_number ? '✅ Yes' : '❌ No'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-600">Has Vendor</div>
                    <div className="text-sm font-semibold text-slate-900">{debugInfo.diagnostics.has_vendor_name ? '✅ Yes' : '❌ No'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-600">Has Amount</div>
                    <div className="text-sm font-semibold text-slate-900">{debugInfo.diagnostics.has_total_amount ? '✅ Yes' : '❌ No'}</div>
                  </div>
                </div>
              </div>

              {/* Processing Notes */}
              <div className="mb-6">
                <h4 className="text-md font-bold text-slate-900 mb-3">Processing Notes</h4>
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <pre className="text-sm text-slate-900 whitespace-pre-wrap font-mono">
                    {debugInfo.diagnostics.processing_notes || 'No processing notes available'}
                  </pre>
                </div>
              </div>

              {/* Sample Fields */}
              {debugInfo.sample_fields && debugInfo.sample_fields.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-bold text-slate-900 mb-3">Sample Extracted Fields</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-bold text-slate-700">Field Name</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-slate-700">Value</th>
                          <th className="px-3 py-2 text-left text-xs font-bold text-slate-700">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {debugInfo.sample_fields.map((field: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-900">{field.field_name}</td>
                            <td className="px-3 py-2 text-slate-900">{field.value_text}</td>
                            <td className="px-3 py-2 text-slate-900">{(field.confidence * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit Log */}
              {debugInfo.audit_log && debugInfo.audit_log.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-bold text-slate-900 mb-3">Audit Log</h4>
                  <div className="space-y-2">
                    {debugInfo.audit_log.map((log: any, index: number) => (
                      <div key={index} className="p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">{log.action}</span>
                          <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        {log.metadata && (
                          <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Document Data */}
              <div className="mb-6">
                <h4 className="text-md font-bold text-slate-900 mb-3">Raw Document Data</h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded overflow-x-auto">
                  <pre className="text-xs text-slate-900 whitespace-pre-wrap font-mono">
                    {JSON.stringify(debugInfo.document, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced PDF Viewer Modal */}
      {selectedDocumentId && pdfUrl && (
        <EnhancedInvoiceViewer
          documentId={selectedDocumentId}
          pdfUrl={pdfUrl}
          onClose={closePdfViewer}
        />
      )}
    </div>
  );
};
