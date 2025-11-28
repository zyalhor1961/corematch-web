'use client';

/**
 * InteractiveOverlay - Universal Human-in-the-Loop Correction Tool
 *
 * This component overlays the PDF viewer and allows users to click on
 * pre-detected OCR words to correct extracted field values.
 *
 * Works with ANY document type:
 * - Invoices: vendor_name, invoice_date, total_amount, etc.
 * - Contracts: summary, effective_date, parties, terms
 * - Quotations: vendor, quote_date, validity, total_amount
 * - Generic: custom field assignment
 *
 * Key advantages over "draw a box" approach:
 * - No need to re-run OCR on selected region
 * - Guaranteed clean text from Azure's pre-detected words
 * - Faster and more accurate corrections
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Check, X, RotateCcw, GripHorizontal, ChevronDown } from 'lucide-react';

// ============================================================================
// DOCUMENT TYPE FIELD DEFINITIONS
// ============================================================================

type DocumentType = 'invoice' | 'contract' | 'quotation' | 'generic';

interface FieldDefinition {
  key: string;
  label: string;
  description: string;
}

const DOCUMENT_FIELDS: Record<DocumentType, FieldDefinition[]> = {
  invoice: [
    { key: 'vendor_name', label: 'Fournisseur', description: 'Nom du fournisseur' },
    { key: 'invoice_number', label: 'N° Facture', description: 'Numéro de facture' },
    { key: 'invoice_date', label: 'Date', description: 'Date de facturation' },
    { key: 'due_date', label: 'Échéance', description: 'Date d\'échéance' },
    { key: 'total_amount', label: 'Total TTC', description: 'Montant total TTC' },
    { key: 'subtotal_ht', label: 'Total HT', description: 'Montant hors taxes' },
    { key: 'total_tax', label: 'TVA', description: 'Montant de la TVA' },
    { key: 'reference', label: 'Référence', description: 'Référence commande' },
    { key: 'vendor_siren', label: 'SIREN/SIRET', description: 'Identifiant entreprise' },
  ],
  contract: [
    { key: 'title', label: 'Titre', description: 'Titre du contrat' },
    { key: 'parties', label: 'Parties', description: 'Parties contractantes' },
    { key: 'effective_date', label: 'Date d\'effet', description: 'Date de début' },
    { key: 'end_date', label: 'Date de fin', description: 'Date d\'expiration' },
    { key: 'summary', label: 'Résumé', description: 'Résumé des termes' },
    { key: 'value', label: 'Valeur', description: 'Valeur du contrat' },
    { key: 'terms', label: 'Conditions', description: 'Conditions particulières' },
  ],
  quotation: [
    { key: 'vendor_name', label: 'Fournisseur', description: 'Nom du fournisseur' },
    { key: 'quote_number', label: 'N° Devis', description: 'Numéro de devis' },
    { key: 'quote_date', label: 'Date', description: 'Date du devis' },
    { key: 'validity_date', label: 'Validité', description: 'Date de validité' },
    { key: 'total_amount', label: 'Total TTC', description: 'Montant total TTC' },
    { key: 'subtotal_ht', label: 'Total HT', description: 'Montant hors taxes' },
    { key: 'total_tax', label: 'TVA', description: 'Montant de la TVA' },
  ],
  generic: [
    { key: 'title', label: 'Titre', description: 'Titre du document' },
    { key: 'date', label: 'Date', description: 'Date principale' },
    { key: 'author', label: 'Auteur', description: 'Auteur/Émetteur' },
    { key: 'summary', label: 'Résumé', description: 'Résumé du contenu' },
    { key: 'reference', label: 'Référence', description: 'Numéro de référence' },
    { key: 'amount', label: 'Montant', description: 'Montant (si applicable)' },
    { key: 'custom', label: 'Personnalisé', description: 'Champ personnalisé' },
  ],
};

// ============================================================================
// TYPES
// ============================================================================

interface AzureWord {
  content: string;
  polygon: number[]; // [x1, y1, x2, y2, x3, y3, x4, y4] - 4 corners
  confidence?: number;
  span?: { offset: number; length: number };
}

interface AzureLine {
  content: string;
  polygon: number[];
  confidence?: number;
}

interface AzurePage {
  pageNumber?: number;
  page_number?: number; // Alternative naming (snake_case from Python)
  width: number;
  height: number;
  unit: string; // "inch" or "pixel"
  words?: AzureWord[];
  lines?: AzureLine[];
}

interface AzureRawData {
  pages?: AzurePage[];
  analyzeResult?: { pages?: AzurePage[] }; // Alternative structure
  // Other Azure fields we don't need for this component
}

interface InteractiveOverlayProps {
  /** Raw Azure Document Intelligence JSON data */
  rawAzureData: AzureRawData | null;
  /** Is selection mode active? */
  isSelectionMode: boolean;
  /** Which field is being corrected (e.g., "vendor_name", "invoice_date") */
  targetField: string | null;
  /** Callback when user confirms their selection */
  onCorrect: (fieldName: string, newValue: string) => void;
  /** Callback to cancel selection mode */
  onCancel: () => void;
  /** Current page number (1-indexed) */
  currentPage?: number;
  /** Container width in pixels (for scaling) */
  containerWidth?: number;
  /** Container height in pixels (for scaling) */
  containerHeight?: number;
  /** Document type for field suggestions */
  documentType?: DocumentType;
  /** Allow user to pick which field to assign (when targetField is null) */
  allowFieldSelection?: boolean;
  /** Always show word boxes (even when not in selection mode) */
  alwaysShowWords?: boolean;
}


