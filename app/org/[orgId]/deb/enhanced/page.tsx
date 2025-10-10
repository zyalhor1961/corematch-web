'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/app/components/ThemeProvider';
import { PDFDataSync, ExtractedField } from '@/app/components/deb/PDFDataSync';
import { EditableDataTable, TableRow } from '@/app/components/deb/EditableDataTable';
import { WorkflowDashboard, QueueItem } from '@/app/components/deb/WorkflowDashboard';
import { LayoutDashboard, FileEdit, Upload } from 'lucide-react';

type ViewMode = 'dashboard' | 'editor' | 'table';

export default function EnhancedDebPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const { isDarkMode } = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Mock data - Replace with real API calls
  const [queue, setQueue] = useState<QueueItem[]>([
    {
      id: '1',
      filename: 'invoice-2025-001.pdf',
      status: 'review',
      priority: 'high',
      uploadedAt: new Date(),
      assignee: 'John Doe',
      confidence: 0.92,
    },
    {
      id: '2',
      filename: 'delivery-note-456.pdf',
      status: 'processing',
      priority: 'medium',
      uploadedAt: new Date(Date.now() - 3600000),
      confidence: 0.88,
    },
    {
      id: '3',
      filename: 'invoice-2025-002.pdf',
      status: 'completed',
      priority: 'low',
      uploadedAt: new Date(Date.now() - 7200000),
      assignee: 'Jane Smith',
      confidence: 0.98,
    },
  ]);

  const analytics = {
    totalProcessed: 1248,
    avgProcessingTime: 3.2,
    accuracyRate: 98.5,
    throughputToday: 156,
  };

  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([
    {
      id: '1',
      label: 'Invoice Number',
      value: 'INV-2025-001',
      confidence: 0.98,
      bbox: { page: 1, x: 100, y: 50, width: 200, height: 30 },
    },
    {
      id: '2',
      label: 'Invoice Date',
      value: '2025-01-15',
      confidence: 0.95,
      bbox: { page: 1, x: 100, y: 90, width: 150, height: 25 },
    },
    {
      id: '3',
      label: 'Supplier Name',
      value: 'ACME Corporation',
      confidence: 0.93,
      bbox: { page: 1, x: 100, y: 130, width: 250, height: 30 },
    },
    {
      id: '4',
      label: 'Total Amount',
      value: '€1,234.56',
      confidence: 0.76,
      bbox: { page: 1, x: 100, y: 500, width: 150, height: 25 },
    },
  ]);

  const [tableData, setTableData] = useState<TableRow[]>([
    {
      id: '1',
      description: 'Professional Services - Consulting',
      quantity: 10,
      unitPrice: 150,
      total: 1500,
      hsCode: '8471.30',
      countryOfOrigin: 'FR',
      confidence: 0.95,
    },
    {
      id: '2',
      description: 'Software License Annual Subscription',
      quantity: 2,
      unitPrice: 500,
      total: 1000,
      hsCode: '8523.49',
      countryOfOrigin: 'US',
      confidence: 0.88,
    },
    {
      id: '3',
      description: 'Hardware Components',
      quantity: 5,
      unitPrice: 200,
      total: 1000,
      hsCode: '',
      countryOfOrigin: '',
      confidence: 0.65,
      errors: { hsCode: 'Required', countryOfOrigin: 'Required' },
    },
  ]);

  const handleFieldUpdate = useCallback((id: string, newValue: string) => {
    setExtractedFields(prev =>
      prev.map(field => (field.id === id ? { ...field, value: newValue } : field))
    );
  }, []);

  const handleTableDataChange = useCallback((newData: TableRow[]) => {
    setTableData(newData);
  }, []);

  const handleTableSave = useCallback(async (data: TableRow[]) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Saving table data:', data);
    // TODO: Implement actual save logic
  }, []);

  const handleQueueItemClick = useCallback((item: QueueItem) => {
    setSelectedDocId(item.id);
    setViewMode('editor');
  }, []);

  return (
    <div className={`min-h-screen transition-all ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Navigation Tabs */}
      <div className={`sticky top-0 z-50 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-lg`}>
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'editor'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileEdit className="w-5 h-5" />
              PDF Editor
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-5 h-5" />
              Data Table
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto">
        {viewMode === 'dashboard' && (
          <WorkflowDashboard
            queue={queue}
            analytics={analytics}
            onItemClick={handleQueueItemClick}
            isDarkMode={isDarkMode}
          />
        )}

        {viewMode === 'editor' && (
          <div className="p-6">
            <PDFDataSync
              pdfUrl="/sample-invoice.pdf"
              extractedData={extractedFields}
              onFieldUpdate={handleFieldUpdate}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {viewMode === 'table' && (
          <div className="p-6">
            <EditableDataTable
              data={tableData}
              onDataChange={handleTableDataChange}
              onSave={handleTableSave}
              isDarkMode={isDarkMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
