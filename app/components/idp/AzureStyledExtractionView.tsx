'use client';

/**
 * Azure-Styled Extraction View
 *
 * Implements Azure Document Intelligence Studio design patterns:
 * - Split panel layout (60/40)
 * - Visual bounding boxes on PDF
 * - Synchronized highlighting
 * - Color-coded field dots
 * - Confidence meters
 * - Clean, minimal field cards
 * - Interactive table view
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  Download,
  Zap,
  RefreshCw,
  Eye
} from 'lucide-react';
import { IDPDocument } from './UnifiedIDPDashboard';

// Field type color indicators (Azure style)
export const FIELD_TYPE_COLORS = {
  amount: '#DC3545', // Red - Critical financial
  address: '#FD7E14', // Orange - Location data
  recipient: '#28A745', // Green - Recipient info
  entity: '#007BFF', // Blue - Customer/Entity
  date: '#6F42C1', // Purple - Date fields
  text: '#6C757D', // Gray - General text
  number: '#17A2B8', // Cyan - Numbers
  email: '#20C997', // Teal - Email
  phone: '#FFC107', // Yellow - Phone
  default: '#6C757D' // Gray - Default
};

// Detect field category for color coding
export function detectFieldCategory(name: string, type: string): keyof typeof FIELD_TYPE_COLORS {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('amount') || lowerName.includes('total') || lowerName.includes('price')) {
    return 'amount';
  }
  if (lowerName.includes('address') || lowerName.includes('location') || lowerName.includes('street')) {
    return 'address';
  }
  if (lowerName.includes('recipient') || lowerName.includes('to') || lowerName.includes('customer')) {
    return 'recipient';
  }
  if (lowerName.includes('from') || lowerName.includes('vendor') || lowerName.includes('company')) {
    return 'entity';
  }
  if (lowerName.includes('date') || type === 'date') {
    return 'date';
  }
  if (lowerName.includes('email')) {
    return 'email';
  }
  if (lowerName.includes('phone') || lowerName.includes('tel')) {
    return 'phone';
  }
  if (type === 'number' || type === 'integer' || type === 'float') {
    return 'number';
  }

  return 'default';
}

interface FieldWithBoundingBox {
  id: string;
  name: string;
  value: any;
  confidence: number;
  type: string;
  boundingBox?: number[];
  category?: keyof typeof FIELD_TYPE_COLORS;
}

interface AzureStyledExtractionViewProps {
  document: IDPDocument;
  azureData: any;
  isDarkMode?: boolean;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  hoveredFieldId: string | null;
  onFieldHover: (fieldId: string | null) => void;
  onFieldClick?: (fieldId: string) => void;
}

export const AzureStyledExtractionView: React.FC<AzureStyledExtractionViewProps> = ({
  document,
  azureData,
  isDarkMode = false,
  onAnalyze,
  isAnalyzing,
  hoveredFieldId,
  onFieldHover,
  onFieldClick
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'content' | 'result'>('fields');
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('prebuilt-invoice');
  const [currentTableIndex, setCurrentTableIndex] = useState(0);

  // Convert Azure fields to our format with bounding boxes
  const fields: FieldWithBoundingBox[] = useMemo(() => {
    if (!azureData?.fields) return [];

    return azureData.fields.map((field: any, index: number) => ({
      id: `field-${index}`,
      name: field.name,
      value: field.value,
      confidence: field.confidence,
      type: field.type,
      boundingBox: field.boundingBox,
      category: detectFieldCategory(field.name, field.type)
    }));
  }, [azureData]);

  // Toggle field expansion
  const toggleField = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  // Format field name for display
  const formatFieldName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, str => str.toUpperCase());
  };

  // Get confidence color class
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return 'text-green-600';
    if (confidence >= 0.80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Generate unique color for each field (hue-based for variety)
  const getFieldColor = (field: FieldWithBoundingBox) => {
    return FIELD_TYPE_COLORS[field.category || 'default'];
  };

  const availableModels = [
    { id: 'prebuilt-invoice', name: 'Invoice', icon: '📄' },
    { id: 'prebuilt-receipt', name: 'Receipt', icon: '🧾' },
    { id: 'prebuilt-document', name: 'General Document', icon: '📋' },
    { id: 'prebuilt-businessCard', name: 'Business Card', icon: '💳' },
    { id: 'prebuilt-idDocument', name: 'ID Document', icon: '🪪' }
  ];

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Top Action Bar */}
      <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3">
          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.icon} {model.name}
              </option>
            ))}
          </select>

          {/* Analyze Button */}
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:opacity-50`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Export Button */}
        {azureData && (
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      {azureData && (
        <div className={`flex items-center gap-1 px-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          {[
            { id: 'fields' as const, label: 'Fields' },
            { id: 'content' as const, label: 'Content' },
            { id: 'result' as const, label: 'Result' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium transition-all relative ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'text-blue-400'
                    : 'text-blue-600'
                  : isDarkMode
                    ? 'text-slate-400 hover:text-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                  isDarkMode ? 'bg-blue-400' : 'bg-blue-600'
                }`} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!azureData ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className={`w-20 h-20 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-4`}>
              <Eye className={`w-10 h-10 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              No Analysis Results
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Click "Analyze" to extract data from this document
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'fields' && (
              <div className="space-y-1">
                {/* Model Info Header */}
                <div className={`pb-3 mb-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-blue-200'}`}>
                  <h3 className={`text-sm font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {selectedModel.replace('prebuilt-', '')}
                  </h3>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    DocType: {azureData.modelId || selectedModel}
                  </p>
                </div>

                {/* Field Cards - Compact & Dynamic */}
                {fields.length === 0 ? (
                  <div className="text-center py-8">
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      No fields extracted from this document
                    </p>
                  </div>
                ) : (
                  fields.map((field, index) => {
                    const fieldColor = getFieldColor(field);
                    return (
                      <div
                        key={field.id}
                        className={`group py-2 px-3 rounded-md transition-all duration-200 cursor-pointer border-2 ${
                          hoveredFieldId === field.id
                            ? 'shadow-md scale-[1.02]'
                            : 'border-transparent scale-100'
                        }`}
                        style={{
                          borderColor: hoveredFieldId === field.id ? fieldColor : 'transparent',
                          backgroundColor: hoveredFieldId === field.id
                            ? `${fieldColor}20`
                            : isDarkMode
                              ? '#1e293b08'
                              : '#f8fafc'
                        }}
                        onMouseEnter={() => onFieldHover(field.id)}
                        onMouseLeave={() => onFieldHover(null)}
                        onClick={() => {
                          setSelectedField(field.id);
                          onFieldClick?.(field.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Color Square Indicator */}
                            <div
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{
                                backgroundColor: fieldColor,
                                boxShadow: hoveredFieldId === field.id ? `0 0 8px ${fieldColor}` : 'none'
                              }}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {formatFieldName(field.name)}
                                </span>
                                <span className={`text-[10px] px-1 py-0.5 rounded ${
                                  isDarkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-200/70 text-slate-600'
                                }`}>
                                  #{index + 1}
                                </span>
                              </div>
                              <div className={`text-[11px] truncate mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                {String(field.value || '')}
                              </div>
                            </div>
                          </div>

                          {/* Confidence Percentage */}
                          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getConfidenceColor(field.confidence)}`}>
                            {(field.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'content' && azureData.tables && azureData.tables.length > 0 && (
              <div className="space-y-4">
                {/* Table Pagination */}
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Current table
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentTableIndex(Math.max(0, currentTableIndex - 1))}
                      disabled={currentTableIndex === 0}
                      className={`p-1 rounded ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} disabled:opacity-30`}
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {currentTableIndex + 1} of {azureData.tables.length}
                    </span>
                    <button
                      onClick={() => setCurrentTableIndex(Math.min(azureData.tables.length - 1, currentTableIndex + 1))}
                      disabled={currentTableIndex >= azureData.tables.length - 1}
                      className={`p-1 rounded ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} disabled:opacity-30`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Table Display */}
                {azureData.tables[currentTableIndex] && (
                  <div className="overflow-x-auto rounded-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                    <table className="w-full">
                      <tbody>
                        {Array.from({ length: azureData.tables[currentTableIndex].rowCount }).map((_, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex === 0 ? (isDarkMode ? 'bg-slate-800' : 'bg-slate-50') : ''}>
                            {Array.from({ length: azureData.tables[currentTableIndex].columnCount }).map((_, colIndex) => {
                              const cell = azureData.tables[currentTableIndex].cells.find(
                                (c: any) => c.rowIndex === rowIndex && c.columnIndex === colIndex
                              );
                              const CellTag = rowIndex === 0 ? 'th' : 'td';
                              return (
                                <CellTag
                                  key={colIndex}
                                  className={`border px-3 py-2 text-sm text-left ${
                                    isDarkMode
                                      ? 'border-slate-700 text-slate-300'
                                      : 'border-slate-200 text-slate-700'
                                  } ${rowIndex === 0 ? 'font-semibold' : ''}`}
                                >
                                  {cell ? cell.content : ''}
                                </CellTag>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'result' && (
              <div className="space-y-4">
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Analysis Summary
                </h3>
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Model</p>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {azureData.modelId}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Confidence</p>
                      <p className={`text-sm font-medium ${getConfidenceColor(azureData.confidence)}`}>
                        {(azureData.confidence * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Fields Extracted</p>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {fields.length}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Tables Found</p>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {azureData.tables?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
