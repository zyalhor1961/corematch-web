'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, ExternalLink, Download, FileText, AlertCircle } from 'lucide-react';

interface PDFViewerModalProps {
  pdfUrl: string;
  fileName: string;
  candidateName: string;
  onClose: () => void;
}

export default function PDFViewerModal({ pdfUrl, fileName, candidateName, onClose }: PDFViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [pdfExists, setPdfExists] = useState(true);
  const [showDemoCV, setShowDemoCV] = useState(false);

  useEffect(() => {
    // Check if PDF exists
    fetch(pdfUrl, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          setPdfExists(false);
          setShowDemoCV(true);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setPdfExists(false);
        setShowDemoCV(true);
        setIsLoading(false);
      });
  }, [pdfUrl]);

  const handleOpenInNewTab = () => {
    window.open(pdfUrl, '_blank');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">CV - {candidateName}</h3>
            <p className="text-sm text-gray-500">{fileName}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Nouvel onglet</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Vérification du CV...</p>
              </div>
            </div>
          )}
          
          {!isLoading && !pdfExists && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center p-8 max-w-md">
                <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">CV de démonstration</h3>
                <p className="text-gray-600 mb-6">
                  Ce candidat fait partie des données de test. Le CV réel n'est pas disponible.
                </p>
                <div className="bg-white rounded-lg border p-6 text-left shadow-sm">
                  <div className="border-b pb-4 mb-4">
                    <h4 className="text-xl font-bold text-gray-900">{candidateName}</h4>
                    <p className="text-gray-600">Candidat de démonstration</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-1">📧 Contact</h5>
                      <p className="text-sm text-gray-600">Email: demo@example.com</p>
                      <p className="text-sm text-gray-600">Téléphone: +33 6 00 00 00 00</p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-1">🎯 Profil</h5>
                      <p className="text-sm text-gray-600">
                        Candidat de test généré automatiquement pour la démonstration des fonctionnalités 
                        de la plateforme CoreMatch.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-1">💼 Expérience</h5>
                      <p className="text-sm text-gray-600">
                        Les données d'analyse IA sont disponibles dans les détails du candidat.
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 mt-4">
                  💡 Uploadez de vrais CV pour voir l'aperçu PDF complet
                </p>
              </div>
            </div>
          )}
          
          {!isLoading && pdfExists && (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`CV ${candidateName}`}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setPdfExists(false);
                setShowDemoCV(true);
                console.error('Erreur de chargement du PDF');
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}