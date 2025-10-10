'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { z } from 'zod';
import { AlertTriangle, CheckCircle, Download, Save } from 'lucide-react';

// Validation schema for invoice lines
const InvoiceLineSchema = z.object({
  description: z.string().min(1, 'Required'),
  quantity: z.number().positive('Must be > 0'),
  unitPrice: z.number().positive('Must be > 0'),
  total: z.number(),
  hsCode: z.string().regex(/^\d{4}\.\d{2}$/, 'Format: 0000.00').optional().or(z.literal('')),
  countryOfOrigin: z.string().min(2, 'Required').max(2, '2-letter code').optional().or(z.literal('')),
});

export interface TableRow {
  id: string;
  invoiceNumber?: string;
  supplier?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  hsCode?: string;
  countryOfOrigin?: string;
  countryDestination?: string;
  unit?: string;
  netMassKg?: number;
  confidence: number;
  errors?: Record<string, string>;
}

interface EditableDataTableProps {
  data: TableRow[];
  onDataChange?: (data: TableRow[]) => void;
  onSave?: (data: TableRow[]) => Promise<void>;
  isDarkMode?: boolean;
}

export const EditableDataTable: React.FC<EditableDataTableProps> = ({
  data,
  onDataChange,
  onSave,
  isDarkMode = false
}) => {
  const [rowData, setRowData] = useState<TableRow[]>(data);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Validate a single row
  const validateRow = useCallback((row: TableRow) => {
    try {
      InvoiceLineSchema.parse(row);
      return { ...row, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = Object.fromEntries(
          error.errors.map(e => [e.path[0], e.message])
        );
        return { ...row, errors };
      }
      return row;
    }
  }, []);

  // Cell styling based on confidence & errors
  const cellClassRules = useMemo(() => ({
    'ag-cell-error': (params: any) => {
      return params.data.errors?.[params.colDef.field];
    },
    'ag-cell-warning': (params: any) => {
      return params.data.confidence < 0.80 && !params.data.errors?.[params.colDef.field];
    },
    'ag-cell-success': (params: any) => {
      return params.data.confidence >= 0.95 && !params.data.errors?.[params.colDef.field];
    },
  }), []);

  // Confidence cell renderer
  const ConfidenceCellRenderer = useCallback((props: any) => {
    const conf = props.value;
    const color = conf >= 0.95 ? 'green' : conf >= 0.80 ? 'yellow' : 'red';
    const bgColor = conf >= 0.95 ? 'bg-green-100' : conf >= 0.80 ? 'bg-yellow-100' : 'bg-red-100';
    const textColor = conf >= 0.95 ? 'text-green-800' : conf >= 0.80 ? 'text-yellow-800' : 'text-red-800';

    return (
      <div className="flex items-center justify-center h-full">
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${bgColor} ${textColor}`}>
          {Math.round(conf * 100)}%
        </span>
      </div>
    );
  }, []);

  const columnDefs = useMemo(() => [
    {
      field: 'invoiceNumber',
      headerName: 'Invoice #',
      editable: false,
      width: 130,
      pinned: 'left' as const,
    },
    {
      field: 'supplier',
      headerName: 'Supplier',
      editable: false,
      width: 150,
      pinned: 'left' as const,
    },
    {
      field: 'description',
      headerName: 'Description',
      editable: true,
      flex: 2,
      cellClassRules,
      tooltipValueGetter: (params: any) => params.data.errors?.description || '',
    },
    {
      field: 'hsCode',
      headerName: 'HS Code',
      editable: true,
      width: 130,
      cellClassRules,
      tooltipValueGetter: (params: any) => params.data.errors?.hsCode || 'Format: 0000.00',
    },
    {
      field: 'quantity',
      headerName: 'Qty',
      editable: true,
      type: 'numericColumn',
      width: 100,
      cellClassRules,
      valueParser: (params: any) => Number(params.newValue),
      cellStyle: { textAlign: 'right' },
    },
    {
      field: 'unit',
      headerName: 'Unit',
      editable: true,
      width: 90,
      cellClassRules,
    },
    {
      field: 'countryOfOrigin',
      headerName: 'Origin',
      editable: true,
      width: 100,
      cellClassRules,
      tooltipValueGetter: (params: any) => params.data.errors?.countryOfOrigin || '2-letter country code (e.g., FR, DE)',
    },
    {
      field: 'countryDestination',
      headerName: 'Destination',
      editable: true,
      width: 110,
      cellClassRules,
      tooltipValueGetter: (params: any) => '2-letter country code (e.g., FR, DE)',
    },
    {
      field: 'netMassKg',
      headerName: 'Weight (kg)',
      editable: true,
      type: 'numericColumn',
      width: 120,
      cellClassRules,
      valueParser: (params: any) => Number(params.newValue),
      cellStyle: { textAlign: 'right' },
      valueFormatter: (params: any) => params.value ? params.value.toFixed(2) : '',
    },
    {
      field: 'total',
      headerName: 'Value (€)',
      editable: true,
      type: 'numericColumn',
      width: 130,
      valueFormatter: (params: any) => params.value ? `€${params.value.toFixed(2)}` : '',
      valueParser: (params: any) => Number(params.newValue),
      cellClassRules,
      cellStyle: { textAlign: 'right', fontWeight: 'bold' },
    },
    {
      field: 'confidence',
      headerName: 'Confidence',
      editable: false,
      width: 120,
      cellRenderer: ConfidenceCellRenderer,
      comparator: (valueA: number, valueB: number) => valueA - valueB,
    },
  ], [cellClassRules, ConfidenceCellRenderer]);

  // Handle cell value changed
  const onCellValueChanged = useCallback((event: any) => {
    const updatedRow = validateRow(event.data);
    const newData = rowData.map(row => row.id === updatedRow.id ? updatedRow : row);

    setRowData(newData);
    setHasChanges(true);
    onDataChange?.(newData);
  }, [rowData, validateRow, onDataChange]);

  // Handle save
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(rowData);
      setHasChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Description', 'Quantity', 'Unit Price', 'Total', 'HS Code', 'Country of Origin', 'Confidence'];
    const csvRows = rowData.map(row => [
      row.description,
      row.quantity,
      row.unitPrice.toFixed(2),
      (row.quantity * row.unitPrice).toFixed(2),
      row.hsCode || '',
      row.countryOfOrigin || '',
      Math.round(row.confidence * 100) + '%'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extracted-data-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalValue = rowData.reduce((sum, row) => sum + (row.quantity * row.unitPrice), 0);
    const avgConfidence = rowData.reduce((sum, row) => sum + row.confidence, 0) / (rowData.length || 1);
    const errorCount = rowData.filter(row => Object.keys(row.errors || {}).length > 0).length;
    const lowConfidenceCount = rowData.filter(row => row.confidence < 0.80).length;

    return { totalValue, avgConfidence, errorCount, lowConfidenceCount };
  }, [rowData]);

  return (
    <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} rounded-2xl shadow-2xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} overflow-hidden`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">Extracted Line Items</h3>
            <p className="text-sm text-blue-100 mt-1">{rowData.length} items • Double-click cells to edit</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            {onSave && (
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  hasChanges
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg'
                    : 'bg-white/10 text-white/50 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-blue-100">Total Value</div>
            <div className="text-xl font-bold">€{stats.totalValue.toFixed(2)}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-blue-100">Avg Confidence</div>
            <div className="text-xl font-bold">{Math.round(stats.avgConfidence * 100)}%</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-blue-100">Errors</div>
            <div className="text-xl font-bold flex items-center gap-2">
              {stats.errorCount}
              {stats.errorCount > 0 && <AlertTriangle className="w-4 h-4" />}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-blue-100">Low Confidence</div>
            <div className="text-xl font-bold">{stats.lowConfidenceCount}</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={`flex items-center gap-6 px-6 py-3 text-sm border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100"></div>
          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>High Confidence (≥95%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-100"></div>
          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>Medium Confidence (80-95%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100"></div>
          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>Error or Low Confidence (&lt;80%)</span>
        </div>
      </div>

      {/* Table */}
      <div className="h-[500px] w-full">
        <style>{`
          .ag-theme-alpine {
            --ag-background-color: ${isDarkMode ? '#0f172a' : '#ffffff'};
            --ag-foreground-color: ${isDarkMode ? '#e2e8f0' : '#1e293b'};
            --ag-header-background-color: ${isDarkMode ? '#1e293b' : '#f1f5f9'};
            --ag-header-foreground-color: ${isDarkMode ? '#e2e8f0' : '#334155'};
            --ag-border-color: ${isDarkMode ? '#334155' : '#e2e8f0'};
            --ag-row-hover-color: ${isDarkMode ? '#1e293b' : '#f8fafc'};
          }
          .ag-cell-error {
            background-color: rgba(239, 68, 68, 0.1) !important;
            border-left: 3px solid #ef4444 !important;
          }
          .ag-cell-warning {
            background-color: rgba(245, 158, 11, 0.1) !important;
            border-left: 3px solid #f59e0b !important;
          }
          .ag-cell-success {
            background-color: rgba(16, 185, 129, 0.05) !important;
          }
        `}</style>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            cellStyle: { fontSize: '14px' },
          }}
          onCellValueChanged={onCellValueChanged}
          enableRangeSelection={true}
          enableFillHandle={true}
          undoRedoCellEditing={true}
          undoRedoCellEditingLimit={20}
          stopEditingWhenCellsLoseFocus={true}
          tooltipShowDelay={300}
          className="ag-theme-alpine"
          animateRows={true}
          enableCellTextSelection={true}
          suppressMovableColumns={false}
        />
      </div>

      {/* Footer message */}
      {hasChanges && (
        <div className={`px-6 py-3 flex items-center gap-2 text-sm ${isDarkMode ? 'bg-amber-950/30 text-amber-300 border-t border-amber-500/30' : 'bg-amber-50 text-amber-800 border-t border-amber-200'}`}>
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium">You have unsaved changes</span>
        </div>
      )}
    </div>
  );
};
