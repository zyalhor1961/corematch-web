'use client';

/**
 * Unified IDP Dashboard - Enterprise-grade document processing interface
 *
 * Combines best features from:
 * - Rossum: Real-time queues, audit trails, workflow builder
 * - Docsumo: Excel-like tables, visual error highlighting
 * - Azure AI: Confidence scoring, custom models
 * - Apryse: High-fidelity PDF viewing, annotations
 *
 * Features:
 * - Real-time document processing queue with priority management
 * - Side-by-side PDF viewer with data extraction sync
 * - Excel-like editable tables with validation
 * - Drag-and-drop workflow builder
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
  Zap
} from 'lucide-react';
import { PDFViewerWithAnnotations } from './PDFViewerWithAnnotations';
import { ExtractionDataView } from './ExtractionDataView';
import { WorkflowBuilder } from './WorkflowBuilder';
import { AuditTrailViewer } from './AuditTrailViewer';
import { DocumentQueue } from './DocumentQueue';
import { ExtractionModelManager } from './ExtractionModelManager';

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

export interface WorkflowStage {
  id: string;
  name: string;
  type: 'extraction' | 'validation' | 'review' | 'export';
  config: any;
  order: number;
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

type ViewMode = 'queue' | 'viewer' | 'workflow' | 'audit' | 'models';

export const UnifiedIDPDashboard: React.FC<UnifiedIDPDashboardProps> = ({
  orgId,
  isDarkMode = false
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [selectedDocument, setSelectedDocument] = useState<IDPDocument | null>(null);
  const [documents, setDocuments] = useState<IDPDocument[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowStage[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  // Handle document selection from queue
  const handleDocumentSelect = useCallback((doc: IDPDocument) => {
    setSelectedDocument(doc);
    setViewMode('viewer');

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

  // Handle workflow updates
  const handleWorkflowUpdate = useCallback((updatedWorkflows: WorkflowStage[]) => {
    setWorkflows(updatedWorkflows);

    // Log audit entry
    const logEntry: AuditLogEntry = {
      id: `${Date.now()}`,
      timestamp: new Date(),
      userId: 'current-user-id',
      userName: 'Current User',
      action: 'workflow_modified',
      details: { stages: updatedWorkflows.length }
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

  // Navigation tabs configuration
  const navTabs = [
    { id: 'queue' as const, label: 'Document Queue', icon: LayoutDashboard, badge: queueStats.pending + queueStats.processing },
    { id: 'viewer' as const, label: 'PDF Viewer', icon: Eye, badge: null },
    { id: 'workflow' as const, label: 'Workflow Builder', icon: GitBranch, badge: null },
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

            {/* Quick Stats */}
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

      {/* Main Content Area */}
      <main className="max-w-[2000px] mx-auto p-6">
        {viewMode === 'queue' && (
          <DocumentQueue
            documents={documents}
            onDocumentSelect={handleDocumentSelect}
            onStatusChange={handleStatusChange}
            queueStats={queueStats}
            isDarkMode={isDarkMode}
          />
        )}

        {viewMode === 'viewer' && selectedDocument && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PDF Viewer with Annotations */}
            <PDFViewerWithAnnotations
              pdfUrl={selectedDocument.pdfUrl || ''}
              documentId={selectedDocument.id}
              annotations={selectedDocument.annotations || []}
              isDarkMode={isDarkMode}
            />

            {/* Extraction Data View */}
            <ExtractionDataView
              document={selectedDocument}
              onDataUpdate={(newData) => handleDataUpdate(selectedDocument.id, newData)}
              onStatusChange={(newStatus) => handleStatusChange(selectedDocument.id, newStatus)}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {viewMode === 'workflow' && (
          <WorkflowBuilder
            workflows={workflows}
            onWorkflowUpdate={handleWorkflowUpdate}
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
