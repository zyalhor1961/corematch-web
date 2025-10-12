'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, Eye, RefreshCw, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// Field type color indicators (Azure style)
const FIELD_TYPE_COLORS = {
  amount: '#DC3545', // Red - Financial
  address: '#FD7E14', // Orange - Location
  recipient: '#28A745', // Green - Recipient
  entity: '#007BFF', // Blue - Entity
  date: '#6F42C1', // Purple - Date
  text: '#6C757D', // Gray - Text
  number: '#17A2B8', // Cyan - Numbers
  email: '#20C997', // Teal - Email
  phone: '#FFC107', // Yellow - Phone
  default: '#6C757D' // Gray - Default
};

// Detect field category for color coding
function detectFieldCategory(name: string): keyof typeof FIELD_TYPE_COLORS {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('amount') || lowerName.includes('total') || lowerName.includes('price')) return 'amount';
  if (lowerName.includes('address') || lowerName.includes('location')) return 'address';
  if (lowerName.includes('recipient') || lowerName.includes('customer')) return 'recipient';
  if (lowerName.includes('vendor') || lowerName.includes('company')) return 'entity';
  if (lowerName.includes('date')) return 'date';
  if (lowerName.includes('email')) return 'email';
  if (lowerName.includes('phone')) return 'phone';
  if (lowerName.includes('number') || lowerName.includes('invoice')) return 'number';

  return 'default';
}

interface ExtractedField {
  id: string;
  field_name: string;
  value_text: string;
  confidence: number;
  page_number: number;
  bounding_region?: any[];
}

interface EnhancedInvoiceViewerProps {
  documentId: string;
  pdfUrl: string;
  onClose: () => void;
}

