'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, Eye, RefreshCw, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

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
  bounding_box?: any; // Contains { polygon: [...] }
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
  const [scale, setScale] = useState<number>(1.2);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pageHeights, setPageHeights] = useState<number[]>([]);

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
      boundingBox: field.bounding_box, // This is {polygon: [...]}
      category: detectFieldCategory(field.field_name),
      color: FIELD_TYPE_COLORS[detectFieldCategory(field.field_name)]
    }));
  }, [fields]);

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
                      ? `${field.color}35`
                      : '#ffffff',
                    borderWidth: (hoveredFieldId === field.id || selectedFieldId === field.id) ? '3px' : '2px'
                  }}
                  onMouseEnter={() => setHoveredFieldId(field.id)}
                  onMouseLeave={() => setHoveredFieldId(null)}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Color Indicator */}
                      <div
                        className="w-4 h-4 rounded-md flex-shrink-0"
                        style={{
                          backgroundColor: field.color,
                          boxShadow: hoveredFieldId === field.id ? `0 0 12px ${field.color}` : `0 0 4px ${field.color}50`
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
            {/* Document Info */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
              <span className="text-white text-sm font-medium">{numPages} {numPages === 1 ? 'page' : 'pages'}</span>
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
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg z-50">
                  <RefreshCw className="w-12 h-12 animate-spin text-white" />
                </div>
              )}

              <div className="relative inline-block space-y-4">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  className="shadow-2xl"
                  loading={<div className="w-full h-96 bg-slate-800 rounded-lg animate-pulse" />}
                >
                  {Array.from(new Array(numPages), (el, index) => {
                    const pageNum = index + 1;
                    const pageFields = processedFields.filter(f => f.pageNumber === pageNum);

                    return (
                      <div key={`page_${pageNum}`} className="relative mb-4 inline-block">
                        <Page
                          pageNumber={pageNum}
                          scale={scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={false}
                          className="rounded-lg overflow-hidden bg-white shadow-lg"
                          onLoadSuccess={(page) => {
                            // Track page heights for positioning
                            setPageHeights(prev => {
                              const newHeights = [...prev];
                              newHeights[pageNum - 1] = page.height * scale;
                              return newHeights;
                            });
                          }}
                        />

                        {/* Bounding Boxes Overlay for this page */}
                        {pageFields.length > 0 && (
                          <div className="absolute top-0 left-0 pointer-events-none w-full h-full">
                            {pageFields.map((field) => {
                      const isHovered = hoveredFieldId === field.id || selectedFieldId === field.id;
                      const boundingBox = field.boundingBox;

                      // Check if bounding box exists and has polygon data
                      if (!boundingBox || !boundingBox.polygon) {
                        console.log('No bounding box for field:', field.name);
                        return null;
                      }

                      const polygon = boundingBox.polygon;
                      if (!polygon || polygon.length < 4) {
                        console.log('Invalid polygon for field:', field.name, polygon);
                        return null;
                      }

                      // Azure returns polygon as array of point objects: [{x, y}, {x, y}, {x, y}, {x, y}]
                      // x and y are in inches, need to convert to pixels (72 points per inch)
                      let xCoords, yCoords, minX, minY, maxX, maxY, width, height;

                      try {
                        xCoords = polygon.map((p: any) => p.x * 72 * scale);
                        yCoords = polygon.map((p: any) => p.y * 72 * scale);
                        minX = Math.min(...xCoords);
                        minY = Math.min(...yCoords);
                        maxX = Math.max(...xCoords);
                        maxY = Math.max(...yCoords);
                        width = maxX - minX;
                        height = maxY - minY;

                        // Debug first field on first page
                        if (pageNum === 1 && field.id === pageFields[0]?.id) {
                          console.log('🔍 Bounding Box Debug:', {
                            fieldName: field.name,
                            polygon: polygon.slice(0, 2),
                            scale,
                            calculated: { minX, minY, width, height }
                          });
                        }
                      } catch (error) {
                        console.error('Error calculating bounding box:', field.name, error);
                        return null;
                      }

                      return (
                        <div
                          key={field.id}
                          className="absolute pointer-events-auto cursor-pointer transition-all duration-200"
                          style={{
                            left: `${minX}px`,
                            top: `${minY}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                            border: isHovered ? `2px solid ${field.color}` : `1px solid ${field.color}80`,
                            backgroundColor: isHovered ? `${field.color}35` : `${field.color}15`,
                            boxShadow: isHovered ? `0 0 12px ${field.color}60` : 'none',
                            zIndex: isHovered ? 10 : 1,
                            borderRadius: '2px'
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
                              <div>
                                <div className="text-sm font-semibold text-slate-800 break-words">
                                  {String(field.value)}
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
                    );
                  })}
                </Document>
              </div>
            </div>
          </div>

          {/* Footer - Total Field Count */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
            <span className="text-sm text-slate-600">
              {processedFields.length} field{processedFields.length !== 1 ? 's' : ''} total • {numPages} page{numPages !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
