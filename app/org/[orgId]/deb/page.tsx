'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import { Document } from '@/lib/types';
import { 
  Upload, 
  FileText, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  Brain,
  Zap,
  Link,
  ArrowUpRight,
  Sparkles,
  Target,
  Activity,
  TrendingUp,
  Table,
  List
} from 'lucide-react';
import SpreadsheetView from '@/app/components/deb/SpreadsheetView';

export default function DEBAssistantPage() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'spreadsheet'>('overview');
  const [spreadsheetData, setSpreadsheetData] = useState<any[]>([]);
  const [loadingSpreadsheet, setLoadingSpreadsheet] = useState(false);
  
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

  const loadSpreadsheetData = async () => {
    setLoadingSpreadsheet(true);
    try {
      const response = await fetch(`/api/deb/spreadsheet?orgId=${orgId}`);
      const data = await response.json();
      
      if (data.success) {
        setSpreadsheetData(data.data);
      }
    } catch (error) {
      console.error('Error loading spreadsheet data:', error);
    } finally {
      setLoadingSpreadsheet(false);
    }
  };

  useEffect(() => {
    if (orgId && activeTab === 'spreadsheet') {
      loadSpreadsheetData();
    }
  }, [orgId, activeTab]);

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
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'parsed':
      case 'enriched':
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'needs_review':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'parsing':
        return <Brain className="w-5 h-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />;
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
      uploaded: isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-200',
      processing: isDarkMode ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-800 border-blue-200',
      parsed: isDarkMode ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
      enriched: isDarkMode ? 'bg-purple-900/50 text-purple-300 border-purple-700' : 'bg-purple-50 text-purple-800 border-purple-200',
      needs_review: isDarkMode ? 'bg-amber-900/50 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-800 border-amber-200',
      approved: isDarkMode ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
      exported: isDarkMode ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
      error: isDarkMode ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-50 text-red-800 border-red-200'
    };
    return colors[status] || (isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-800 border-slate-200');
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${isDarkMode ? 'bg-slate-950' : 'bg-gray-50'}`}>
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-emerald-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-r from-emerald-400 to-blue-600 opacity-20"></div>
          </div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Chargement des documents DEB...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'}`}>
      <div className="space-y-8">
        {/* Premium Header */}
        <div className={`relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-white via-slate-50 to-slate-100'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-xl`}>
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-amber-500/10"></div>
          <div className="relative px-8 py-12">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-sm border ${isDarkMode ? 'border-slate-600/30' : 'border-slate-200/50'}`}>
                    <Brain className={`w-8 h-8 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                      DEB Assistant IA
                    </h1>
                    <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} font-medium`}>
                      Transformez automatiquement vos factures scannées en données DEB
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 sm:mt-0">
                <UploadButton onFileSelect={handleFileUpload} isUploading={!!uploadingFile} />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} rounded-xl shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex space-x-1 p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'overview'
                  ? `${isDarkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-600 text-white'} shadow-md`
                  : `${isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`
              }`}
            >
              <List className="w-4 h-4 mr-2" />
              Vue d'ensemble
            </button>
            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'spreadsheet'
                  ? `${isDarkMode ? 'bg-emerald-600 text-white' : 'bg-emerald-600 text-white'} shadow-md`
                  : `${isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`
              }`}
            >
              <Table className="w-4 h-4 mr-2" />
              Vue Tableur
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Premium Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Total Documents */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Documents</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                    {documents.length}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <FileText className={`w-7 h-7 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Traitement IA</span>
              </div>
            </div>
          </div>

          {/* Processing */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>En traitement</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                    {documents.filter(d => ['processing', 'parsing'].includes(d.status)).length}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <Brain className={`w-7 h-7 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'} animate-pulse`} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>IA en cours</span>
              </div>
            </div>
          </div>

          {/* Needs Review */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-rose-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Révision requise</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                    {documents.filter(d => d.status === 'needs_review').length}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <AlertTriangle className={`w-7 h-7 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Target className={`w-4 h-4 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>À vérifier</span>
              </div>
            </div>
          </div>

          {/* Exported */}
          <div className={`group relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} border ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/50'} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Exportés DEB</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>
                    {documents.filter(d => d.status === 'exported').length}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'} group-hover:scale-110 transition-transform duration-300`}>
                  <CheckCircle className={`w-7 h-7 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Terminés</span>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Upload Progress */}
        {uploadingFile && (
          <div className={`relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-gradient-to-r from-blue-900/50 to-emerald-900/50' : 'bg-gradient-to-r from-blue-50 to-emerald-50'} border ${isDarkMode ? 'border-blue-700/50' : 'border-blue-200'} shadow-lg`}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 animate-pulse"></div>
            <div className="relative p-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-200 border-t-emerald-600"></div>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 animate-pulse opacity-20"></div>
                </div>
                <div className="space-y-2">
                  <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Analyse IA en cours: {uploadingFile.name}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    🧠 Extraction automatique des données • Détection des BL • Validation des informations
                  </p>
                </div>
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
          </>
        )}

        {/* Spreadsheet Tab Content */}
        {activeTab === 'spreadsheet' && (
          <div className="space-y-6">
            {loadingSpreadsheet ? (
              <div className={`flex items-center justify-center h-64 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'} rounded-xl`}>
                <div className="text-center space-y-4">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-emerald-600 mx-auto"></div>
                    <div className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-r from-emerald-400 to-blue-600 opacity-20"></div>
                  </div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Chargement des données du tableur...
                  </p>
                </div>
              </div>
            ) : (
              <SpreadsheetView 
                data={spreadsheetData} 
                onDataChange={setSpreadsheetData}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadButton({ onFileSelect, isUploading }: {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}) {
  const { isDarkMode } = useTheme();
  const inputId = `file-upload-${Date.now()}`;
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = '';
  };

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        disabled={isUploading}
        className="hidden"
      />
      <label 
        htmlFor={inputId}
        className={`inline-flex items-center px-6 py-3 rounded-lg font-medium cursor-pointer transition-all duration-200 
          ${isUploading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : `${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'} hover:shadow-lg`
          } text-white shadow-md`}
      >
        <div className="flex items-center space-x-2">
          {isUploading ? (
            <Brain className="w-4 h-4 animate-pulse" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{isUploading ? 'Analyse IA en cours...' : 'Uploader PDF'}</span>
          {!isUploading && <Sparkles className="w-4 h-4" />}
        </div>
      </label>
    </div>
  );
}