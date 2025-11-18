'use client';

import { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadResult {
  fileName: string;
  success: boolean;
  docType?: string;
  fournisseur?: string;
  error?: string;
}

interface DocumentUploadProps {
  orgId: string;
  onUploadComplete?: () => void;
}

export function DocumentUpload({ orgId, onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setResults([]);

    const formData = new FormData();
    formData.append('orgId', orgId);
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/daf/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const uploadResults: UploadResult[] = [];

        // Success
        data.data.documents?.forEach((doc: any) => {
          uploadResults.push({
            fileName: doc.file_name,
            success: true,
            docType: doc.doc_type,
            fournisseur: doc.fournisseur,
          });
        });

        // Errors
        data.data.errors?.forEach((err: any) => {
          uploadResults.push({
            fileName: err.fileName,
            success: false,
            error: err.error,
          });
        });

        setResults(uploadResults);
        setSelectedFiles([]);

        if (onUploadComplete) {
          setTimeout(onUploadComplete, 1000);
        }
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erreur lors de l\'upload. Veuillez réessayer.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Drop zone with glassmorphism */}
      <div
        className={`group relative overflow-hidden border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          dragActive
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 scale-[1.02]'
            : 'border-slate-300 bg-white/60 backdrop-blur-sm hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-cyan-50/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        <div className="relative">
          {/* Icon with pulse effect */}
          <div className="relative inline-block mb-6">
            <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 blur-2xl opacity-30 ${
              dragActive ? 'animate-pulse' : ''
            }`}></div>
            <div className="relative bg-gradient-to-br from-blue-500 to-cyan-600 p-4 rounded-2xl shadow-lg">
              <Upload className={`h-12 w-12 text-white transition-transform duration-300 ${
                dragActive ? 'scale-110' : 'group-hover:scale-105'
              }`} />
            </div>
          </div>

          <p className="text-xl font-bold text-slate-900 mb-2">
            Glissez-déposez vos documents ici
          </p>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
            PDF, images (JPEG, PNG, TIFF), Word • Max 10 MB par fichier • Classification IA instantanée
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group/btn relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-cyan-700 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
            <Upload className="h-4 w-4 relative z-10" />
            <span className="relative z-10">Parcourir les fichiers</span>
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.doc,.docx"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Premium Selected files */}
      {selectedFiles.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <File className="h-5 w-5 text-blue-600" />
            Fichiers sélectionnés ({selectedFiles.length})
          </h3>
          <div className="space-y-2 mb-6">
            {selectedFiles.map((file, index) => (
              <div key={index} className="group flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 p-3 rounded-xl border border-slate-200/50 hover:border-blue-300 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <File className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-900 block">{file.name}</span>
                    <span className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="group/upload relative w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-emerald-700 rounded-xl opacity-0 group-hover/upload:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10">
              {uploading ? 'Upload en cours...' : `Uploader ${selectedFiles.length} fichier(s)`}
            </span>
          </button>
        </div>
      )}

      {/* Premium Upload results */}
      {results.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg text-slate-900 mb-4">Résultats de l'upload</h3>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 ${
                  result.success
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300'
                    : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 hover:border-red-300'
                }`}
              >
                {result.success ? (
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  </div>
                ) : (
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 mb-1">{result.fileName}</p>
                  {result.success && (
                    <p className="text-xs text-slate-600">
                      Type: <span className="font-bold text-green-700">{result.docType}</span>
                      {result.fournisseur && (
                        <span className="ml-2">
                          • Fournisseur: <span className="font-bold text-blue-700">{result.fournisseur}</span>
                        </span>
                      )}
                    </p>
                  )}
                  {!result.success && (
                    <p className="text-xs text-red-600 font-medium">{result.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
