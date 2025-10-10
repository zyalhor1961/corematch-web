'use client';

/**
 * Unified IDP Dashboard - Enterprise-grade document processing interface
 *
 * Combines best features from:
 * - Rossum: Real-time queues, audit trails
 * - Docsumo: Excel-like tables, visual error highlighting
 * - Azure AI: Confidence scoring, custom models, synchronized highlighting
 * - Apryse: High-fidelity PDF viewing, annotations
 *
 * Features:
 * - Real-time document processing queue with priority management
 * - Side-by-side PDF viewer with data extraction sync
 * - Excel-like editable tables with validation
 * - Custom field views with save/load functionality
 * - Interactive bounding boxes with synchronized hover effects
 * - Audit trail and activity logging
 * - Custom extraction model management
 * - Large PDF optimization (chunking, lazy loading)
 * - Cross-browser compatible (Chrome, Firefox, Safari, Edge)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  Activity,
  Settings,
  Upload,
  Eye,
  Edit3,
  GitBranch,
  History,
  Zap,
  X,
  XCircle
} from 'lucide-react';
import { PDFViewerWithAnnotations } from './PDFViewerWithAnnotations';
import { ExtractionDataView } from './ExtractionDataView';
import { AzureStyledExtractionView, FIELD_TYPE_COLORS, detectFieldCategory } from './AzureStyledExtractionView';
import { CustomFieldView } from './CustomFieldView';
import { AuditTrailViewer } from './AuditTrailViewer';
import { DocumentQueue } from './DocumentQueue';
import { ExtractionModelManager } from './ExtractionModelManager';
import { DocumentListView, IDPDocument as DBDocument } from './DocumentListView';

export interface IDPDocument {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'error';
  priority: 'high' | 'medium' | 'low';
  uploadedAt: Date;
  assignee?: string;
  confidence?: number;
  extractedData?: any;
  pdfUrl?: string;
  annotations?: any[];
  processingStage?: string;
  errorMessage?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  documentId?: string;
  details: any;
}

interface UnifiedIDPDashboardProps {
  orgId: string;
  isDarkMode?: boolean;
}

type ViewMode = 'queue' | 'viewer' | 'custom-views' | 'audit' | 'models' | 'documents';

export const UnifiedIDPDashboard: React.FC<UnifiedIDPDashboardProps> = ({
  orgId,
  isDarkMode = false
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('documents');
  const [selectedDocument, setSelectedDocument] = useState<IDPDocument | null>(null);
  const [documents, setDocuments] = useState<IDPDocument[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [azureData, setAzureData] = useState<any>(null);
  const [isAnalyzingAzure, setIsAnalyzingAzure] = useState(false);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [clickedFieldId, setClickedFieldId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Load documents from DEB batches
  React.useEffect(() => {
    loadDocuments();
  }, [orgId]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/deb/batches?orgId=${orgId}`);
      if (!response.ok) throw new Error('Failed to load documents');

      const payload = await response.json();
      if (payload.success && payload.data) {
        // Convert DEB batches to IDP documents
        const idpDocsPromises = payload.data.map(async (batch: any) => {
          // Map DEB status to IDP status
          let status: IDPDocument['status'] = 'pending';
          if (batch.status === 'uploaded') status = 'pending';
          else if (batch.status === 'needs_review') status = 'review';
          else if (batch.status === 'processing') status = 'processing';
          else if (batch.status === 'completed') status = 'completed';
          else if (batch.status === 'error' || batch.status === 'failed') status = 'error';

          // Get signed URL for PDF
          let pdfUrl = '';
          try {
            const signedUrlResponse = await fetch(`/api/storage/signed-url?bucket=deb-docs&path=${encodeURIComponent(batch.storage_object_path)}`);
            if (signedUrlResponse.ok) {
              const signedUrlData = await signedUrlResponse.json();
              pdfUrl = signedUrlData.signedUrl;
            }
          } catch (error) {
            console.error('Error getting signed URL for batch:', batch.id, error);
          }

          return {
            id: batch.id,
            filename: batch.source_filename,
            status,
            priority: 'medium',
            uploadedAt: new Date(batch.created_at),
            confidence: 0.85,
            pdfUrl
          };
        });

        const idpDocs = await Promise.all(idpDocsPromises);
        setDocuments(idpDocs);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    // Validate file
    if (!file.type.includes('pdf')) {
      setUploadError('Only PDF files are allowed');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Upload to DEB API
      const formData = new FormData();
      formData.append('orgId', orgId);
      formData.append('file', file);

      const response = await fetch('/api/deb/batches', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Upload failed');
      }

      // Reload documents
      await loadDocuments();

      // Log audit entry
      const logEntry: AuditLogEntry = {
        id: `${Date.now()}`,
        timestamp: new Date(),
        userId: 'current-user-id',
        userName: 'Current User',
        action: 'document_uploaded',
        details: { filename: file.name, size: file.size }
      };
      setAuditLog(prev => [logEntry, ...prev]);

    } catch (error: any) {
      setUploadError(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle document selection from queue
  const handleDocumentSelect = useCallback((doc: IDPDocument) => {
    setSelectedDocument(doc);
    setViewMode('viewer');
    setAzureData(null); // Reset Azure data when selecting new document

    // Log audit entry
    const logEntry: AuditLogEntry = {
      id: `${Date.now()}`,
      timestamp: new Date(),
      userId: 'current-user-id', // TODO: Get from auth context
      userName: 'Current User',
      action: 'document_opened',
      documentId: doc.id,
      details: { filename: doc.filename }
    };
    setAuditLog(prev => [logEntry, ...prev]);
  }, []);

  // Handle Azure analysis
  const handleAzureAnalysis = useCallback(async () => {
    if (!selectedDocument?.pdfUrl) return;

    setIsAnalyzingAzure(true);

    try {
      const response = await fetch('/api/idp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrl: selectedDocument.pdfUrl,
          documentId: selectedDocument.id,
          filename: selectedDocument.filename,
          autoDetect: true
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAzureData(result.data);

      // Log audit entry
      const logEntry: AuditLogEntry = {
        id: `${Date.now()}`,
        timestamp: new Date(),
        userId: 'current-user-id',
        userName: 'Current User',
        action: 'document_analyzed',
        documentId: selectedDocument.id,
        details: { model: result.data.modelId, confidence: result.data.confidence }
      };
      setAuditLog(prev => [logEntry, ...prev]);
    } catch (error: any) {
      console.error('Azure analysis error:', error);
      setUploadError(error.message || 'Analysis failed');
    } finally {
      setIsAnalyzingAzure(false);
    }
  }, [selectedDocument]);

  // Prepare bounding boxes from Azure data
  const boundingBoxes = React.useMemo(() => {
    if (!azureData?.fields) return [];

    return azureData.fields
      .map((field: any, index: number) => {
        if (!field.boundingBox || field.boundingBox.length === 0) return null;

        const category = detectFieldCategory(field.name, field.type);
        const color = FIELD_TYPE_COLORS[category];

        return {
          fieldId: `field-${index}`,
          polygon: field.boundingBox,
          color,
          label: field.name,
          value: field.value,
          confidence: field.confidence,
          category
        };
      })
      .filter(Boolean);
  }, [azureData]);

  // Handle data extraction updates
  const handleDataUpdate = useCallback((documentId: string, newData: any) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === documentId
        ? { ...doc, extractedData: newData }
        : doc
    ));

    // Log audit entry
    const logEntry: AuditLogEntry = {
      id: `${Date.now()}`,
      timestamp: new Date(),
      userId: 'current-user-id',
      userName: 'Current User',
      action: 'data_modified',
      documentId,
      details: { changes: newData }
    };
    setAuditLog(prev => [logEntry, ...prev]);
  }, []);

  // Handle document status change
  const handleStatusChange = useCallback((documentId: string, newStatus: IDPDocument['status']) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === documentId
        ? { ...doc, status: newStatus }
        : doc
    ));

    // Log audit entry
    const logEntry: AuditLogEntry = {
      id: `${Date.now()}`,
      timestamp: new Date(),
      userId: 'current-user-id',
      userName: 'Current User',
      action: 'status_changed',
      documentId,
      details: { newStatus }
    };
    setAuditLog(prev => [logEntry, ...prev]);
  }, []);


  // Calculate queue statistics
  const queueStats = useMemo(() => {
    const total = documents.length;
    const pending = documents.filter(d => d.status === 'pending').length;
    const processing = documents.filter(d => d.status === 'processing').length;
    const review = documents.filter(d => d.status === 'review').length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const errors = documents.filter(d => d.status === 'error').length;
    const avgConfidence = documents.length > 0
      ? documents.reduce((sum, d) => sum + (d.confidence || 0), 0) / documents.length
      : 0;

    return {
      total,
      pending,
      processing,
      review,
      completed,
      errors,
      avgConfidence: Math.round(avgConfidence * 100)
    };
  }, [documents]);

  // State for document library
  const [dbDocuments, setDbDocuments] = useState<DBDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // Load documents from database
  const loadDbDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch(`/api/idp/documents?orgId=${orgId}`);
      const result = await response.json();
      if (result.success) {
        setDbDocuments(result.data);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    if (viewMode === 'documents') {
      loadDbDocuments();
    }
  }, [viewMode, loadDbDocuments]);

  // Navigation tabs configuration
  const navTabs = [
    { id: 'documents' as const, label: 'Document Library', icon: FileText, badge: dbDocuments.length },
    { id: 'queue' as const, label: 'Processing Queue', icon: LayoutDashboard, badge: queueStats.pending + queueStats.processing },
    { id: 'viewer' as const, label: 'PDF Viewer', icon: Eye, badge: null },
    { id: 'custom-views' as const, label: 'Custom Views', icon: Settings, badge: null },
    { id: 'audit' as const, label: 'Audit Trail', icon: History, badge: auditLog.length },
    { id: 'models' as const, label: 'Extraction Models', icon: Zap, badge: null },
  ];

  return (
    <div className={`min-h-screen transition-all ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header with Navigation */}
      <header className={`sticky top-0 z-50 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-lg`}>
        <div className="max-w-[2000px] mx-auto px-6 py-4">
          {/* Title Section */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-600 to-purple-700'} shadow-lg`}>
                <Activity className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${isDarkMode ? 'from-blue-400 via-purple-400 to-pink-400' : 'from-blue-600 via-purple-600 to-pink-600'}`}>
                  Unified IDP Dashboard
                </h1>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Enterprise Document Intelligence Platform • AI-Powered Extraction • Real-time Processing
                </p>
              </div>
            </div>

            {/* Quick Stats & Upload */}
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {queueStats.total} Documents
                  </span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {queueStats.avgConfidence}% Confidence
                  </span>
                </div>
              </div>

              {/* Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105`}
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                      : isDarkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  {tab.badge !== null && tab.badge > 0 && (
                    <span className={`absolute -top-1 -right-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                      isActive
                        ? 'bg-white text-blue-600'
                        : 'bg-red-500 text-white'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Upload Error/Success Messages */}
      {uploadError && (
        <div className="max-w-[2000px] mx-auto px-6 pt-6">
          <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-red-950/50 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500">
                  <XCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={`font-bold ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>Upload Failed</p>
                  <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{uploadError}</p>
                </div>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-red-900/50' : 'hover:bg-red-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-[2000px] mx-auto p-6">
        {viewMode === 'documents' && (
          <DocumentListView
            documents={dbDocuments}
            onRefresh={loadDbDocuments}
            onViewDocument={(doc) => {
              // Convert DB document to queue document format for viewing
              setSelectedDocument({
                id: doc.id,
                filename: doc.filename,
                status: 'completed',
                priority: 'medium',
                uploadedAt: new Date(doc.created_at),
                confidence: doc.overall_confidence,
                pdfUrl: doc.storage_url || ''
              });
              setViewMode('viewer');
            }}
            onDeleteDocument={async (id) => {
              if (confirm('Are you sure you want to delete this document?')) {
                try {
                  await fetch(`/api/idp/documents?id=${id}`, { method: 'DELETE' });
                  loadDbDocuments();
                } catch (error) {
                  console.error('Error deleting document:', error);
                }
              }
            }}
            onExportDocuments={async (ids) => {
              console.log('Exporting documents:', ids);
              // TODO: Implement export functionality
            }}
            isLoading={isLoadingDocuments}
            isDarkMode={isDarkMode}
          />
        )}

        {viewMode === 'queue' && (
          <DocumentQueue
            documents={documents}
            onDocumentSelect={handleDocumentSelect}
            onStatusChange={handleStatusChange}
            onUpload={handleFileUpload}
            isUploading={isUploading}
            queueStats={queueStats}
            isDarkMode={isDarkMode}
          />
        )}

        {viewMode === 'viewer' && selectedDocument && (
          <div className={`flex gap-6 h-[calc(100vh-250px)] ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
            {/* PDF Viewer - 60% width */}
            <div className="w-[60%] flex-shrink-0">
              <PDFViewerWithAnnotations
                pdfUrl={selectedDocument.pdfUrl || ''}
                documentId={selectedDocument.id}
                annotations={selectedDocument.annotations || []}
                isDarkMode={isDarkMode}
                boundingBoxes={boundingBoxes}
                hoveredFieldId={hoveredFieldId}
                onFieldHover={setHoveredFieldId}
                clickedFieldId={clickedFieldId}
              />
            </div>

            {/* Azure-Styled Extraction View - 40% width */}
            <div className="w-[40%] flex-shrink-0">
              <AzureStyledExtractionView
                document={selectedDocument}
                azureData={azureData}
                isDarkMode={isDarkMode}
                onAnalyze={handleAzureAnalysis}
                isAnalyzing={isAnalyzingAzure}
                hoveredFieldId={hoveredFieldId}
                onFieldHover={setHoveredFieldId}
                onFieldClick={setClickedFieldId}
              />
            </div>
          </div>
        )}

        {viewMode === 'custom-views' && azureData && (
          <CustomFieldView
            availableFields={azureData.fields || []}
            orgId={orgId}
            isDarkMode={isDarkMode}
          />
        )}

        {viewMode === 'audit' && (
          <AuditTrailViewer
            auditLog={auditLog}
            isDarkMode={isDarkMode}
          />
        )}

        {viewMode === 'models' && (
          <ExtractionModelManager
            orgId={orgId}
            isDarkMode={isDarkMode}
          />
        )}
      </main>
    </div>
  );
};
