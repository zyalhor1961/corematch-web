'use client';

/**
 * DAF Document Viewer
 * Viewer spécialisé pour documents DAF avec bounding boxes Azure DI
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, ArrowLeft, Trash2 } from 'lucide-react';
import { PDFBoundingBoxOverlay } from '@/app/components/idp/PDFBoundingBoxOverlay';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Style pour désactiver les pointer-events sur les couches PDF
const pdfLayerStyle = `
  .react-pdf__Page__textContent,
  .react-pdf__Page__annotations {
    pointer-events: none !important;
  }
`;

interface DAFDocumentViewerProps {
  pdfUrl: string;
  document: any;
  extractionResult: any;
}

// Couleurs des champs DAF
const DAF_FIELD_COLORS: { [key: string]: string } = {
  numero_facture: '#3B82F6',    // Blue
  fournisseur: '#10B981',        // Green
  client: '#14B8A6',             // Teal
  montant_ttc: '#EF4444',        // Red
  montant_ht: '#F59E0B',         // Orange
  taux_tva: '#8B5CF6',           // Purple
  date_document: '#EC4899',      // Pink
  date_echeance: '#06B6D4',      // Cyan
  numero_commande: '#84CC16',    // Lime
  conditions_paiement: '#F97316', // Orange-red
  adresse_fournisseur: '#22C55E', // Light green
  adresse_client: '#06B6D4',     // Sky blue
  email_fournisseur: '#10B981',  // Emerald
  email_client: '#14B8A6',       // Teal
  items_table: '#6366F1',        // Indigo - for entire items table
};

export const DAFDocumentViewer: React.FC<DAFDocumentViewerProps> = ({
  pdfUrl,
  document,
  extractionResult
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pageWidth, setPageWidth] = useState<number>(612);
  const [pageHeight, setPageHeight] = useState<number>(792);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [hoveredFieldName, setHoveredFieldName] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const router = useRouter();

  // Configure PDF.js worker (client-side only)
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }, []);

  // Handle delete document
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/daf/documents/${document.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Redirect to list after successful deletion
      router.push('/daf-demo');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Erreur lors de la suppression du document');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    console.log('[DAF Viewer] PDF loaded with', numPages, 'pages');
  };

  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page;
    setPageWidth(width);
    setPageHeight(height);
    console.log('[DAF Viewer] Page loaded - width:', width, 'height:', height);
  };

  // Convert field_positions to bounding boxes format for PDFBoundingBoxOverlay
  // Azure DI returns coordinates in INCHES, we need to convert to PDF POINTS
  // NOTE: PDFBoundingBoxOverlay will apply the scale, so we only convert inches→points here

  // Debug: Log all pages available in field_positions
  const allPages = (extractionResult?.field_positions || []).map((fp: any) => fp.page);
  const uniquePages = [...new Set(allPages)];
  console.log('[DAF Viewer] All field_positions pages:', uniquePages, 'Total positions:', extractionResult?.field_positions?.length || 0);
  console.log('[DAF Viewer] Looking for page:', currentPage - 1, '(currentPage:', currentPage, ')');

  const boundingBoxes = (extractionResult?.field_positions || [])
    .filter((fp: any) => fp.page === currentPage - 1) // Filter for current page
    .map((fp: any, index: number) => {
      // Convert inches to PDF points (1 inch = 72 points)
      // PDFBoundingBoxOverlay will multiply by scale later
      const inchesPolygon = fp.polygon || [];
      const pointsPolygon = inchesPolygon.map((coord: number) => {
        return coord * 72; // inches → points (NO scale here, applied by overlay)
      });

      return {
        fieldId: `field-${fp.field}-${index}`,
        fieldName: fp.field, // Add field name for hover synchronization
        polygon: pointsPolygon,
        color: DAF_FIELD_COLORS[fp.field] || '#6B7280',
        label: `${fp.field}: ${fp.text}`,
      };
    });

  console.log('[DAF Viewer] Bounding boxes for page', currentPage, ':', boundingBoxes.length);
  if (boundingBoxes.length > 0) {
    console.log('[DAF Viewer] First bounding box (normalized):', extractionResult?.field_positions?.[0]);
    console.log('[DAF Viewer] First bounding box (converted):', boundingBoxes[0]);
    console.log('[DAF Viewer] Page dimensions:', { pageWidth, pageHeight, scale });
  }

  // Detect document type
  const documentType = extractionResult?.document_type || document?.ai_detected_type || 'other';
  const isInvoice = documentType === 'invoice';

  // Invoice-specific fields (only shown for invoices)
  const invoiceFields = [
    { label: 'Numéro de facture', value: extractionResult?.numero_facture, field: 'numero_facture' },
    { label: 'Fournisseur', value: extractionResult?.fournisseur, field: 'fournisseur' },
    { label: 'Client', value: extractionResult?.client, field: 'client' },
    {
      label: 'Montant TTC',
      value: extractionResult?.montant_ttc !== undefined && extractionResult?.montant_ttc !== null
        ? `${extractionResult.montant_ttc.toFixed(2)} €`
        : undefined,
      field: 'montant_ttc'
    },
    {
      label: 'Montant HT',
      value: extractionResult?.montant_ht !== undefined && extractionResult?.montant_ht !== null
        ? `${extractionResult.montant_ht.toFixed(2)} €`
        : undefined,
      field: 'montant_ht'
    },
    {
      label: 'Taux TVA',
      value: extractionResult?.taux_tva !== undefined && extractionResult?.taux_tva !== null
        ? `${extractionResult.taux_tva.toFixed(2)}%`
        : undefined,
      field: 'taux_tva'
    },
    { label: 'Date document', value: extractionResult?.date_document, field: 'date_document' },
    { label: 'Date échéance', value: extractionResult?.date_echeance, field: 'date_echeance' },
    { label: 'Numéro de commande', value: extractionResult?.numero_commande, field: 'numero_commande' },
    { label: 'Conditions de paiement', value: extractionResult?.conditions_paiement, field: 'conditions_paiement' },
    { label: 'Adresse fournisseur', value: extractionResult?.adresse_fournisseur, field: 'adresse_fournisseur' },
    { label: 'Adresse client', value: extractionResult?.adresse_client, field: 'adresse_client' },
    { label: 'Email fournisseur', value: extractionResult?.email_fournisseur, field: 'email_fournisseur' },
    { label: 'Email client', value: extractionResult?.email_client, field: 'email_client' },
  ];

  // Generic fields for all document types
  const genericFields = [
    { label: 'Type de document', value: documentType?.charAt(0).toUpperCase() + documentType?.slice(1), field: 'type' },
    { label: 'Nombre de pages', value: extractionResult?.pages?.length || document?.page_count, field: 'pages' },
    { label: 'Tables détectées', value: extractionResult?.tables?.length || document?.table_count, field: 'tables' },
  ];

  // Choose fields based on document type
  const extractedFields = isInvoice ? invoiceFields : genericFields;

  const provider = extractionResult?.provider || 'unknown';
  const confidence = extractionResult?.confidence || 0;

  // Get document type label and color
  const typeLabels: Record<string, { label: string; color: string }> = {
    invoice: { label: '🧾 Facture', color: 'bg-blue-100 text-blue-800' },
    cv: { label: '👤 CV', color: 'bg-purple-100 text-purple-800' },
    contract: { label: '📜 Contrat', color: 'bg-amber-100 text-amber-800' },
    report: { label: '📊 Rapport', color: 'bg-green-100 text-green-800' },
    other: { label: '📄 Document', color: 'bg-slate-100 text-slate-800' },
  };
  const typeInfo = typeLabels[documentType] || typeLabels.other;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Inject CSS to disable pointer-events on PDF layers */}
      <style dangerouslySetInnerHTML={{ __html: pdfLayerStyle }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Bouton Retour */}
            <button
              onClick={() => router.push('/daf-demo?tab=inbox')}
              className="flex items-center gap-2 px-4 py-2 text-white bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-all border border-slate-600/50"
              title="Retour à la liste"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour</span>
            </button>

            <div className="border-l border-slate-600 pl-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{document.file_name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-slate-300">
                  <span className="font-medium text-white">{provider}</span>
                </span>
                <span className="text-sm text-slate-300 flex items-center gap-1">
                  <span>Confiance:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    confidence > 0.8 ? 'bg-green-500/20 text-green-300' :
                    confidence > 0.5 ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {(confidence * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600/50">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                className="p-2 text-white hover:bg-slate-600/50 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-white font-medium px-3 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(Math.min(3, scale + 0.1))}
                className="p-2 text-white hover:bg-slate-600/50 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>

            {/* Page Navigation */}
            {numPages > 1 && (
              <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600/50">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-white hover:bg-slate-600/50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-white font-medium px-3">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                  disabled={currentPage === numPages}
                  className="p-2 text-white hover:bg-slate-600/50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Download Button */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-lg hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl font-bold border-2 border-white/20"
            >
              <Download className="w-5 h-5" />
              Télécharger
            </a>

            {/* Delete Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-lg hover:shadow-xl font-medium"
              title="Supprimer le document"
            >
              <Trash2 className="w-5 h-5" />
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirmer la suppression</h3>
            <p className="text-gray-700 mb-6">
              Êtes-vous sûr de vouloir supprimer le document <span className="font-semibold">{document.file_name}</span> ?
              Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Side by Side */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer - Left */}
        <div className="flex-1 overflow-auto bg-gray-900 p-8">
          <div className="flex justify-center">
            <div className="relative bg-white shadow-2xl">
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="w-[600px] h-[800px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                  </div>
                }
                error={
                  <div className="w-[600px] h-[800px] flex items-center justify-center bg-red-50">
                    <p className="text-red-600">Erreur de chargement du PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  onLoadSuccess={onPageLoadSuccess}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>

              {/* Bounding Boxes Overlay */}
              {pageWidth > 0 && boundingBoxes.length > 0 && (
                <PDFBoundingBoxOverlay
                  boundingBoxes={boundingBoxes}
                  hoveredFieldId={hoveredFieldId}
                  hoveredFieldName={hoveredFieldName}
                  onFieldHover={setHoveredFieldId}
                  scale={scale}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                />
              )}
            </div>
          </div>
        </div>

        {/* Extracted Fields - Right */}
        <div className="w-96 border-l border-gray-200 bg-white overflow-auto">
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Données extraites</h2>

            <div className="space-y-3">
              {extractedFields.map((field, index) => (
                <div
                  key={index}
                  className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group"
                  style={{
                    borderLeftColor: DAF_FIELD_COLORS[field.field],
                    borderLeftWidth: '6px'
                  }}
                  onMouseEnter={() => setHoveredFieldName(field.field)}
                  onMouseLeave={() => setHoveredFieldName(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-4 h-4 rounded-full shadow-md group-hover:shadow-lg transition-shadow"
                      style={{ backgroundColor: DAF_FIELD_COLORS[field.field] }}
                    ></div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</span>
                  </div>

                  {field.value ? (
                    <p className="text-base font-bold text-gray-900 leading-tight">{field.value}</p>
                  ) : (
                    <p className="text-sm text-gray-300 italic font-medium">Non trouvé</p>
                  )}
                </div>
              ))}
            </div>

            {/* Full Text Content (for non-invoices) */}
            {!isInvoice && (extractionResult?.full_text || document?.full_text) && (
              <div className="mt-8">
                <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-t-xl px-4 py-3 shadow-lg">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    Contenu extrait
                  </h3>
                </div>
                <div className="bg-gradient-to-b from-purple-50 to-white rounded-b-xl p-4 shadow-lg border-2 border-purple-100">
                  <div className="max-h-96 overflow-y-auto pr-2">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                      {(extractionResult?.full_text || document?.full_text || '').substring(0, 5000)}
                      {(extractionResult?.full_text || document?.full_text || '').length > 5000 && '...'}
                    </pre>
                  </div>
                  {(extractionResult?.full_text || document?.full_text || '').length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <span className="text-xs text-purple-600 font-semibold">
                        {(extractionResult?.full_text || document?.full_text || '').length.toLocaleString()} caractères extraits
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tables (for non-invoices with tables) */}
            {!isInvoice && (extractionResult?.tables?.length > 0 || document?.table_count > 0) && (
              <div className="mt-8">
                <div className="bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-t-xl px-4 py-3 shadow-lg">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    Tables détectées ({extractionResult?.tables?.length || document?.table_count || 0})
                  </h3>
                </div>
                <div className="bg-gradient-to-b from-cyan-50 to-white rounded-b-xl p-4 shadow-lg border-2 border-cyan-100">
                  {extractionResult?.tables?.map((table: any, idx: number) => (
                    <div key={idx} className="mb-4 last:mb-0">
                      <div className="text-xs font-bold text-cyan-700 mb-2">
                        Table {idx + 1}: {table.row_count} lignes × {table.column_count} colonnes
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border border-cyan-200 rounded">
                          <tbody>
                            {/* Show first few rows as preview */}
                            {table.cells?.slice(0, 20).map((cell: any, cellIdx: number) => (
                              <tr key={cellIdx} className={cellIdx % 2 === 0 ? 'bg-cyan-50' : 'bg-white'}>
                                <td className="px-2 py-1 border-b border-cyan-100 text-gray-700">
                                  [{cell.row_index},{cell.column_index}] {cell.content}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-cyan-600">
                      {document?.table_count || 0} table(s) détectée(s) dans le document
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Line Items (Descriptions) - Only for invoices */}
            {isInvoice && extractionResult?.items && extractionResult.items.length > 0 && (
              <div className="mt-8">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-t-xl px-4 py-3 shadow-lg">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    Ligne items ({extractionResult.items.length})
                  </h3>
                </div>
                <div className="bg-gradient-to-b from-indigo-50 to-white rounded-b-xl p-4 shadow-lg border-2 border-indigo-100">
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {extractionResult.items.map((item: any, index: number) => (
                      <div key={index} className="bg-white border-2 border-indigo-100 rounded-lg p-4 hover:shadow-lg hover:border-indigo-300 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                            {index + 1}
                          </div>
                          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Item #{index + 1}</div>
                        </div>
                        {item.description && (
                          <div className="text-sm font-semibold text-gray-900 mb-3 leading-snug">{item.description}</div>
                        )}
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          {item.quantite !== undefined && (
                            <div className="bg-indigo-50 rounded-lg px-2 py-2 border border-indigo-200">
                              <span className="text-indigo-600 font-bold block mb-1">Quantité</span>
                              <span className="font-bold text-gray-900">{item.quantite}</span>
                            </div>
                          )}
                          {item.prix_unitaire !== undefined && (
                            <div className="bg-indigo-50 rounded-lg px-2 py-2 border border-indigo-200">
                              <span className="text-indigo-600 font-bold block mb-1">P.U.</span>
                              <span className="font-bold text-gray-900">{item.prix_unitaire.toFixed(2)} €</span>
                            </div>
                          )}
                          {item.montant !== undefined && (
                            <div className="bg-indigo-50 rounded-lg px-2 py-2 border border-indigo-200">
                              <span className="text-indigo-600 font-bold block mb-1">Total</span>
                              <span className="font-bold text-gray-900">{item.montant.toFixed(2)} €</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="mt-8">
              <div className="bg-gradient-to-r from-slate-700 to-slate-600 rounded-t-xl px-4 py-3 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  Métadonnées
                </h3>
              </div>
              <div className="bg-gradient-to-b from-slate-50 to-white rounded-b-xl p-4 shadow-lg border-2 border-slate-100">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                    <span className="text-slate-600 font-bold">Provider</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{provider}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                    <span className="text-slate-600 font-bold">Durée extraction</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{extractionResult?.extraction_duration_ms}ms</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                    <span className="text-slate-600 font-bold">Date upload</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">
                      {new Date(document.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bounding Boxes Info */}
            {extractionResult?.field_positions && (
              <div className="mt-8">
                <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-t-xl px-4 py-3 shadow-lg">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    Zones détectées
                  </h3>
                </div>
                <div className="bg-gradient-to-b from-purple-50 to-white rounded-b-xl p-4 shadow-lg border-2 border-purple-100">
                  <div className="text-sm font-bold text-purple-700 mb-4 bg-purple-100 px-3 py-2 rounded-lg border border-purple-200">
                    {extractionResult.field_positions.length} zone(s) trouvée(s)
                  </div>

                  {/* Légende des couleurs */}
                  <div className="space-y-2">
                    {Object.entries(DAF_FIELD_COLORS).map(([field, color]) => {
                      const count = extractionResult.field_positions?.filter(
                        (box: any) => box.field === field
                      ).length || 0;

                      if (count === 0) return null;

                      return (
                        <div key={field} className="flex items-center justify-between p-2 bg-white rounded-lg border-2 border-purple-100 hover:shadow-md hover:border-purple-300 transition-all">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-lg border-2 shadow-sm"
                              style={{
                                borderColor: color,
                                backgroundColor: `${color}40`,
                              }}
                            />
                            <span className="text-xs font-bold text-gray-700">
                              {field.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
