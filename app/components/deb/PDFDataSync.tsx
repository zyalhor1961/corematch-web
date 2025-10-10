'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface ExtractedField {
  id: string;
  label: string;
  value: string;
  confidence: number;
  bbox?: { page: number; x: number; y: number; width: number; height: number };
}

interface PDFDataSyncProps {
  pdfUrl: string;
  extractedData: ExtractedField[];
  onFieldUpdate: (id: string, newValue: string) => void;
  isDarkMode?: boolean;
}

export const PDFDataSync: React.FC<PDFDataSyncProps> = ({
  pdfUrl,
  extractedData,
  onFieldUpdate,
  isDarkMode = false
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState(true);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return isDarkMode ? 'bg-green-900/30 border-green-500' : 'bg-green-100 border-green-500';
    if (confidence >= 0.80) return isDarkMode ? 'bg-yellow-900/30 border-yellow-500' : 'bg-yellow-100 border-yellow-500';
    return isDarkMode ? 'bg-red-900/30 border-red-500' : 'bg-red-100 border-red-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.95) return 'High';
    if (confidence >= 0.80) return 'Medium';
    return 'Low';
  };

  const handleFieldClick = (field: ExtractedField) => {
    setSelectedField(field.id);
    if (field.bbox) {
      setCurrentPage(field.bbox.page);
    }
  };

  const currentPageFields = extractedData.filter(f => f.bbox?.page === currentPage);

  return (
    <div className={`flex h-[calc(100vh-200px)] ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} shadow-2xl`}>
      {/* PDF Viewer - Left Side */}
      <div className={`w-1/2 flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-900'}`}>
        {/* Toolbar */}
        <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-slate-800'} p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-700'}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white text-sm font-medium min-w-[120px] text-center">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
              className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
              className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            )}
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setIsLoading(false);
              }}
              onLoadError={(error) => {
                console.error('PDF load error:', error);
                setIsLoading(false);
              }}
              className="shadow-2xl"
              loading={<div className="w-full h-96 bg-slate-800 rounded-lg animate-pulse" />}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="rounded-lg overflow-hidden"
              />
            </Document>

            {/* Bounding Box Overlays */}
            {currentPageFields.map((field) => field.bbox && (
              <div
                key={field.id}
                onClick={() => setSelectedField(field.id)}
                className={`absolute border-2 cursor-pointer transition-all ${
                  selectedField === field.id
                    ? 'border-blue-500 bg-blue-500/30 ring-4 ring-blue-500/50 z-10 scale-105'
                    : 'border-green-400 bg-green-400/20 hover:bg-green-400/30 hover:scale-105'
                }`}
                style={{
                  left: `${field.bbox.x * scale}px`,
                  top: `${field.bbox.y * scale}px`,
                  width: `${field.bbox.width * scale}px`,
                  height: `${field.bbox.height * scale}px`,
                }}
                title={`${field.label}: ${field.value} (${Math.round(field.confidence * 100)}%)`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Data Editor - Right Side */}
      <div className={`w-1/2 overflow-auto ${isDarkMode ? 'bg-slate-900' : 'bg-white'} border-l ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6 shadow-lg z-10">
          <h2 className="text-2xl font-bold">Extracted Data</h2>
          <p className="text-sm text-blue-100 mt-2 flex items-center gap-2">
            <span>📄 {extractedData.length} fields detected</span>
            <span>•</span>
            <span>Click to sync with PDF</span>
          </p>
        </div>

        <div className="p-6 space-y-4">
          {extractedData.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <p>No extracted data available</p>
            </div>
          ) : (
            extractedData.map((field) => (
              <div
                key={field.id}
                onClick={() => handleFieldClick(field)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedField === field.id
                    ? isDarkMode
                      ? 'border-blue-500 bg-blue-950/30 shadow-2xl shadow-blue-500/20 scale-[1.02]'
                      : 'border-blue-500 bg-blue-50 shadow-2xl shadow-blue-200/50 scale-[1.02]'
                    : getConfidenceColor(field.confidence) + ' hover:shadow-lg hover:scale-[1.01]'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <label className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                        field.confidence >= 0.95
                          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                          : field.confidence >= 0.80
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                            : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                      }`}
                    >
                      {getConfidenceLabel(field.confidence)} • {Math.round(field.confidence * 100)}%
                    </span>
                    {field.bbox && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPage(field.bbox!.page);
                        }}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg transition-all ${
                          isDarkMode
                            ? 'text-blue-400 hover:bg-blue-950 hover:text-blue-300'
                            : 'text-blue-600 hover:bg-blue-100 hover:text-blue-800'
                        }`}
                      >
                        Page {field.bbox.page}
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => onFieldUpdate(field.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:bg-slate-750'
                      : field.confidence < 0.80
                        ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                  } focus:outline-none`}
                  placeholder="Enter value..."
                />

                {field.confidence < 0.80 && (
                  <div className={`mt-3 flex items-start gap-2 text-xs p-3 rounded-lg ${
                    isDarkMode ? 'text-red-300 bg-red-950/50 border border-red-500/30' : 'text-red-800 bg-red-50 border border-red-200'
                  }`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Low confidence detected - Please verify this value carefully before proceeding</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
