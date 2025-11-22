'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Loader2, Sparkles, Download, ExternalLink, MessageSquare,
  BarChart3, List, Gauge, AlertCircle, ChevronDown, ChevronUp,
  FileText, Receipt, User, ScrollText, X, TrendingUp, Table
} from 'lucide-react';
import type { DafAskResponse, ColumnDefinition } from '@/lib/daf-ask/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: DafAskResponse;
}

interface AskDAFProps {
  orgId: string;
}

const EXAMPLE_QUESTIONS = {
  fr: [
    'Donne moi les factures non réglées',
    'Combien j\'ai dépensé en 2024 ?',
    'Quels sont mes principaux fournisseurs ?',
    'Liste les CVs reçus ce mois-ci',
    'Résumé de mon workspace',
  ],
  en: [
    'Show me unpaid invoices',
    'How much did I spend in 2024?',
    'Who are my main suppliers?',
    'List CVs received this month',
    'Workspace summary',
  ],
};

const MODE_ICONS = {
  analysis: BarChart3,
  listing: List,
  kpi: Gauge,
  mixed: Sparkles,
};

const MODE_LABELS = {
  analysis: 'Analyse',
  listing: 'Liste',
  kpi: 'KPI',
  mixed: 'Mixte',
};

// Simple bar chart component (no dependencies)
function SimpleBarChart({ data, columns }: { data: Record<string, any>[]; columns: ColumnDefinition[] }) {
  // Find the label column and value column
  const labelCol = columns.find(c => c.type === 'string' || c.type === 'date') || columns[0];
  const valueCol = columns.find(c => c.type === 'currency' || c.type === 'number') || columns[1];

  if (!labelCol || !valueCol || data.length === 0) return null;

  const values = data.map(row => row[valueCol.key] || 0);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="space-y-2 p-4">
      {data.slice(0, 12).map((row, idx) => {
        const value = row[valueCol.key] || 0;
        const percentage = (value / maxValue) * 100;
        const label = row[labelCol.key] || `Item ${idx + 1}`;

        return (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-24 text-xs text-slate-600 truncate text-right" title={String(label)}>
              {String(label).substring(0, 12)}
            </div>
            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="w-24 text-xs font-medium text-slate-700">
              {valueCol.type === 'currency'
                ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
                : value.toLocaleString('fr-FR')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AskDAF({ orgId }: AskDAFProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<string | null>(null);
  const [chartViews, setChartViews] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setLoading(true);

    try {
      const response = await fetch('/api/daf/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language: 'auto' }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.data.answer,
          timestamp: new Date(),
          data: result.data,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: result.error || 'Une erreur s\'est produite.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Ask DAF error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Erreur de connexion. Veuillez réessayer.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleExampleClick(question: string) {
    setInput(question);
    inputRef.current?.focus();
  }

  function handleExportCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function formatCellValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '-';

    if (type === 'currency') {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
    }

    if (type === 'date') {
      try {
        return new Date(value).toLocaleDateString('fr-FR');
      } catch {
        return String(value);
      }
    }

    if (type === 'percentage') {
      return `${(value * 100).toFixed(1)}%`;
    }

    return String(value);
  }

  // Check if data is suitable for chart (has numeric column)
  function isChartable(data: DafAskResponse): boolean {
    if (!data.rows || !data.columns || data.rows.length < 2) return false;
    return data.columns.some(c => c.type === 'currency' || c.type === 'number');
  }

  function toggleChartView(messageId: string) {
    setChartViews(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  }

  function renderDataTable(data: DafAskResponse, messageId: string) {
    if (!data.rows || !data.columns || data.rows.length === 0) return null;

    const isExpanded = expandedResults === data.answer;
    const displayRows = isExpanded ? data.rows : data.rows.slice(0, 5);
    const showChart = chartViews[messageId];
    const chartable = isChartable(data);

    return (
      <div className="mt-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              {data.rows.length} résultat{data.rows.length !== 1 ? 's' : ''}
            </span>
            {data.mode && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                data.mode === 'kpi' ? 'bg-purple-100 text-purple-700' :
                data.mode === 'listing' ? 'bg-blue-100 text-blue-700' :
                data.mode === 'analysis' ? 'bg-green-100 text-green-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {React.createElement(MODE_ICONS[data.mode], { className: 'h-3 w-3' })}
                {MODE_LABELS[data.mode]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Chart/Table Toggle */}
            {chartable && (
              <div className="flex items-center bg-slate-100 rounded p-0.5">
                <button
                  onClick={() => toggleChartView(messageId)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                    !showChart ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Table className="h-3 w-3" />
                </button>
                <button
                  onClick={() => toggleChartView(messageId)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                    showChart ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <TrendingUp className="h-3 w-3" />
                </button>
              </div>
            )}

            {data.exports?.csv && (
              <button
                onClick={() => handleExportCSV(data.exports!.csv!, `export-${Date.now()}.csv`)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
            )}
          </div>
        </div>

        {/* Chart View */}
        {showChart && chartable && (
          <SimpleBarChart data={data.rows} columns={data.columns} />
        )}

        {/* Table (hidden when chart is shown) */}
        {!showChart && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {data.columns.map(col => (
                    <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {data.columns!.map(col => (
                      <td key={col.key} className="px-3 py-2 text-slate-700">
                        {formatCellValue(row[col.key], col.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Show More/Less (only for table view) */}
        {!showChart && data.rows.length > 5 && (
          <button
            onClick={() => setExpandedResults(isExpanded ? null : data.answer)}
            className="w-full flex items-center justify-center gap-1 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 bg-slate-50 border-t border-slate-200 hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Voir les {data.rows.length - 5} autres
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  function renderSourceDocuments(data: DafAskResponse) {
    if (!data.sourceDocuments || data.sourceDocuments.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {data.sourceDocuments.slice(0, 5).map(doc => {
          const TypeIcon = doc.type === 'invoice' ? Receipt :
                          doc.type === 'cv' ? User :
                          doc.type === 'contract' ? ScrollText :
                          FileText;
          return (
            <a
              key={doc.id}
              href={`/daf/documents/${doc.id}/viewer`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <TypeIcon className="h-3 w-3" />
              <span className="max-w-[150px] truncate">{doc.title}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        })}
        {data.sourceDocuments.length > 5 && (
          <span className="text-xs text-slate-500">
            +{data.sourceDocuments.length - 5} autres
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="p-2 bg-white/20 rounded-lg">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Ask DAF</h2>
          <p className="text-sm text-white/80">Posez vos questions en langage naturel</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              Comment puis-je vous aider ?
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md">
              Posez une question sur vos factures, fournisseurs, CVs ou documents.
            </p>

            {/* Example Questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {EXAMPLE_QUESTIONS.fr.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(q)}
                  className="text-left px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-2'
                      : 'bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm'
                  }`}
                >
                  {/* Message Content */}
                  <p className={`text-sm whitespace-pre-wrap ${
                    message.role === 'user' ? 'text-white' : 'text-slate-800'
                  }`}>
                    {message.content}
                  </p>

                  {/* Data Table */}
                  {message.data && renderDataTable(message.data, message.id)}

                  {/* Source Documents */}
                  {message.data && renderSourceDocuments(message.data)}

                  {/* Warnings */}
                  {message.data?.warnings && message.data.warnings.length > 0 && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{message.data.warnings.join(', ')}</span>
                    </div>
                  )}

                  {/* Debug Info */}
                  {message.data?.debug && (
                    <div className="mt-2 text-xs text-slate-400">
                      {message.data.debug.duration}ms
                      {message.data.debug.toolsCalled.length > 0 && (
                        <span className="ml-2">
                          via {message.data.debug.toolsCalled.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analyse en cours...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question... (ex: factures non réglées, dépenses 2024)"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