export const EnhancedInvoiceViewer: React.FC<EnhancedInvoiceViewerProps> = ({
  documentId,
  pdfUrl,
  onClose
}) => {
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  // Load extracted fields
  useEffect(() => {
    const loadFields = async () => {
      try {
        const response = await fetch(`/api/idp/documents/${documentId}/fields`);
        const data = await response.json();
        if (data.success) {
          setFields(data.data || []);
        }
      } catch (error) {
        console.error('Error loading fields:', error);
      } finally {
        setIsLoadingFields(false);
      }
    };

    loadFields();
  }, [documentId]);

  // Process fields with bounding boxes
  const processedFields = useMemo(() => {
    return fields.map((field, index) => ({
      id: field.id,
      name: field.field_name,
      value: field.value_text,
      confidence: field.confidence,
      pageNumber: field.page_number || 1,
      boundingBox: field.bounding_region || [],
      category: detectFieldCategory(field.field_name),
      color: FIELD_TYPE_COLORS[detectFieldCategory(field.field_name)]
    }));
  }, [fields]);

  // Filter fields by current page
  const currentPageFields = processedFields.filter(f => f.pageNumber === currentPage);

  // Format field name
  const formatFieldName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, str => str.toUpperCase());
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return 'text-green-600';
    if (confidence >= 0.80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Handle PDF load
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoadingPdf(false);
  };

  // Zoom controls
  const handleZoomIn = () => setScale(s => Math.min(3.0, s + 0.2));
  const handleZoomOut = () => setScale(s => Math.max(0.5, s - 0.2));

  // Page navigation
  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(numPages, p + 1));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={onClose}
    >
      <div
        className="relative w-[95vw] h-[95vh] bg-white rounded-lg shadow-2xl flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Panel - Extracted Fields */}
        <div className="w-[350px] border-r border-slate-200 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-white">
            <h3 className="text-lg font-semibold text-slate-900">Extracted Fields</h3>
            <p className="text-xs text-slate-600 mt-1">
              {processedFields.length} fields detected
            </p>
          </div>

          {/* Fields List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isLoadingFields ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : processedFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Eye className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm text-slate-600">No fields extracted</p>
              </div>
            ) : (
              processedFields.map((field, index) => (
                <div
                  key={field.id}
                  className={`group py-2 px-3 rounded-md transition-all duration-200 cursor-pointer border-2 ${
                    hoveredFieldId === field.id || selectedFieldId === field.id
                      ? 'shadow-md scale-[1.02]'
                      : 'border-transparent scale-100'
                  }`}
                  style={{
                    borderColor: (hoveredFieldId === field.id || selectedFieldId === field.id) ? field.color : 'transparent',
                    backgroundColor: (hoveredFieldId === field.id || selectedFieldId === field.id)
                      ? `${field.color}20`
                      : '#ffffff'
                  }}
                  onMouseEnter={() => setHoveredFieldId(field.id)}
                  onMouseLeave={() => setHoveredFieldId(null)}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    setCurrentPage(field.pageNumber);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Color Indicator */}
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: field.color,
                          boxShadow: hoveredFieldId === field.id ? `0 0 8px ${field.color}` : 'none'
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate text-slate-900">
                            {formatFieldName(field.name)}
                          </span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-slate-200/70 text-slate-600">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="text-[11px] truncate mt-0.5 text-slate-600">
                          {String(field.value || '')}
                        </div>
                        {field.pageNumber > 1 && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Page {field.pageNumber}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getConfidenceColor(field.confidence)}`}>
                      {(field.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - PDF Viewer */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-800">
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= numPages) {
                      setCurrentPage(page);
                    }
                  }}
                  className="w-12 bg-transparent text-white text-center focus:outline-none"
                  min={1}
                  max={numPages}
                />
                <span className="text-white text-sm">/ {numPages}</span>
              </div>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-white text-sm font-medium min-w-[60px] text-center px-3 py-1.5 bg-slate-700 rounded-lg">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <XCircle className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* PDF Canvas */}
          <div className="flex-1 overflow-auto bg-slate-900 p-6 flex justify-center items-start">
            <div className="relative">
              {isLoadingPdf && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
                  <RefreshCw className="w-12 h-12 animate-spin text-white" />
                </div>
              )}

              <div className="relative inline-block">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  className="shadow-2xl"
                  loading={<div className="w-full h-96 bg-slate-800 rounded-lg animate-pulse" />}
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                    className="rounded-lg overflow-hidden bg-white"
                  />
                </Document>

                {/* Bounding Boxes Overlay */}
                {currentPageFields.length > 0 && (
                  <div className="absolute top-0 left-0 pointer-events-none">
                    {currentPageFields.map((field) => {
                      const isHovered = hoveredFieldId === field.id || selectedFieldId === field.id;
                      const boundingRegion = field.boundingBox;

                      if (!boundingRegion || boundingRegion.length === 0) return null;

                      // Azure returns polygon as array of point objects: [{x, y}, {x, y}, {x, y}, {x, y}]
                      const polygon = boundingRegion[0]?.polygon || [];
                      if (polygon.length < 4) return null;

                      // Convert from inches to pixels (72 points per inch)
                      const xCoords = polygon.map((p: any) => p.x * 72 * scale);
                      const yCoords = polygon.map((p: any) => p.y * 72 * scale);
                      const minX = Math.min(...xCoords);
                      const minY = Math.min(...yCoords);
                      const maxX = Math.max(...xCoords);
                      const maxY = Math.max(...yCoords);
                      const width = maxX - minX;
                      const height = maxY - minY;

                      return (
                        <div
                          key={field.id}
                          className="absolute pointer-events-auto cursor-pointer transition-all duration-200"
                          style={{
                            left: `${minX}px`,
                            top: `${minY}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                            border: `3px solid ${field.color}`,
                            backgroundColor: isHovered ? `${field.color}30` : `${field.color}15`,
                            boxShadow: isHovered ? `0 0 12px ${field.color}` : 'none',
                            zIndex: isHovered ? 10 : 1
                          }}
                          onMouseEnter={() => setHoveredFieldId(field.id)}
                          onMouseLeave={() => setHoveredFieldId(null)}
                          onClick={() => setSelectedFieldId(field.id)}
                        >
                          {/* Popup on hover */}
                          {isHovered && (
                            <div
                              className="absolute -top-2 left-0 transform -translate-y-full px-3 py-2 rounded-lg shadow-2xl z-50 min-w-[200px] max-w-[350px]"
                              style={{
                                backgroundColor: 'white',
                                border: `2px solid ${field.color}`,
                                boxShadow: `0 4px 20px ${field.color}40`
                              }}
                            >
                              {/* Field Name */}
                              <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-200">
                                <div
                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: field.color }}
                                />
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {formatFieldName(field.name)}
                                </span>
                              </div>

                              {/* Field Value */}
                              <div className="mb-1.5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Value</div>
                                <div className="text-sm font-semibold text-slate-800 break-words">
                                  {String(field.value)}
                                </div>
                              </div>

                              {/* Confidence */}
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Confidence</div>
                                <div className="flex items-center gap-1.5 flex-1">
                                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${field.confidence * 100}%`,
                                        backgroundColor: field.confidence >= 0.95 ? '#10b981' :
                                                        field.confidence >= 0.80 ? '#f59e0b' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold" style={{
                                    color: field.confidence >= 0.95 ? '#10b981' :
                                           field.confidence >= 0.80 ? '#f59e0b' : '#ef4444'
                                  }}>
                                    {(field.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer - Field Count */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
            <span className="text-sm text-slate-600">
              {currentPageFields.length} field{currentPageFields.length !== 1 ? 's' : ''} on this page
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
