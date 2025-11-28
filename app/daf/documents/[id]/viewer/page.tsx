'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Import DAFDocumentViewer with SSR disabled to avoid DOMMatrix errors
const DAFDocumentViewer = dynamic(
  () => import('@/components/daf/DAFDocumentViewer').then(mod => ({ default: mod.DAFDocumentViewer })),
  { ssr: false }
);

interface DocumentData {
  id: string;
  file_name: string;
  file_url: string;
  extraction_result: any;
  created_at: string;
}

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      const response = await fetch(`/api/daf/documents/${documentId}`);
      if (!response.ok) throw new Error('Failed to load document');

      const data = await response.json();
      console.log('[Viewer] Document loaded:', data);
      console.log('[Viewer] Extraction result:', data.extraction_result);
      console.log('[Viewer] Field positions:', data.extraction_result?.field_positions);

      // Debug: Log sample positions
      if (data.extraction_result?.field_positions?.length > 0) {
        console.log('[Viewer] Sample positions (first 3):',
          data.extraction_result.field_positions.slice(0, 3)
        );
      }

      setDocument(data);
    } catch (error) {
      console.error('Error loading document:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Document introuvable</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <DAFDocumentViewer
      pdfUrl={document.file_url}
      document={document}
      extractionResult={document.extraction_result}
    />
  );
}
