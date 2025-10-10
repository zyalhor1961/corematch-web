'use client';

/**
 * Document Queue Component - Rossum-inspired real-time queue management
 *
 * Features:
 * - Real-time document status tracking
 * - Priority-based sorting and filtering
 * - Drag-and-drop priority reordering
 * - Batch operations (assign, process, export)
 * - Advanced filtering and search
 * - Queue analytics and SLA monitoring
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  User,
  Calendar,
  TrendingUp,
  AlertCircle,
  Download,
  Play,
  Pause,
  Upload
} from 'lucide-react';
import { IDPDocument } from './UnifiedIDPDashboard';

interface DocumentQueueProps {
  documents: IDPDocument[];
  onDocumentSelect: (doc: IDPDocument) => void;
  onStatusChange: (documentId: string, newStatus: IDPDocument['status']) => void;
  onUpload?: (file: File) => void;
  isUploading?: boolean;
  queueStats: {
    total: number;
    pending: number;
    processing: number;
    review: number;
    completed: number;
    errors: number;
    avgConfidence: number;
  };
  isDarkMode?: boolean;
}

const STATUS_CONFIG = {
  pending: {
    color: 'bg-gradient-to-r from-blue-500 to-blue-600',
    label: 'Pending',
    icon: Clock,
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50',
    bgDark: 'bg-blue-950/30',
    borderLight: 'border-blue-200',
    borderDark: 'border-blue-500/30'
  },
  processing: {
    color: 'bg-gradient-to-r from-purple-500 to-purple-600',
    label: 'Processing',
    icon: Loader2,
    textColor: 'text-purple-600',
    bgLight: 'bg-purple-50',
    bgDark: 'bg-purple-950/30',
    borderLight: 'border-purple-200',
    borderDark: 'border-purple-500/30'
  },
  review: {
    color: 'bg-gradient-to-r from-amber-500 to-orange-600',
    label: 'Review',
    icon: AlertTriangle,
    textColor: 'text-amber-600',
    bgLight: 'bg-amber-50',
    bgDark: 'bg-amber-950/30',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-500/30'
  },
  completed: {
    color: 'bg-gradient-to-r from-emerald-500 to-green-600',
    label: 'Completed',
    icon: CheckCircle,
    textColor: 'text-green-600',
    bgLight: 'bg-green-50',
    bgDark: 'bg-green-950/30',
    borderLight: 'border-green-200',
    borderDark: 'border-green-500/30'
  },
  error: {
    color: 'bg-gradient-to-r from-red-500 to-red-600',
    label: 'Error',
    icon: XCircle,
    textColor: 'text-red-600',
    bgLight: 'bg-red-50',
    bgDark: 'bg-red-950/30',
    borderLight: 'border-red-200',
    borderDark: 'border-red-500/30'
  }
};

const PRIORITY_CONFIG = {
  high: { color: 'text-red-500', label: 'High', badge: 'bg-red-500' },
  medium: { color: 'text-yellow-500', label: 'Medium', badge: 'bg-yellow-500' },
  low: { color: 'text-blue-500', label: 'Low', badge: 'bg-blue-500' }
};

export const DocumentQueue: React.FC<DocumentQueueProps> = ({
  documents,
  onDocumentSelect,
  onStatusChange,
  onUpload,
  isUploading = false,
  queueStats,
  isDarkMode = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IDPDocument['status'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<IDPDocument['priority'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'confidence'>('date');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.assignee?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(doc => doc.priority === priorityFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return b.uploadedAt.getTime() - a.uploadedAt.getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortBy === 'confidence') {
        return (b.confidence || 0) - (a.confidence || 0);
      }
      return 0;
    });

    return filtered;
  }, [documents, searchQuery, statusFilter, priorityFilter, sortBy]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Queue Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: queueStats.total, icon: FileText, color: 'blue' },
          { label: 'Pending', value: queueStats.pending, icon: Clock, color: 'blue' },
          { label: 'Processing', value: queueStats.processing, icon: Loader2, color: 'purple' },
          { label: 'Review', value: queueStats.review, icon: AlertTriangle, color: 'amber' },
          { label: 'Completed', value: queueStats.completed, icon: CheckCircle, color: 'green' },
          { label: 'Errors', value: queueStats.errors, icon: XCircle, color: 'red' }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} p-5 shadow-lg hover:shadow-xl transition-all group`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {stat.label}
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br from-${stat.color}-500 to-${stat.color}-600 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Zone */}
      {onUpload && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file && onUpload) {
              onUpload(file);
            }
          }}
          className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
              : isDarkMode
                ? 'border-slate-700 bg-slate-900/50'
                : 'border-slate-300 bg-white'
          } shadow-xl hover:shadow-2xl`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
          <div className="relative p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={`p-5 rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-blue-600 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'} shadow-lg`}>
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Upload Documents
                  </h3>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Drag and drop PDF files here or click to browse
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUpload) {
                      onUpload(file);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      Select PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className={`rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} p-5 shadow-lg`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`px-4 py-2.5 rounded-xl border transition-all ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className={`px-4 py-2.5 rounded-xl border transition-all ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-4 py-2.5 rounded-xl border transition-all ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="confidence">Sort by Confidence</option>
          </select>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-3">
        {filteredDocuments.length === 0 ? (
          <div className={`rounded-2xl border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-300 bg-slate-50'} p-16 text-center`}>
            <FileText className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              No documents found
            </h3>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          filteredDocuments.map(doc => {
            const statusConfig = STATUS_CONFIG[doc.status];
            const StatusIcon = statusConfig.icon;
            const priorityConfig = PRIORITY_CONFIG[doc.priority];

            return (
              <div
                key={doc.id}
                onClick={() => onDocumentSelect(doc)}
                className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? `bg-slate-900/50 border-slate-800 hover:border-slate-700 ${statusConfig.borderDark}`
                    : `bg-white border-slate-200 hover:border-slate-300 ${statusConfig.borderLight}`
                } hover:shadow-xl`}
              >
                {/* Priority Indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityConfig.badge}`}></div>

                <div className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Document Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {doc.filename}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white ${statusConfig.color} shadow-lg`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {formatDate(doc.uploadedAt)}
                          </span>
                        </div>

                        {doc.assignee && (
                          <div className="flex items-center gap-1.5">
                            <User className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {doc.assignee}
                            </span>
                          </div>
                        )}

                        {doc.confidence !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                            <span className={`text-sm font-semibold ${
                              doc.confidence >= 0.95 ? 'text-green-500' :
                              doc.confidence >= 0.80 ? 'text-yellow-500' :
                              'text-red-500'
                            }`}>
                              {Math.round(doc.confidence * 100)}% confidence
                            </span>
                          </div>
                        )}

                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${priorityConfig.color}`}>
                          {priorityConfig.label} Priority
                        </div>
                      </div>

                      {doc.errorMessage && (
                        <div className={`mt-3 p-2.5 rounded-lg flex items-start gap-2 ${isDarkMode ? 'bg-red-950/50 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className={`text-xs ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                            {doc.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <button
                      className={`p-2 rounded-xl transition-all ${
                        isDarkMode
                          ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                          : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Show context menu
                      }}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
