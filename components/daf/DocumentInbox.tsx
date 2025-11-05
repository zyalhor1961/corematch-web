'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Clock, CheckCircle, Archive, Filter, Eye, Download } from 'lucide-react';
import type { DAFDocument } from '@/lib/daf-docs/types';

interface InboxProps {
  refreshTrigger?: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  facture: 'Facture',
  releve_bancaire: 'Relevé bancaire',
  contrat: 'Contrat',
  assurance: 'Assurance',
  note_frais: 'Note de frais',
  autre: 'Autre',
};

const STATUS_LABELS: Record<string, { label: string; icon: any; bgColor: string; textColor: string; badgeColor: string }> = {
  uploaded: { label: 'Uploadé', icon: Clock, bgColor: 'bg-amber-100', textColor: 'text-amber-700', badgeColor: 'text-amber-600' },
  extracted: { label: 'Extrait', icon: CheckCircle, bgColor: 'bg-blue-100', textColor: 'text-blue-800', badgeColor: 'text-blue-600' },
  validated: { label: 'Validé', icon: CheckCircle, bgColor: 'bg-green-100', textColor: 'text-green-800', badgeColor: 'text-green-600' },
  exported: { label: 'Exporté', icon: Archive, bgColor: 'bg-cyan-100', textColor: 'text-cyan-800', badgeColor: 'text-cyan-600' },
  archived: { label: 'Archivé', icon: Archive, bgColor: 'bg-slate-100', textColor: 'text-slate-700', badgeColor: 'text-slate-600' },
};

export function DocumentInbox({ refreshTrigger }: InboxProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DAFDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const response = await fetch('/api/daf/documents');
      const data = await response.json();

      if (data.success) {
        setDocuments(data.data.documents);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredDocuments = filter === 'all'
    ? documents
    : documents.filter(d => d.doc_type === filter);

  const docTypeCounts = documents.reduce((acc, doc) => {
    acc[doc.doc_type] = (acc[doc.doc_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Premium Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <p className="text-sm font-medium text-slate-600 mb-2">Total documents</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{stats.total_documents || 0}</p>
          </div>
          <div className="group relative overflow-hidden bg-gradient-to-br from-white to-blue-50 border border-blue-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <p className="text-sm font-medium text-blue-700 mb-2">Factures</p>
            <p className="text-3xl font-bold text-blue-600">{stats.total_factures || 0}</p>
          </div>
          <div className="group relative overflow-hidden bg-gradient-to-br from-white to-green-50 border border-green-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <p className="text-sm font-medium text-green-700 mb-2">Validés</p>
            <p className="text-3xl font-bold text-green-600">{stats.total_valides || 0}</p>
          </div>
          <div className="group relative overflow-hidden bg-gradient-to-br from-white to-amber-50 border border-amber-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <p className="text-sm font-medium text-amber-700 mb-2">En attente</p>
            <p className="text-3xl font-bold text-amber-600">{stats.total_en_attente || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gradient-to-r from-white to-slate-50 border-2 border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Filter className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Filtrer par type</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              filter === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-900 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            Tous ({documents.length})
          </button>
          {Object.entries(DOC_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                filter === type
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-900 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {label} ({docTypeCounts[type] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Documents table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun document trouvé</p>
            <p className="text-sm text-gray-400 mt-1">
              Uploadez vos premiers documents pour commencer
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Fichier
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Fournisseur
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                    Montant
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDocuments.map(doc => {
                  const statusInfo = STATUS_LABELS[doc.status] || {
                    icon: Clock,
                    bgColor: 'bg-gray-100',
                    textColor: 'text-gray-700',
                    badgeColor: 'text-gray-600',
                    label: doc.status
                  };
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {doc.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {doc.fournisseur || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {doc.date_document
                            ? new Date(doc.date_document).toLocaleDateString('fr-FR')
                            : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {doc.montant_ttc ? (
                          <span className="text-sm font-bold text-gray-900">
                            {doc.montant_ttc.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusInfo.bgColor} ${statusInfo.textColor} border-2 ${statusInfo.bgColor.replace('bg-', 'border-')}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/daf/documents/${doc.id}/viewer`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-bold shadow-md hover:shadow-lg transition-all"
                            title="Voir avec analyse"
                          >
                            <Eye className="h-4 w-4" />
                            Analyse
                          </button>
                          <button
                            onClick={() => window.open(doc.file_url, '_blank')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-400 font-bold transition-all"
                            title="Télécharger PDF"
                          >
                            <Download className="h-4 w-4" />
                            PDF
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
  );
}
