'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Clock, CheckCircle, Archive, Filter, Eye, Download,
  Receipt, User, ScrollText, BarChart3, AlertTriangle, MoreVertical,
  LayoutGrid, LayoutList, Search, Sparkles, Building2, FileCheck,
  CreditCard, Briefcase, Truck, FileSpreadsheet, Landmark, Folder,
  FolderOpen, ChevronRight, Loader2, Zap
} from 'lucide-react';
import type { DAFDocument, SmartHubStats, AIDetectedType } from '@/lib/daf-docs/types';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface InboxProps {
  orgId: string;
  refreshTrigger?: number;
  onSearch?: (query: string) => void;
}

// Extended AI-detected type display config (USA + France market)
const AI_TYPE_CONFIG: Record<AIDetectedType | string, { label: string; labelEn: string; icon: any; bgColor: string; textColor: string; borderColor: string }> = {
  // Universal types
  invoice: { label: 'Facture', labelEn: 'Invoice', icon: Receipt, bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
  cv: { label: 'CV', labelEn: 'Resume', icon: User, bgColor: 'bg-purple-100', textColor: 'text-purple-800', borderColor: 'border-purple-200' },
  contract: { label: 'Contrat', labelEn: 'Contract', icon: ScrollText, bgColor: 'bg-amber-100', textColor: 'text-amber-800', borderColor: 'border-amber-200' },
  report: { label: 'Rapport', labelEn: 'Report', icon: BarChart3, bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200' },
  // USA-specific types
  w2: { label: 'W-2', labelEn: 'W-2 Form', icon: Landmark, bgColor: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-200' },
  w9: { label: 'W-9', labelEn: 'W-9 Form', icon: Landmark, bgColor: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-200' },
  '1099': { label: '1099', labelEn: '1099 Form', icon: Landmark, bgColor: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-200' },
  purchase_order: { label: 'Bon de commande', labelEn: 'Purchase Order', icon: Truck, bgColor: 'bg-teal-100', textColor: 'text-teal-800', borderColor: 'border-teal-200' },
  receipt: { label: 'Reçu', labelEn: 'Receipt', icon: CreditCard, bgColor: 'bg-cyan-100', textColor: 'text-cyan-800', borderColor: 'border-cyan-200' },
  bank_statement: { label: 'Relevé bancaire', labelEn: 'Bank Statement', icon: Building2, bgColor: 'bg-indigo-100', textColor: 'text-indigo-800', borderColor: 'border-indigo-200' },
  tax_form: { label: 'Formulaire fiscal', labelEn: 'Tax Form', icon: FileCheck, bgColor: 'bg-rose-100', textColor: 'text-rose-800', borderColor: 'border-rose-200' },
  nda: { label: 'NDA', labelEn: 'NDA', icon: Briefcase, bgColor: 'bg-violet-100', textColor: 'text-violet-800', borderColor: 'border-violet-200' },
  proposal: { label: 'Proposition', labelEn: 'Proposal', icon: FileSpreadsheet, bgColor: 'bg-lime-100', textColor: 'text-lime-800', borderColor: 'border-lime-200' },
  other: { label: 'Autre', labelEn: 'Other', icon: FileText, bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
};

// Virtual folder structure for sidebar
const FOLDER_STRUCTURE = [
  { id: 'all', label: 'Tous les documents', labelEn: 'All Documents', icon: Folder, filter: null },
  { id: 'invoices', label: 'Factures', labelEn: 'Invoices', icon: Receipt, filter: 'invoice' },
  { id: 'cvs', label: 'CVs / Resumes', labelEn: 'Resumes', icon: User, filter: 'cv' },
  { id: 'contracts', label: 'Contrats', labelEn: 'Contracts', icon: ScrollText, filter: 'contract' },
  { id: 'tax', label: 'Documents fiscaux', labelEn: 'Tax Documents', icon: Landmark, filter: ['w2', 'w9', '1099', 'tax_form'] },
  { id: 'reports', label: 'Rapports', labelEn: 'Reports', icon: BarChart3, filter: 'report' },
  { id: 'other', label: 'Autres', labelEn: 'Other', icon: FileText, filter: 'other' },
];

const STATUS_LABELS: Record<string, { label: string; icon: any; bgColor: string; textColor: string }> = {
  uploaded: { label: 'Uploadé', icon: Clock, bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
  extracted: { label: 'Extrait', icon: CheckCircle, bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  validated: { label: 'Validé', icon: CheckCircle, bgColor: 'bg-green-100', textColor: 'text-green-800' },
  exported: { label: 'Exporté', icon: Archive, bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
  archived: { label: 'Archivé', icon: Archive, bgColor: 'bg-slate-100', textColor: 'text-slate-700' },
};

/**
 * Generate adaptive "Key Info" preview based on document type
 */
function getKeyInfoPreview(doc: DAFDocument): string {
  const aiType = doc.ai_detected_type || 'other';
  const keyInfo = doc.key_info as any;

  switch (aiType) {
    case 'invoice':
      const parts = [];
      if (doc.fournisseur || keyInfo?.supplier) parts.push(doc.fournisseur || keyInfo?.supplier);
      if (doc.montant_ttc || keyInfo?.amount) {
        const amount = doc.montant_ttc || keyInfo?.amount;
        parts.push(`${amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
      }
      if (doc.date_document || keyInfo?.date) {
        const date = doc.date_document || keyInfo?.date;
        parts.push(new Date(date).toLocaleDateString('fr-FR'));
      }
      return parts.join(' • ') || 'Facture';

    case 'cv':
      const cvParts = [];
      if (keyInfo?.name) cvParts.push(keyInfo.name);
      if (keyInfo?.title) cvParts.push(keyInfo.title);
      return cvParts.join(' • ') || `${doc.page_count || '?'} page(s)`;

    case 'contract':
      const contractParts = [];
      if (keyInfo?.type) contractParts.push(keyInfo.type);
      if (keyInfo?.parties?.length) contractParts.push(`${keyInfo.parties.length} parties`);
      if (keyInfo?.renewal_date) contractParts.push(`Échéance: ${keyInfo.renewal_date}`);
      return contractParts.join(' • ') || 'Contrat';

    default:
      const defaultParts = [];
      if (doc.page_count) defaultParts.push(`${doc.page_count} page(s)`);
      if (doc.table_count) defaultParts.push(`${doc.table_count} table(s)`);
      if (keyInfo?.summary) defaultParts.push(keyInfo.summary);
      return defaultParts.join(' • ') || 'Document';
  }
}

export function DocumentInbox({ orgId, refreshTrigger, onSearch }: InboxProps) {
  const router = useRouter();
  const [allDocuments, setAllDocuments] = useState<DAFDocument[]>([]);
  const [searchResults, setSearchResults] = useState<DAFDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stats, setStats] = useState<SmartHubStats | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchMode, setSearchMode] = useState<'local' | 'fulltext' | 'ilike'>('local');
  const [totalSearchResults, setTotalSearchResults] = useState(0);

  // Debounce search query (400ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  // Load initial documents (all documents for the org)
  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      performSearch(debouncedSearchQuery);
    } else {
      // Clear search results when query is empty
      setSearchResults([]);
      setSearchMode('local');
      setTotalSearchResults(0);
    }
  }, [debouncedSearchQuery, typeFilter]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const response = await fetch('/api/daf/documents');
      const data = await response.json();

      if (data.success) {
        setAllDocuments(data.data.documents);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function performSearch(query: string) {
    if (!query.trim()) return;

    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '100',
      });

      // Add type filter if not 'all'
      if (typeFilter !== 'all') {
        params.set('doc_type', typeFilter);
      }

      const response = await fetch(`/api/daf/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data.documents);
        setSearchMode(data.data.searchMode || 'ilike');
        setTotalSearchResults(data.data.pagination?.total || data.data.documents.length);
        console.log(`[Search] Found ${data.data.documents.length} results using ${data.data.searchMode}`);
      }
    } catch (error) {
      console.error('Error searching documents:', error);
      // Fallback to local search
      setSearchMode('local');
    } finally {
      setSearching(false);
    }
  }

  // Handle folder selection (syncs with type filter)
  const handleFolderSelect = (folderId: string) => {
    setActiveFolder(folderId);
    const folder = FOLDER_STRUCTURE.find(f => f.id === folderId);
    if (folder) {
      if (folder.filter === null) {
        setTypeFilter('all');
      } else if (Array.isArray(folder.filter)) {
        setTypeFilter(folder.filter[0]); // Use first type for multi-type folders
      } else {
        setTypeFilter(folder.filter);
      }
    }
  };

  // Determine which documents to display
  const isSearchActive = debouncedSearchQuery.trim().length > 0;
  const documents = isSearchActive ? searchResults : allDocuments;

  // Apply local type filter only when not searching (search API handles it)
  const filteredDocuments = isSearchActive
    ? documents
    : documents.filter(d => {
        if (typeFilter === 'all') return true;
        if (typeFilter === 'invoice') return d.ai_detected_type === 'invoice' || d.doc_type === 'facture';
        if (typeFilter === 'contract') return d.ai_detected_type === 'contract' || d.doc_type === 'contrat';

        // Check for USA tax forms in folder
        const folder = FOLDER_STRUCTURE.find(f => f.id === activeFolder);
        if (folder && Array.isArray(folder.filter)) {
          return folder.filter.includes(d.ai_detected_type || '');
        }
        return d.ai_detected_type === typeFilter;
      });

  // Count by AI type for filters and sidebar (always use allDocuments for consistent counts)
  const typeCounts: Record<string, number> = {
    all: allDocuments.length,
    invoice: allDocuments.filter(d => d.ai_detected_type === 'invoice' || d.doc_type === 'facture').length,
    cv: allDocuments.filter(d => d.ai_detected_type === 'cv').length,
    contract: allDocuments.filter(d => d.ai_detected_type === 'contract' || d.doc_type === 'contrat').length,
    report: allDocuments.filter(d => d.ai_detected_type === 'report').length,
    tax: allDocuments.filter(d => ['w2', 'w9', '1099', 'tax_form'].includes(d.ai_detected_type || '')).length,
    other: allDocuments.filter(d => !d.ai_detected_type || d.ai_detected_type === 'other').length,
  };

  // Get folder document count
  const getFolderCount = (folderId: string) => {
    if (folderId === 'all') return allDocuments.length;
    if (folderId === 'invoices') return typeCounts.invoice;
    if (folderId === 'cvs') return typeCounts.cv;
    if (folderId === 'contracts') return typeCounts.contract;
    if (folderId === 'tax') return typeCounts.tax;
    if (folderId === 'reports') return typeCounts.report;
    if (folderId === 'other') return typeCounts.other;
    return 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar Folders */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} flex-shrink-0 transition-all duration-300`}>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm sticky top-4">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            {!sidebarCollapsed && <span className="text-sm font-bold text-gray-900">Dossiers</span>}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
          <div className="p-2">
            {FOLDER_STRUCTURE.map(folder => {
              const Icon = folder.icon;
              const count = getFolderCount(folder.id);
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => handleFolderSelect(folder.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-sm font-medium truncate flex-1">{folder.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                        {count}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* AI Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {searching ? (
              <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 text-purple-500" />
            )}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Recherche intelligente... (ex: factures Amazon, CV développeur, contrats 2024)"
            className="w-full pl-12 pr-32 py-3.5 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl text-gray-900 placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <div className="absolute inset-y-0 right-4 flex items-center gap-2">
            {/* Search mode badge */}
            {isSearchActive && !searching && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                searchMode === 'fulltext'
                  ? 'bg-green-100 text-green-700'
                  : searchMode === 'ilike'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {searchMode === 'fulltext' && <><Zap className="h-3 w-3 inline mr-1" />Full-text</>}
                {searchMode === 'ilike' && 'ILIKE'}
                {searchMode === 'local' && 'Local'}
              </span>
            )}
            {/* Results count */}
            {isSearchActive && !searching && (
              <span className="text-xs text-purple-600 font-medium">
                {filteredDocuments.length} résultat{filteredDocuments.length !== 1 ? 's' : ''}
              </span>
            )}
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search results header */}
        {isSearchActive && (
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
            <Search className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-purple-700">
              Recherche : <strong>&quot;{debouncedSearchQuery}&quot;</strong>
              {' '}&mdash;{' '}
              {searching ? 'Recherche en cours...' : `${filteredDocuments.length} document(s) trouvé(s)`}
              {searchMode === 'fulltext' && !searching && (
                <span className="ml-2 text-green-600">(recherche dans le contenu des PDFs)</span>
              )}
            </span>
          </div>
        )}

        {/* Stats + View Toggle Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Mini Stats */}
          {stats && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                <Receipt className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">{stats.total_invoices || 0} factures</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                <User className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-700">{stats.total_cvs || 0} CVs</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <ScrollText className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">{stats.total_contracts || 0} contrats</span>
              </div>
              {(stats.needs_attention || 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">{stats.needs_attention} attention</span>
                </div>
              )}
            </div>
          )}

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="h-4 w-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'card'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
          </div>
        </div>

        {/* Type Filters (Quick) */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setTypeFilter('all'); setActiveFolder('all'); }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              typeFilter === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
            }`}
          >
            Tous ({typeCounts.all})
          </button>
          {['invoice', 'cv', 'contract', 'report', 'other'].map(type => {
            const config = AI_TYPE_CONFIG[type];
            const count = typeCounts[type] || 0;
            if (count === 0 && type !== 'other') return null;
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                  typeFilter === type
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : `${config.bgColor} ${config.textColor} border ${config.borderColor} hover:opacity-80`
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Documents Display (Table or Card) */}
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery ? 'Aucun document trouvé pour cette recherche' : 'Aucun document trouvé'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery ? 'Essayez une autre recherche' : 'Uploadez vos premiers documents pour commencer'}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            /* Card View */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map(doc => {
                const aiType = (doc.ai_detected_type || 'other') as AIDetectedType;
                const typeConfig = AI_TYPE_CONFIG[aiType] || AI_TYPE_CONFIG.other;
                const TypeIcon = typeConfig.icon;
                const statusInfo = STATUS_LABELS[doc.status] || STATUS_LABELS.uploaded;
                const StatusIcon = statusInfo.icon;
                const keyInfoPreview = getKeyInfoPreview(doc);

                return (
                  <div
                    key={doc.id}
                    className="group relative bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
                    onClick={() => router.push(`/daf/documents/${doc.id}/viewer`)}
                  >
                    {/* Type Badge - Top Right */}
                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${typeConfig.bgColor} ${typeConfig.textColor} border ${typeConfig.borderColor}`}>
                        <TypeIcon className="h-3 w-3" />
                        {typeConfig.label}
                      </span>
                    </div>

                    {/* Document Icon */}
                    <div className={`w-12 h-12 rounded-xl ${typeConfig.bgColor} flex items-center justify-center mb-3`}>
                      <TypeIcon className={`h-6 w-6 ${typeConfig.textColor}`} />
                    </div>

                    {/* File Name */}
                    <h3 className="text-sm font-semibold text-gray-900 truncate mb-1 pr-16" title={doc.file_name}>
                      {doc.file_name}
                    </h3>

                    {/* Key Info Preview */}
                    <p className="text-xs text-slate-600 truncate mb-3" title={keyInfoPreview}>
                      {keyInfoPreview}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>
                        {doc.page_count && (
                          <span className="text-xs text-slate-500">{doc.page_count} pages</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-600/90 to-transparent opacity-0 group-hover:opacity-100 transition-all rounded-xl flex items-end justify-center pb-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/daf/documents/${doc.id}/viewer`); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white text-blue-600 rounded-lg font-semibold shadow-lg"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Voir
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(doc.file_url, '_blank'); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/20 text-white rounded-lg font-semibold backdrop-blur"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Document
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Aperçu
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Pages
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Uploadé
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.map(doc => {
                    const aiType = (doc.ai_detected_type || 'other') as AIDetectedType;
                    const typeConfig = AI_TYPE_CONFIG[aiType] || AI_TYPE_CONFIG.other;
                    const TypeIcon = typeConfig.icon;
                    const statusInfo = STATUS_LABELS[doc.status] || STATUS_LABELS.uploaded;
                    const StatusIcon = statusInfo.icon;
                    const keyInfoPreview = getKeyInfoPreview(doc);

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        {/* Document Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${typeConfig.bgColor}`}>
                              <TypeIcon className={`h-4 w-4 ${typeConfig.textColor}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${typeConfig.bgColor} ${typeConfig.textColor} border ${typeConfig.borderColor}`}>
                            {typeConfig.label}
                          </span>
                        </td>

                        {/* Key Info Preview - Adaptive */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-700 truncate max-w-[250px] block" title={keyInfoPreview}>
                            {keyInfoPreview}
                          </span>
                        </td>

                        {/* Page Count */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-slate-600">
                            {doc.page_count || '-'}
                          </span>
                        </td>

                        {/* Upload Date */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => router.push(`/daf/documents/${doc.id}/viewer`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-sm transition-all"
                              title="Voir l'analyse"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Voir
                            </button>
                            <button
                              onClick={() => window.open(doc.file_url, '_blank')}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 font-semibold transition-all"
                              title="Télécharger PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
