'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Document } from '@/lib/types';
import { 
  Upload, 
  FileText, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye
} from 'lucide-react';

export default function DEBAssistantPage() {
  const params = useParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  
  const orgId = params?.orgId as string;

  useEffect(() => {
    if (orgId) {
      loadDocuments();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/deb/documents?orgId=${orgId}`);
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      alert('Seuls les fichiers PDF sont acceptés');
      return;
    }

    setUploadingFile(file);
    
    try {
      // Créer le document
      const response = await fetch('/api/deb/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          filename: file.name,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const { document, uploadUrl } = data.data;

        // Upload le fichier
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': 'application/pdf'
          }
        });

        if (uploadResponse.ok) {
          // Démarrer le traitement
          await fetch(`/api/deb/documents/${document.id}/process`, {
            method: 'POST'
          });
          
          loadDocuments();
        } else {
          throw new Error('Upload failed');
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Erreur lors de l\'upload du fichier');
    } finally {
      setUploadingFile(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'exported':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'needs_review':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'parsing':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      uploaded: 'Uploadé',
      processing: 'Traitement en cours',
      parsed: 'Analysé',
      enriched: 'Enrichi',
      needs_review: 'Révision requise',
      approved: 'Approuvé',
      exported: 'Exporté',
      error: 'Erreur'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      uploaded: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800',
      parsed: 'bg-yellow-100 text-yellow-800',
      enriched: 'bg-purple-100 text-purple-800',
      needs_review: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      exported: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DEB Assistant</h1>
          <p className="text-gray-600">Transformez vos factures scannées en données DEB</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <UploadButton onFileSelect={handleFileUpload} isUploading={!!uploadingFile} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Documents</p>
              <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">En traitement</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => ['processing', 'parsing'].includes(d.status)).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Révision</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.status === 'needs_review').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Exportés</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.status === 'exported').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload in progress */}
      {uploadingFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <div>
              <p className="text-sm font-medium text-blue-900">
                Upload en cours: {uploadingFile.name}
              </p>
              <p className="text-xs text-blue-700">
                Le traitement démarrera automatiquement après l&apos;upload
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Documents Table */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun document DEB
          </h3>
          <p className="text-gray-600 mb-6">
            Uploadez votre premier document PDF pour commencer le traitement automatique
          </p>
          <UploadButton onFileSelect={handleFileUpload} isUploading={false} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lignes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.filename}
                        </p>
                        {doc.invoice_number && (
                          <p className="text-xs text-gray-500">
                            {doc.invoice_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm text-gray-900">
                        {doc.supplier_name || '-'}
                      </p>
                      {doc.supplier_vat && (
                        <p className="text-xs text-gray-500">
                          {doc.supplier_vat}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(doc.status)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                        {getStatusLabel(doc.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.pages_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doc.line_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button className="text-blue-600 hover:text-blue-900">
                      <Eye className="w-4 h-4" />
                    </button>
                    {doc.export_url && (
                      <button className="text-green-600 hover:text-green-900">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UploadButton({ onFileSelect, isUploading }: {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = '';
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        disabled={isUploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <Button disabled={isUploading}>
        <Upload className="w-4 h-4 mr-2" />
        {isUploading ? 'Upload...' : 'Uploader PDF'}
      </Button>
    </div>
  );
}