/**
 * Extract pages array from various Azure data structures
 */
function extractPages(rawData: AzureRawData | null): AzurePage[] {
  if (!rawData) return [];

  // Try different possible structures
  if (rawData.pages && rawData.pages.length > 0) {
    return rawData.pages;
  }
  if (rawData.analyzeResult?.pages && rawData.analyzeResult.pages.length > 0) {
    return rawData.analyzeResult.pages;
  }

  return [];
}

/**
 * Extract words from Azure raw data for a specific page.
 */
function extractWordsFromPage(page: AzurePage): AzureWord[] {
  if (page.words && page.words.length > 0) {
    console.log('[InteractiveOverlay] Found words:', page.words.length);
    return page.words;
  }
  console.log('[InteractiveOverlay] No words found in page');
  return [];
}

/**
 * Extract lines from Azure raw data for a specific page.
 * Lines are groups of words that form a logical line of text.
 */
function extractLinesFromPage(page: AzurePage): AzureLine[] {
  if (page.lines && page.lines.length > 0) {
    console.log('[InteractiveOverlay] Found lines:', page.lines.length);
    return page.lines;
  }

  // Fallback: if no lines, use words as individual "lines"
  if (page.words && page.words.length > 0) {
    console.log('[InteractiveOverlay] Falling back to words as lines');
    return page.words.map(word => ({
      content: word.content,
      polygon: word.polygon,
      confidence: word.confidence
    }));
  }

  console.log('[InteractiveOverlay] No lines or words found in page');
  return [];
}

// ============================================================================
// HELPER: Convert polygon array to SVG points string
// ============================================================================

function polygonToSvgPoints(polygon: number[]): string {
  if (!polygon || polygon.length < 4) return '';

  // Convert flat array [x1, y1, x2, y2, ...] to "x1,y1 x2,y2 ..." format
  const points: string[] = [];
  for (let i = 0; i < polygon.length; i += 2) {
    if (i + 1 < polygon.length) {
      points.push(`${polygon[i]},${polygon[i + 1]}`);
    }
  }
  return points.join(' ');
}

/**
 * Get bounding box from polygon for click area
 */
