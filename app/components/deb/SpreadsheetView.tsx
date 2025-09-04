'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/app/components/ThemeProvider';
import { 
  Download, 
  Plus, 
  Minus, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Search,
  Settings,
  Eye,
  EyeOff,
  Edit3,
  Save,
  X,
  FileSpreadsheet,
  FileText,
  Copy,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface InvoiceData {
  id: string;
  document_id: string;
  filename: string;
  doc_type: string;
  supplier_name: string;
  supplier_vat: string;
  supplier_country: string;
  supplier_address: string;
  invoice_number: string;
  invoice_date: string;
  delivery_note_number?: string;
  total_ht: number;
  total_ttc: number;
  shipping_total?: number;
  currency: string;
  incoterm?: string;
  transport_mode?: string;
  status: string;
  confidence_avg?: number;
  created_at: string;
  lines?: InvoiceLine[];
}

interface InvoiceLine {
  id: string;
  line_no: number;
  description: string;
  sku?: string;
  qty: number;
  unit?: string;
  unit_price: number;
  line_amount: number;
  hs_code?: string;
  country_of_origin?: string;
  net_mass_kg?: number;
}

interface Column {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  visible: boolean;
  width: number;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
}

interface SpreadsheetViewProps {
  data: InvoiceData[];
  onDataChange?: (data: InvoiceData[]) => void;
}

export default function SpreadsheetView({ data, onDataChange }: SpreadsheetViewProps) {
  const { isDarkMode } = useTheme();
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'lines'>('summary');

  const [columns, setColumns] = useState<Column[]>([
    { id: '1', key: 'filename', label: 'Fichier', type: 'text', visible: true, width: 150, sortable: true, filterable: true, editable: false },
    { id: '2', key: 'doc_type', label: 'Type Document', type: 'text', visible: true, width: 120, sortable: true, filterable: true, editable: true },
    { id: '3', key: 'supplier_name', label: 'Fournisseur', type: 'text', visible: true, width: 200, sortable: true, filterable: true, editable: true },
    { id: '4', key: 'supplier_vat', label: 'TVA Fournisseur', type: 'text', visible: true, width: 140, sortable: true, filterable: true, editable: true },
    { id: '5', key: 'supplier_country', label: 'Pays', type: 'text', visible: true, width: 80, sortable: true, filterable: true, editable: true },
    { id: '6', key: 'invoice_number', label: 'N° Facture', type: 'text', visible: true, width: 130, sortable: true, filterable: true, editable: true },
    { id: '7', key: 'invoice_date', label: 'Date Facture', type: 'date', visible: true, width: 120, sortable: true, filterable: true, editable: true },
    { id: '8', key: 'delivery_note_number', label: 'N° BL', type: 'text', visible: false, width: 120, sortable: true, filterable: true, editable: true },
    { id: '9', key: 'total_ht', label: 'Total HT', type: 'currency', visible: true, width: 120, sortable: true, filterable: true, editable: true },
    { id: '10', key: 'total_ttc', label: 'Total TTC', type: 'currency', visible: true, width: 120, sortable: true, filterable: true, editable: true },
    { id: '11', key: 'shipping_total', label: 'Frais Port', type: 'currency', visible: false, width: 120, sortable: true, filterable: true, editable: true },
    { id: '12', key: 'currency', label: 'Devise', type: 'text', visible: true, width: 80, sortable: true, filterable: true, editable: true },
    { id: '13', key: 'incoterm', label: 'Incoterm', type: 'text', visible: false, width: 100, sortable: true, filterable: true, editable: true },
    { id: '14', key: 'transport_mode', label: 'Mode Transport', type: 'text', visible: false, width: 130, sortable: true, filterable: true, editable: true },
    { id: '15', key: 'status', label: 'Statut', type: 'text', visible: true, width: 100, sortable: true, filterable: true, editable: false },
    { id: '16', key: 'confidence_avg', label: 'Confiance IA', type: 'percentage', visible: false, width: 120, sortable: true, filterable: true, editable: false },
    { id: '17', key: 'created_at', label: 'Date Création', type: 'date', visible: true, width: 140, sortable: true, filterable: true, editable: false },
  ]);

  // Données filtrées et triées
  const processedData = useMemo(() => {
    let result = [...data];

    // Recherche globale
    if (searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Filtres par colonne
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => {
          const itemValue = item[key as keyof InvoiceData];
          return itemValue?.toString().toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Tri
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof InvoiceData];
        const bVal = b[sortConfig.key as keyof InvoiceData];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, filters, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatCellValue = (value: any, type: Column['type']) => {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(Number(value) || 0);
      case 'percentage':
        return `${Math.round((Number(value) || 0) * 100)}%`;
      case 'date':
        return value ? new Date(value).toLocaleDateString('fr-FR') : '';
      case 'number':
        return Number(value).toLocaleString('fr-FR');
      default:
        return value.toString();
    }
  };

  const handleCellEdit = (rowIndex: number, colKey: string, value: any) => {
    setEditingCell({ row: rowIndex, col: colKey });
    setEditValue(value?.toString() || '');
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    
    const newData = [...processedData];
    const row = newData[editingCell.row];
    (row as any)[editingCell.col] = editValue;
    
    onDataChange?.(newData);
    setEditingCell(null);
    setEditValue('');
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const exportToExcel = () => {
    const visibleColumns = columns.filter(col => col.visible);
    const exportData = processedData.map(row => {
      const exportRow: any = {};
      visibleColumns.forEach(col => {
        exportRow[col.label] = formatCellValue(row[col.key as keyof InvoiceData], col.type);
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Factures DEB');
    XLSX.writeFile(wb, `factures_deb_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const visibleColumns = columns.filter(col => col.visible);
    const headers = visibleColumns.map(col => col.label).join(',');
    const rows = processedData.map(row => 
      visibleColumns.map(col => {
        const value = formatCellValue(row[col.key as keyof InvoiceData], col.type);
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `factures_deb_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const addCustomColumn = () => {
    const newColumn: Column = {
      id: Date.now().toString(),
      key: `custom_${Date.now()}`,
      label: 'Nouvelle Colonne',
      type: 'text',
      visible: true,
      width: 150,
      sortable: true,
      filterable: true,
      editable: true
    };
    setColumns(prev => [...prev, newColumn]);
  };

  const removeColumn = (columnId: string) => {
    setColumns(prev => prev.filter(col => col.id !== columnId));
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  const selectAllRows = () => {
    if (selectedRows.size === processedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(processedData.map(row => row.id)));
    }
  };

  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const newData = processedData.filter(row => !selectedRows.has(row.id));
    onDataChange?.(newData);
    setSelectedRows(new Set());
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className={`${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} rounded-xl shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      {/* Header Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">Vue Tableur - {processedData.length} factures</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1 rounded ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Résumé
              </button>
              <button
                onClick={() => setViewMode('lines')}
                className={`px-3 py-1 rounded ${viewMode === 'lines' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Lignes
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Export Buttons */}
            <button
              onClick={exportToExcel}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              CSV
            </button>

            {/* Column Settings */}
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Colonnes
            </button>

            {/* Add Column */}
            <button
              onClick={addCustomColumn}
              className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Colonne
            </button>

            {/* Delete Selected */}
            {selectedRows.size > 0 && (
              <button
                onClick={deleteSelectedRows}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer ({selectedRows.size})
              </button>
            )}
          </div>
        </div>

        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {columns.map(col => (
                <div key={col.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumnVisibility(col.id)}
                    className="form-checkbox"
                  />
                  <span className="text-sm">{col.label}</span>
                  {col.key.startsWith('custom_') && (
                    <button
                      onClick={() => removeColumn(col.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'} sticky top-0`}>
            <tr>
              <th className="w-8 p-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === processedData.length && processedData.length > 0}
                  onChange={selectAllRows}
                  className="form-checkbox"
                />
              </th>
              {visibleColumns.map(col => (
                <th
                  key={col.id}
                  className="p-2 text-left border-r border-gray-200 dark:border-gray-600"
                  style={{ width: col.width }}
                >
                  <div className="flex items-center space-x-1">
                    <span className="font-medium text-sm">{col.label}</span>
                    {col.sortable && (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortConfig?.key === col.key ? (
                          sortConfig.direction === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                        ) : (
                          <Filter className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  {col.filterable && (
                    <input
                      type="text"
                      placeholder="Filtrer..."
                      className="mt-1 w-full px-2 py-1 text-xs border rounded"
                      onChange={(e) => handleFilter(col.key, e.target.value)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 ${
                  selectedRows.has(row.id) ? 'bg-blue-50 dark:bg-blue-900' : ''
                }`}
              >
                <td className="w-8 p-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={() => toggleRowSelection(row.id)}
                    className="form-checkbox"
                  />
                </td>
                {visibleColumns.map(col => (
                  <td
                    key={col.id}
                    className="p-2 border-r border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                    onClick={() => col.editable && handleCellEdit(rowIndex, col.key, row[col.key as keyof InvoiceData])}
                  >
                    {editingCell?.row === rowIndex && editingCell?.col === col.key ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
                          onKeyPress={(e) => e.key === 'Enter' && saveCellEdit()}
                          onBlur={saveCellEdit}
                          autoFocus
                        />
                        <button onClick={saveCellEdit} className="text-green-600">
                          <Save className="w-3 h-3" />
                        </button>
                        <button onClick={cancelCellEdit} className="text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {formatCellValue(row[col.key as keyof InvoiceData], col.type)}
                        </span>
                        {col.editable && (
                          <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400" />
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800">
        <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
          <div>
            Total: {processedData.length} lignes | Sélectionnées: {selectedRows.size}
          </div>
          <div className="flex space-x-4">
            <span>
              Total HT: {formatCellValue(
                processedData.reduce((sum, row) => sum + (Number(row.total_ht) || 0), 0),
                'currency'
              )}
            </span>
            <span>
              Total TTC: {formatCellValue(
                processedData.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0),
                'currency'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}