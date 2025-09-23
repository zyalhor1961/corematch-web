'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import { Document } from '@/lib/types';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';
import { 
  Upload, 
  FileText, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Brain,
  List,
  Table,
  X
} from 'lucide-react';

// It is highly recommended to move nested components like UploadButton and SpreadsheetView to their own files.

export default function DEBAssistantPage() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'spreadsheet'>('overview');
  const [showConfirmModal, setShowConfirmModal] = useState<{ action: () => void; title: string; message: string; } | null>(null);

  const orgId = params?.orgId as string;

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/deb/documents?orgId=${orgId}`);
      if (!response.ok) throw new Error("Le chargement des documents a échoué.");
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      } else {
        throw new Error(data.message || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      loadDocuments();
    }
  }, [orgId, loadDocuments]);

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.');
      return;
    }

    setShowConfirmModal({
      action: async () => {
        setUploadingFile(file);
        setError(null);
        setShowConfirmModal(null);
        try {
          const response = await fetch('/api/deb/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, filename: file.name })
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.message || "La création du document a échoué.");

          const { document, uploadUrl } = data.data;
          const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } });
          if (!uploadResponse.ok) throw new Error("L'upload du fichier a échoué.");

          await fetch(`/api/deb/documents/${document.id}/process`, { method: 'POST' });
          loadDocuments();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setUploadingFile(null);
        }
      },
      title: "Confirmer le traitement",
      message: `Voulez-vous uploader et lancer le traitement IA pour le fichier ${file.name} ?`
    });
  };

  // ... (rest of the helper functions like getStatusIcon, etc.)

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="sm:flex sm:items-center sm:justify-between">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>DEB Assistant</h1>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Automatisez le traitement de vos factures pour l'export DEB.</p>
        </div>

        {error && (
          <div className={`border rounded-md p-4 flex items-center justify-between ${isDarkMode ? 'bg-red-900/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-center"><AlertTriangle className="w-5 h-5 mr-3" /><span>{error}</span></div>
            <button onClick={() => setError(null)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-red-900/50' : 'hover:bg-red-100'}`}><X className="w-4 h-4" /></button>
          </div>
        )}

        <UploadButton onFileSelect={handleFileUpload} isUploading={!!uploadingFile} />

        {isLoading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12"><FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" /><h3 className="text-lg font-medium">Aucun document</h3><p>Uploadez votre premier document pour commencer.</p></div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
            {/* Documents Table would be rendered here */}
          </div>
        )}
      </div>

      {showConfirmModal && (
        <ConfirmationModal 
          isOpen={!!showConfirmModal}
          onClose={() => setShowConfirmModal(null)}
          onConfirm={showConfirmModal.action}
          title={showConfirmModal.title}
          message={showConfirmModal.message}
          confirmText="Lancer"
          cancelText="Annuler"
        />
      )}
    </div>
  );
}

function UploadButton({ onFileSelect, isUploading }: { onFileSelect: (file: File) => void; isUploading: boolean; }) {
  const { isDarkMode } = useTheme();
  const inputId = `file-upload-${Date.now()}`;
  
  return (
    <div>
      <input id={inputId} type="file" accept=".pdf" onChange={(e) => e.target.files && onFileSelect(e.target.files[0])} disabled={isUploading} className="hidden" />
      <label htmlFor={inputId} className={`inline-flex items-center px-6 py-3 rounded-lg font-medium cursor-pointer ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
        {isUploading ? <Brain className="w-4 h-4 mr-2 animate-pulse" /> : <Upload className="w-4 h-4 mr-2" />} 
        {isUploading ? 'Traitement IA...' : 'Uploader une facture'}
      </label>
    </div>
  );
}