function getBoundingBox(polygon: number[]): { x: number; y: number; width: number; height: number } {
  if (!polygon || polygon.length < 4) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const xCoords: number[] = [];
  const yCoords: number[] = [];
  for (let i = 0; i < polygon.length; i += 2) {
    xCoords.push(polygon[i]);
    if (i + 1 < polygon.length) yCoords.push(polygon[i + 1]);
  }

  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const InteractiveOverlay: React.FC<InteractiveOverlayProps> = ({
  rawAzureData,
  isSelectionMode,
  targetField,
  onCorrect,
  onCancel,
  currentPage = 1,
  documentType = 'invoice',
  allowFieldSelection = false,
  alwaysShowWords = false,
}) => {
  // Track selected words in order
  const [selectedWords, setSelectedWords] = useState<AzureWord[]>([]);

  // Track hovered word for tooltip
  const [hoveredWord, setHoveredWord] = useState<{ word: AzureWord; x: number; y: number } | null>(null);

  // Field selection state (when targetField is null and allowFieldSelection is true)
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isFieldDropdownOpen, setIsFieldDropdownOpen] = useState(false);

  // Get available fields for current document type
  const availableFields = useMemo(() => DOCUMENT_FIELDS[documentType] || DOCUMENT_FIELDS.generic, [documentType]);

  // Effective target field (from props or selected)
  const effectiveTargetField = targetField || selectedField;

  // Draggable toolbar state
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setToolbarPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Get all pages from various possible structures
  const allPages = useMemo(() => {
    console.log('[InteractiveOverlay] === DEBUG START ===');
    console.log('[InteractiveOverlay] rawAzureData:', rawAzureData);
    console.log('[InteractiveOverlay] rawAzureData type:', typeof rawAzureData);
    if (rawAzureData) {
      console.log('[InteractiveOverlay] rawAzureData keys:', Object.keys(rawAzureData));
      console.log('[InteractiveOverlay] rawAzureData.pages:', rawAzureData.pages);
      if (rawAzureData.pages?.[0]) {
        console.log('[InteractiveOverlay] Page 0 keys:', Object.keys(rawAzureData.pages[0]));
        console.log('[InteractiveOverlay] Page 0 words:', rawAzureData.pages[0].words?.length || 'undefined');
      }
    }
    const pages = extractPages(rawAzureData);
    console.log('[InteractiveOverlay] Extracted pages count:', pages.length);
    console.log('[InteractiveOverlay] === DEBUG END ===');
    return pages;
  }, [rawAzureData]);

  // Get page data for current page
  const pageData = useMemo(() => {
    if (allPages.length === 0) return null;
    // Support both pageNumber and page_number (snake_case from Python)
    const page = allPages.find(p =>
      (p.pageNumber === currentPage) || (p.page_number === currentPage)
    ) || allPages[0];
    console.log('[InteractiveOverlay] Current page data:', page);
    return page;
  }, [allPages, currentPage]);

  // Extract words from current page (for selection mode)
  const words = useMemo(() => {
    if (!pageData) {
      console.log('[InteractiveOverlay] No page data available');
      return [];
    }
    const extractedWords = extractWordsFromPage(pageData);
    if (extractedWords.length > 0) {
      console.log('[InteractiveOverlay] First word sample:', extractedWords[0]);
    }
    return extractedWords;
  }, [pageData]);

  // Extract lines from current page (for display mode)
  const lines = useMemo(() => {
    if (!pageData) return [];
    return extractLinesFromPage(pageData);
  }, [pageData]);

  // Build selection string
  const selectedText = useMemo(() => {
    return selectedWords.map(w => w.content).join(' ');
  }, [selectedWords]);

  // Handle word click (toggle selection)
  const handleWordClick = useCallback((word: AzureWord) => {
    setSelectedWords(prev => {
      const index = prev.findIndex(w => w === word);
      if (index >= 0) {
        // Remove from selection
        return [...prev.slice(0, index), ...prev.slice(index + 1)];
      } else {
        // Add to selection
        return [...prev, word];
      }
    });
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (effectiveTargetField && selectedText.trim()) {
      onCorrect(effectiveTargetField, selectedText.trim());
      setSelectedWords([]);
      setSelectedField(null);
      setIsFieldDropdownOpen(false);
    }
  }, [effectiveTargetField, selectedText, onCorrect]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedWords([]);
    setSelectedField(null);
    setIsFieldDropdownOpen(false);
    onCancel();
  }, [onCancel]);

  // Handle clear selection
  const handleClear = useCallback(() => {
    setSelectedWords([]);
  }, []);

  // Handle field selection
  const handleFieldSelect = useCallback((fieldKey: string) => {
    setSelectedField(fieldKey);
    setIsFieldDropdownOpen(false);
  }, []);

  // Always render word boxes, but only enable selection when in selection mode
  // Use alwaysShowWords to show word boxes even when not selecting

  // Determine what data to display
  const showWords = isSelectionMode || alwaysShowWords;
  const displayItems = showWords ? words : lines;

  // Show message if no page data or display items - only when in selection mode
  if (!pageData || displayItems.length === 0) {
    if (!isSelectionMode) return null; // Silently return if not in selection mode

    return (
      <div
        className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-slate-800 border border-white/10 rounded-xl p-6 text-center max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white font-medium mb-2">No OCR Data Available</p>
          <p className="text-slate-400 text-sm mb-4">
            This invoice needs to be re-analyzed to enable word selection.
            Click "Start Audit" to re-process with OCR data.
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Helper function to get color based on confidence
  const getConfidenceColor = (confidence?: number) => {
    if (confidence === undefined || confidence === null) {
      return { fill: 'rgba(156, 163, 175, 0.1)', stroke: 'rgba(156, 163, 175, 0.5)' }; // Gray - unknown
    }
    if (confidence >= 0.9) {
      return { fill: 'rgba(34, 197, 94, 0.1)', stroke: 'rgba(34, 197, 94, 0.5)' }; // Green - high confidence
    }
    if (confidence >= 0.7) {
      return { fill: 'rgba(59, 130, 246, 0.1)', stroke: 'rgba(59, 130, 246, 0.5)' }; // Blue - medium confidence
    }
    if (confidence >= 0.5) {
      return { fill: 'rgba(251, 191, 36, 0.1)', stroke: 'rgba(251, 191, 36, 0.5)' }; // Yellow/amber - low confidence
    }
    return { fill: 'rgba(239, 68, 68, 0.1)', stroke: 'rgba(239, 68, 68, 0.5)' }; // Red - very low confidence
  };

  // Build viewBox from page dimensions (same as PdfViewerWithHighlights)
  const viewBox = `0 0 ${pageData.width} ${pageData.height}`;

  // Determine stroke width based on coordinate scale (inches vs pixels)
  // For inches (width < 50), use subtle strokes that don't obscure text
  const isInches = pageData.width < 50;
  const strokeWidth = isInches ? 0.012 : 1.5;

  console.log('[InteractiveOverlay] ===== RENDERING =====');
  console.log('[InteractiveOverlay] viewBox:', viewBox);
  console.log('[InteractiveOverlay] isInches:', isInches);
  console.log('[InteractiveOverlay] strokeWidth:', strokeWidth);
  console.log('[InteractiveOverlay] Total words to render:', words.length);
  if (words.length > 0) {
    console.log('[InteractiveOverlay] First 3 words:', words.slice(0, 3).map(w => ({
      content: w.content,
      polygon: w.polygon?.slice(0, 4),
      hasPolygon: !!w.polygon && w.polygon.length >= 4
    })));
  }
  console.log('[InteractiveOverlay] =====================');

  return (
    <>
      {/* SVG Word Bounding Boxes Layer - Using same viewBox approach as highlights */}
      <svg
        className="absolute inset-0 z-20"
        viewBox={viewBox}
        style={{ width: '100%', height: '100%' }}
      >
        {displayItems.map((item, index) => {
          const isWord = isSelectionMode;
          const word = item as AzureWord;
          const isSelected = isWord && selectedWords.includes(word);
          const selectionOrder = isSelected ? selectedWords.indexOf(word) + 1 : null;
          const points = polygonToSvgPoints(item.polygon);
          const bbox = getBoundingBox(item.polygon);
          const colors = getConfidenceColor(item.confidence);

          if (!points || bbox.width === 0) return null;

          // In selection mode: blue for selected, original colors for unselected
          // Not in selection mode: show confidence colors
          const fillColor = isSelected
            ? 'rgba(59, 130, 246, 0.3)'
            : colors.fill;
          const strokeColor = isSelected
            ? 'rgba(59, 130, 246, 1)'
            : colors.stroke;

          return (
            <g key={`${item.content}-${index}`} className={isSelectionMode ? 'cursor-pointer' : 'cursor-default'}>
              {/* Polygon with confidence-based coloring */}
              <polygon
                points={points}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                style={{ pointerEvents: 'all', cursor: isSelectionMode ? 'pointer' : 'help' }}
                onClick={isSelectionMode ? () => handleWordClick(word) : undefined}
                onMouseEnter={(e) => {
                  // Show tooltip
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredWord({ word: item, x: rect.left + rect.width / 2, y: rect.top });

                  // Highlight on hover in selection mode
                  if (isSelectionMode && !isSelected) {
                    e.currentTarget.setAttribute('fill', 'rgba(59, 130, 246, 0.2)');
                    e.currentTarget.setAttribute('stroke', 'rgba(59, 130, 246, 0.9)');
                  }
                }}
                onMouseLeave={(e) => {
                  // Hide tooltip
                  setHoveredWord(null);

                  // Reset highlight
                  if (isSelectionMode && !isSelected) {
                    e.currentTarget.setAttribute('fill', colors.fill);
                    e.currentTarget.setAttribute('stroke', colors.stroke);
                  }
                }}
              />
              {/* Selection order badge */}
              {isSelected && selectionOrder !== null && (
                <>
                  <circle
                    cx={bbox.x}
                    cy={bbox.y - strokeWidth * 5}
                    r={strokeWidth * 4}
                    fill="#3b82f6"
                  />
                  <text
                    x={bbox.x}
                    y={bbox.y - strokeWidth * 3}
                    fill="white"
                    fontSize={strokeWidth * 5}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {selectionOrder}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Selection Toolbar - Draggable, only show on page 1 to avoid duplicates */}
      {currentPage === 1 && isSelectionMode && (
      <div
        ref={toolbarRef}
        className="fixed z-[100]"
        style={{
          top: 80 + toolbarPosition.y,
          left: `calc(50% + ${toolbarPosition.x}px)`,
          transform: 'translateX(-50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl p-4 min-w-[320px]">
          {/* Drag Handle */}
          <div
            className="flex items-center justify-center mb-2 cursor-move select-none"
            onMouseDown={handleDragStart}
          >
            <GripHorizontal size={16} className="text-slate-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {targetField ? (
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Correcting: {targetField.replace(/_/g, ' ')}
                </span>
              ) : allowFieldSelection ? (
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Select field to assign
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Selection Mode
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[InteractiveOverlay] Close button clicked');
                handleCancel();
              }}
              className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Field Selection Dropdown (when allowFieldSelection is true and no targetField) */}
          {!targetField && allowFieldSelection && (
            <div className="relative mb-3">
              <button
                onClick={() => setIsFieldDropdownOpen(!isFieldDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors"
              >
                <span className={selectedField ? 'text-white' : 'text-slate-500'}>
                  {selectedField
                    ? availableFields.find(f => f.key === selectedField)?.label || selectedField
                    : 'Choisir un champ...'}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isFieldDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isFieldDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-[200px] overflow-y-auto">
                  {availableFields.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => handleFieldSelect(field.key)}
                      className={`w-full px-3 py-2 text-left hover:bg-white/10 transition-colors ${
                        selectedField === field.key ? 'bg-blue-500/20 text-blue-400' : 'text-white'
                      }`}
                    >
                      <div className="text-sm font-medium">{field.label}</div>
                      <div className="text-[10px] text-slate-500">{field.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <p className="text-xs text-slate-500 mb-3">
            Click words in order to build the correct value
          </p>

          {/* Selected Text Preview */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3 min-h-[40px]">
            {selectedText ? (
              <span className="text-white font-mono text-sm">{selectedText}</span>
            ) : (
              <span className="text-slate-600 text-sm italic">
                No words selected...
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              disabled={selectedWords.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <RotateCcw size={12} />
              Clear
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedWords.length === 0 || (!targetField && allowFieldSelection && !selectedField)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-blue-900/30"
            >
              <Check size={12} />
              Apply
            </button>
          </div>

          {/* Word count indicator */}
          {selectedWords.length > 0 && (
            <div className="mt-2 text-center text-[10px] text-slate-500">
              {selectedWords.length} word{selectedWords.length !== 1 ? 's' : ''} selected
              {allowFieldSelection && !selectedField && ' • Select a field above'}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Semi-transparent overlay to indicate selection mode - only in selection mode */}
      {isSelectionMode && (
        <div
          className="absolute inset-0 bg-slate-900/10 pointer-events-none z-10"
          style={{ mixBlendMode: 'multiply' }}
        />
      )}

      {/* Hover Tooltip for word info */}
      {hoveredWord && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{
            left: hoveredWord.x,
            top: hoveredWord.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-slate-900 border border-white/20 rounded-lg px-3 py-2 shadow-xl text-xs">
            <div className="text-white font-medium mb-1">"{hoveredWord.word.content}"</div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Confidence:</span>
              <span className={`font-bold ${
                (hoveredWord.word.confidence ?? 0) >= 0.9 ? 'text-emerald-400' :
                (hoveredWord.word.confidence ?? 0) >= 0.7 ? 'text-blue-400' :
                (hoveredWord.word.confidence ?? 0) >= 0.5 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {hoveredWord.word.confidence !== undefined
                  ? `${(hoveredWord.word.confidence * 100).toFixed(0)}%`
                  : 'N/A'}
              </span>
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-slate-900 border-r border-b border-white/20 rotate-45" />
          </div>
        </div>
      )}
    </>
  );
};

export default InteractiveOverlay;

// Export types for external use
export type { DocumentType };
export { DOCUMENT_FIELDS };
