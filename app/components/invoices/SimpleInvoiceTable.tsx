'use client';

import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, XCircle, Clock, DollarSign, Package, RefreshCw } from 'lucide-react';
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

export const SimpleInvoiceTable: React.FC<SimpleInvoiceTableProps> = ({ orgId, isDarkMode = false }) => {
  const [invoices, setInvoices] = useState<SimpleInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
            <button
              onClick={loadInvoices}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}
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
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Status
              </th>
              <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Invoice
              </th>
              <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Vendor
              </th>
              <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Items
              </th>
              <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Date
              </th>
              <th className={`px-6 py-3 text-right text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Amount
              </th>
              <th className={`px-6 py-3 text-right text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                + Charges
              </th>
              <th className={`px-6 py-3 text-right text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Total with Charges
              </th>
              <th className={`px-6 py-3 text-left text-xs font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Controls
              </th>
            </tr>
          </thead>
          <tbody className={isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <Clock className={`w-8 h-8 mx-auto mb-2 animate-spin ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                  <p className={isDarkMode ? 'text-slate-400' : 'text-gray-600'}>Loading invoices...</p>
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
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
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      <span className={`text-sm font-medium capitalize ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </td>

                  {/* Invoice Number & Filename */}
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

                  {/* Vendor */}
                  <td className="px-6 py-4">
                    <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                      {invoice.vendor_name || '-'}
                    </p>
                  </td>

                  {/* Items Description */}
                  <td className="px-6 py-4">
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-600'} truncate max-w-[200px]`} title={invoice.item_descriptions}>
                      {invoice.item_descriptions || '-'}
                    </p>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4">
                    <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                      {invoice.document_date ? new Date(invoice.document_date).toLocaleDateString() : '-'}
                    </p>
                  </td>

                  {/* Original Amount */}
                  <td className="px-6 py-4 text-right">
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {invoice.total_amount ? `${invoice.total_amount.toFixed(2)} ${invoice.currency_code}` : '-'}
                    </p>
                  </td>

                  {/* Shipping Charges */}
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

                  {/* Total with Charges */}
                  <td className="px-6 py-4 text-right">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${isDarkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <p className={`font-bold text-green-600`}>
                        {invoice.total_with_charges ? invoice.total_with_charges.toFixed(2) : invoice.total_amount?.toFixed(2) || '-'} {invoice.currency_code}
                      </p>
                    </div>
                  </td>

                  {/* Controls */}
                  <td className="px-6 py-4">
                    {getVatBadge(invoice.vat_control_status)}
                  </td>
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
