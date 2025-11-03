'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle, Archive, Filter } from 'lucide-react';
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

const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  uploaded: { label: 'Uploadé', icon: Clock, color: 'text-yellow-600' },
  extracted: { label: 'Extrait', icon: CheckCircle, color: 'text-blue-600' },
  validated: { label: 'Validé', icon: CheckCircle, color: 'text-green-600' },
  exported: { label: 'Exporté', icon: Archive, color: 'text-cyan-600' },
  archived: { label: 'Archivé', icon: Archive, color: 'text-gray-600' },
};

export function DocumentInbox({ refreshTrigger }: InboxProps) {
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
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium">Filtrer par type:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tous ({documents.length})
          </button>
          {Object.entries(DOC_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-sm rounded ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  const StatusIcon = STATUS_LABELS[doc.status]?.icon || Clock;
                  const statusColor = STATUS_LABELS[doc.status]?.color || 'text-gray-600';

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium truncate max-w-xs">
                            {doc.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {doc.fournisseur || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {doc.date_document
                            ? new Date(doc.date_document).toLocaleDateString('fr-FR')
                            : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {doc.montant_ttc ? (
                          <span className="text-sm font-medium text-gray-900">
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
                        <div className="flex items-center justify-center gap-1">
                          <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                          <span className={`text-xs ${statusColor}`}>
                            {STATUS_LABELS[doc.status]?.label || doc.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => window.open(doc.file_url, '_blank')}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Voir
                        </button>
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
