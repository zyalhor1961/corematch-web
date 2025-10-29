'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Users, Eye, X, Brain, Loader, Table } from 'lucide-react';
import PDFViewerModal from './PDFViewerModal';
import AnalysisModal from './AnalysisModal';
import CandidatesSheetView from './CandidatesSheetView';

interface Candidate {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  status: string;
  score?: number;
  cv_filename?: string;
  cv_url?: string;
  cv_path?: string;
  notes?: string;
  created_at: string;
}

interface CandidatesListModalProps {
  projectId: string;
  onClose: () => void;
}

export default function CandidatesListModal({ projectId, onClose }: CandidatesListModalProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [analyzingCandidates, setAnalyzingCandidates] = useState<Set<string>>(new Set());
  const [showSheetView, setShowSheetView] = useState(false);
  const [projectName, setProjectName] = useState<string>('');
  const [showPDFViewer, setShowPDFViewer] = useState<{
    url: string;
    fileName: string;
    candidateName: string;
  } | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<{
    candidateName: string;
    analysis: any;
  } | null>(null);

  useEffect(() => {
    loadCandidates();
  }, [projectId]);

  const analyzeCandidate = async (candidateId: string, candidateName: string) => {
    setAnalyzingCandidates(prev => new Set([...prev, candidateId]));

    try {
      const response = await fetch(`/api/cv/projects/${projectId}/candidates/${candidateId}/analyze`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Show detailed analysis in modal
        setShowAnalysis({
          candidateName,
          analysis: data.data.analysis
        });
        // Refresh the candidates list
        loadCandidates();
      } else {
        console.error('Analysis error:', data.error);
      }
    } catch (error) {
      console.error('Error analyzing candidate:', error);
    } finally {
      setAnalyzingCandidates(prev => {
        const newSet = new Set(prev);
        newSet.delete(candidateId);
        return newSet;
      });
    }
  };

  const deleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le CV de ${candidateName} ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/cv/projects/${projectId}/candidates/${candidateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Suppression réussie - rafraîchir silencieusement
        loadCandidates();
      } else {
        console.error('Delete error:', data.error);
      }
    } catch (error) {
      console.error('Error deleting candidate:', error);
    }
  };

  const loadCandidates = async () => {
    try {
      console.log('Loading candidates for project:', projectId);
      const response = await fetch(`/api/cv/projects/${projectId}/candidates`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('Candidates API response:', data);
      
      if (data.success) {
        setCandidates(data.data);
        console.log('Candidates loaded:', data.data.length, 'items');
      } else {
        console.error('API returned error:', data.error);
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const viewAnalysis = (candidate: Candidate) => {
    // Extract analysis from notes
    const notes = candidate.notes || '';
    const scoreMatch = notes.match(/Score: (\d+)\/100/);
    const recommendationMatch = notes.match(/Recommandation: ([^\\n]+)/);
    const summaryMatch = notes.match(/Résumé: ([^\\n]+)/);
    
    if (scoreMatch) {
      setShowAnalysis({
        candidateName: getDisplayName(candidate),
        analysis: {
          score: parseInt(scoreMatch[1]),
          recommendation: recommendationMatch?.[1] || "À considérer",
          summary: summaryMatch?.[1] || "Analyse disponible dans les détails du candidat",
          strengths: ["Analyse détaillée disponible"],
          weaknesses: ["Voir les notes complètes pour plus de détails"]
        }
      });
    }
  };

  const viewCV = async (candidate: Candidate) => {
    // Extract filename and path from notes - IMPORTANT: Stop at first newline to avoid analysis text
    const filename = candidate.notes?.match(/CV file: ([^|\n]+)/)?.[1] ||
                    candidate.cv_filename ||
                    `${candidate.first_name || candidate.name || 'candidat'}.pdf`;

    // Use cv_path column (fallback to regex for old records)
    const filePath = candidate.cv_path || candidate.notes?.match(/Path: ([^|\n]+)/)?.[1]?.trim();

    console.log('Tentative d\'ouverture CV:', {
      candidateId: candidate.id,
      filename,
      filePath,
      notes: candidate.notes
    });

    if (filePath) {
      try {
        // Get Supabase URL from environment or use the current one
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://glexllbywdvlxpbanjmn.supabase.co';

        // Try both public and signed URL approaches
        let downloadUrl = `${supabaseUrl}/storage/v1/object/public/cv/${filePath}`;

        console.log('URL du PDF construite:', downloadUrl);

        // Test if file exists
        try {
          const response = await fetch(downloadUrl, { method: 'HEAD' });
          if (!response.ok) {
            console.warn('Fichier non accessible en public, tentative avec URL signée...');

            // Try to get a signed URL from Supabase
            const { supabase } = await import('@/lib/supabase/client');
            const { data: signedData, error: signedError } = await supabase.storage
              .from('cv')
              .createSignedUrl(filePath, 3600); // 1 hour expiry

            if (signedError) {
              throw new Error(`Erreur URL signée: ${signedError.message}`);
            }

            if (signedData?.signedUrl) {
              downloadUrl = signedData.signedUrl;
              console.log('URL signée générée:', downloadUrl);
            } else {
              throw new Error('Impossible de générer une URL signée');
            }
          }
        } catch (urlError) {
          console.error('Erreur lors de la vérification de l\'URL:', urlError);
          // Continue with the original URL, let the PDF viewer handle the error
        }

        // Open PDF in integrated viewer
        setShowPDFViewer({
          url: downloadUrl,
          fileName: filename,
          candidateName: getDisplayName(candidate)
        });

      } catch (error) {
        console.error('Erreur lors de l\'ouverture du CV:', error);
        alert(`Erreur lors de l'ouverture du CV: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    } else {
      // Fallback: show file info
      console.warn('Aucun chemin de fichier trouvé pour le candidat:', candidate);
      alert(`CV: ${filename}\nStatus: ${candidate.status}\nTéléversé le: ${new Date(candidate.created_at).toLocaleString('fr-FR')}\n\nLe fichier PDF n'est pas encore disponible pour visualisation.`);
    }
  };

  const getDisplayName = (candidate: Candidate) => {
    if (candidate.name) return candidate.name;
    if (candidate.first_name && candidate.last_name) {
      return `${candidate.first_name} ${candidate.last_name}`;
    }
    if (candidate.first_name) return candidate.first_name;
    
    // Extract from filename in notes - stop at newline to avoid analysis text
    const filename = candidate.notes?.match(/CV file: ([^|\n]+)/)?.[1];
    if (filename) {
      return filename.replace(/\.[^/.]+$/, ""); // Remove extension
    }
    
    return 'Candidat sans nom';
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">CV téléversés</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSheetView(true)}
              className="flex items-center space-x-2"
            >
              <Table className="w-4 h-4" />
              <span>Vue tableur</span>
            </Button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun CV téléversé pour ce projet</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[60vh]">
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <div 
                  key={candidate.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {getDisplayName(candidate)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {candidate.email && <span>{candidate.email} • </span>}
                      Téléversé le {new Date(candidate.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    {candidate.status === 'analyzed' && candidate.notes?.includes('Score:') && (
                      <div 
                        className="text-sm text-blue-600 cursor-pointer hover:underline"
                        onClick={() => viewAnalysis(candidate)}
                        title="Cliquer pour voir l'analyse détaillée"
                      >
                        {candidate.notes.match(/Score: (\d+)\/100/)?.[0] || 'Score analysé'} - Voir détails
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      candidate.status === 'analyzed' ? 'bg-green-100 text-green-800' :
                      candidate.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {candidate.status === 'analyzed' ? 'Analysé' :
                       candidate.status === 'processing' ? 'En cours' : 'En attente'}
                    </span>
                    <button
                      onClick={() => viewCV(candidate)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Voir le CV"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {candidate.status === 'pending' && (
                      <button
                        onClick={() => analyzeCandidate(candidate.id, getDisplayName(candidate))}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Analyser avec IA"
                        disabled={analyzingCandidates.has(candidate.id)}
                      >
                        {analyzingCandidates.has(candidate.id) ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => deleteCandidate(candidate.id, getDisplayName(candidate))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Supprimer le CV"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {showPDFViewer && (
        <PDFViewerModal
          pdfUrl={showPDFViewer.url}
          fileName={showPDFViewer.fileName}
          candidateName={showPDFViewer.candidateName}
          onClose={() => setShowPDFViewer(null)}
        />
      )}

      {/* Analysis Modal */}
      {showAnalysis && (
        <AnalysisModal
          candidateName={showAnalysis.candidateName}
          analysis={showAnalysis.analysis}
          onClose={() => setShowAnalysis(null)}
        />
      )}

      {/* Sheet View Modal */}
      {showSheetView && (
        <CandidatesSheetView
          candidates={candidates}
          projectName={projectName}
          onViewCandidate={(candidate) => {
            const analysis = extractAnalysisFromNotes(candidate.notes || '');
            if (analysis.score !== undefined) {
              setShowAnalysis({
                candidateName: getDisplayName(candidate),
                analysis: analysis
              });
            }
          }}
          onClose={() => setShowSheetView(false)}
        />
      )}
    </div>
  );
}