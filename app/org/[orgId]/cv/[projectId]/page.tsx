'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import {
  ArrowLeft,
  Upload,
  Users,
  Brain,
  Star,
  FileText,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle,
  Clock,
  User,
  Loader2
} from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cv_filename: string;
  cv_url: string;
  score?: number;
  explanation?: string;
  shortlisted: boolean;
  status: 'pending' | 'processing' | 'analyzed' | 'rejected';
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  job_title?: string;
  description?: string;
  requirements?: string;
}

export default function ProjectCandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  
  const [project, setProject] = useState<Project | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeSuccess, setAnalyzeSuccess] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    emoji: string;
    title: string;
    description: string;
    timeEstimate: string;
    pendingCount: number;
  } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orgId = params?.orgId as string;
  const projectId = params?.projectId as string;

  const loadProject = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour voir le projet.");
      }
      
      const response = await fetch(`/api/admin/get-project?projectId=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error("Erreur lors du chargement du projet.");
      }
      
      const data = await response.json();
      setProject(data.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading project:', err);
    }
  }, [projectId]);

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour voir les candidats.");
      }
      
      const response = await fetch(`/api/admin/list-candidates?projectId=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Le chargement des candidats a échoué.");
      }
      
      const data = await response.json();
      if (data.success) {
        setCandidates(data.data);
      } else {
        throw new Error(data.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading candidates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadCandidates();
    }
  }, [projectId, loadProject, loadCandidates]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'analyzed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'processing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le CV de ${candidateName} ? Cette action est irréversible.`)) {
      return;
    }

    setDeletingId(candidateId);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour supprimer un candidat.");
      }

      const response = await fetch(`/api/cv/projects/${projectId}/candidates/${candidateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "La suppression a échoué.");
      }

      const data = await response.json();
      if (data.success) {
        // Remove candidate from local state
        setCandidates(prev => prev.filter(c => c.id !== candidateId));
      } else {
        throw new Error(data.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error deleting candidate:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour télécharger des CVs.");
      }

      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`/api/cv/projects/${projectId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Le téléchargement a échoué.");
      }

      const data = await response.json();
      if (data.success) {
        const summary = data.data.summary;
        setUploadSuccess(
          `${summary.uploaded} CV(s) téléchargé(s) avec succès` +
          (summary.failed > 0 ? ` (${summary.failed} échec(s))` : '')
        );

        // Reload candidates list
        await loadCandidates();

        // Clear success message after 5 seconds
        setTimeout(() => setUploadSuccess(null), 5000);
      } else {
        throw new Error(data.message || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error uploading CVs:', err);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAnalyzeAll = () => {
    const pendingCount = candidates.filter(c => c.status === 'pending').length;

    if (pendingCount === 0) {
      setError("✨ Aucun CV en attente d'analyse. Tous les CVs ont déjà été analysés !");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Messages créatifs selon le nombre de CVs
    let modalData;
    if (pendingCount === 1) {
      modalData = {
        emoji: '🚀',
        title: 'Prêt à découvrir le potentiel de ce candidat ?',
        description: "L'IA va analyser en profondeur ce CV et vous donner son avis d'expert.",
        timeEstimate: '~30 secondes',
        pendingCount
      };
    } else if (pendingCount <= 5) {
      modalData = {
        emoji: '🎯',
        title: `${pendingCount} CVs à analyser !`,
        description: "Notre IA va passer au crible chaque profil pour identifier les meilleurs talents.",
        timeEstimate: `~${pendingCount * 30} secondes`,
        pendingCount
      };
    } else if (pendingCount <= 10) {
      const minutes = Math.ceil(pendingCount * 30 / 60);
      modalData = {
        emoji: '🔥',
        title: `Wow ! ${pendingCount} candidats attendent d'être analysés !`,
        description: "L'IA va travailler dur pour scorer et classer tous ces profils. Préparez-vous à découvrir des pépites !",
        timeEstimate: `~${minutes} minute${minutes > 1 ? 's' : ''}`,
        pendingCount
      };
    } else {
      modalData = {
        emoji: '💎',
        title: `Analyse massive en vue : ${pendingCount} CVs !`,
        description: "Notre IA va déployer toute sa puissance pour analyser cette montagne de talents. Installez-vous confortablement, ça va chauffer !",
        timeEstimate: `~${Math.ceil(pendingCount * 30 / 60)} minutes`,
        pendingCount
      };
    }

    setConfirmModalData(modalData);
    setShowConfirmModal(true);
  };

  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowDetailsModal(true);
  };

  const proceedWithAnalysis = async () => {
    setShowConfirmModal(false);
    setIsAnalyzing(true);
    setError(null);
    setAnalyzeSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour analyser les CVs.");
      }

      const response = await fetch(`/api/cv/projects/${projectId}/analyze-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "L'analyse a échoué.");
      }

      const data = await response.json();
      if (data.success) {
        const { analyzed, failed, shortlisted } = data.data;
        setAnalyzeSuccess(
          `Analyse terminée ! ${analyzed} CV(s) analysé(s), ${shortlisted} shortlisté(s)` +
          (failed > 0 ? `, ${failed} échec(s)` : '')
        );

        // Reload candidates list to show new analysis results
        await loadCandidates();

        // Clear success message after 8 seconds
        setTimeout(() => setAnalyzeSuccess(null), 8000);
      } else {
        throw new Error(data.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error analyzing CVs:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header avec navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href={`/org/${orgId}/cv`}
              className={`flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux projets
            </Link>
            <div>
              <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {project?.name || 'Candidats du projet'}
              </h1>
              {project?.job_title && (
                <p className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'} text-sm`}>
                  {project.job_title}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Télécharger CVs
                </>
              )}
            </Button>
            <Button
              onClick={handleAnalyzeAll}
              disabled={isAnalyzing || candidates.filter(c => c.status === 'pending').length === 0}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analyser tout
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className={`border rounded-md p-4 flex items-center justify-between ${isDarkMode ? 'bg-red-900/20 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-3" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-red-900/50' : 'hover:bg-red-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div className={`border rounded-md p-4 flex items-center justify-between ${isDarkMode ? 'bg-green-900/20 border-green-500/30 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-3" />
              <span>{uploadSuccess}</span>
            </div>
            <button onClick={() => setUploadSuccess(null)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-green-900/50' : 'hover:bg-green-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {analyzeSuccess && (
          <div className={`border rounded-md p-4 flex items-center justify-between ${isDarkMode ? 'bg-blue-900/20 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-3" />
              <span>{analyzeSuccess}</span>
            </div>
            <button onClick={() => setAnalyzeSuccess(null)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-blue-900/50' : 'hover:bg-blue-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal de détails du candidat */}
        {showDetailsModal && selectedCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`relative w-full max-w-2xl rounded-xl shadow-2xl border animate-in zoom-in-95 duration-200 ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              {/* Header */}
              <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      selectedCandidate.shortlisted ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {selectedCandidate.shortlisted ? (
                        <Star className="w-8 h-8 text-yellow-600" />
                      ) : (
                        <User className="w-8 h-8 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedCandidate.name}
                      </h3>
                      {selectedCandidate.email && (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {selectedCandidate.email}
                        </p>
                      )}
                      {selectedCandidate.phone && (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {selectedCandidate.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Statut et Score */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Statut</p>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedCandidate.status)}`}>
                      {selectedCandidate.status === 'analyzed' && 'Analysé'}
                      {selectedCandidate.status === 'processing' && 'En cours'}
                      {selectedCandidate.status === 'pending' && 'En attente'}
                      {selectedCandidate.status === 'rejected' && 'Rejeté'}
                    </span>
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Score IA</p>
                    {selectedCandidate.score !== null && selectedCandidate.score !== undefined ? (
                      <span className={`text-3xl font-bold ${getScoreColor(selectedCandidate.score)}`}>
                        {selectedCandidate.score}%
                      </span>
                    ) : (
                      <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Pas encore analysé
                      </span>
                    )}
                  </div>
                </div>

                {/* CV File */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fichier CV</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedCandidate.cv_filename}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedCandidate.cv_url, '_blank')}
                      disabled={!selectedCandidate.cv_url}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </div>

                {/* Explication de l'analyse */}
                {selectedCandidate.explanation && (
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <p className={`text-sm mb-2 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Analyse IA
                    </p>
                    <p className={`text-sm whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {selectedCandidate.explanation}
                    </p>
                  </div>
                )}

                {/* Si pas d'analyse */}
                {!selectedCandidate.explanation && selectedCandidate.status === 'pending' && (
                  <div className={`p-4 rounded-lg border-2 border-dashed ${
                    isDarkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-300 bg-gray-50'
                  }`}>
                    <div className="text-center py-4">
                      <Brain className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Ce CV n'a pas encore été analysé par l'IA.
                      </p>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        Cliquez sur "Analyser tout" pour lancer l'analyse.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <Button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmation d'analyse */}
        {showConfirmModal && confirmModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`relative w-full max-w-md rounded-xl shadow-2xl border animate-in zoom-in-95 duration-200 ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              {/* Header avec emoji */}
              <div className={`p-6 pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-start space-x-4">
                  <div className="text-5xl">{confirmModalData.emoji}</div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {confirmModalData.title}
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {confirmModalData.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Détails */}
              <div className="p-6 space-y-4">
                <div className={`flex items-center justify-between p-4 rounded-lg ${
                  isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Clock className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Temps estimé
                    </span>
                  </div>
                  <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {confirmModalData.timeEstimate}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-lg ${
                  isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center space-x-2">
                    <FileText className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                    <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      CVs à analyser
                    </span>
                  </div>
                  <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    {confirmModalData.pendingCount}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className={`p-6 pt-0 flex space-x-3`}>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={proceedWithAnalysis}
                  className={`flex-1 ${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Lancer l&apos;analyse
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total candidats</p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{candidates.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Analysés</p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {candidates.filter(c => c.status === 'analyzed').length}
                </p>
              </div>
              <Brain className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Shortlistés</p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {candidates.filter(c => c.shortlisted).length}
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>En attente</p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {candidates.filter(c => c.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Liste des candidats */}
        {candidates.length === 0 ? (
          <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Aucun candidat</h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">Téléchargez des CVs pour commencer l'analyse.</p>
            <Button onClick={handleUploadClick} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Télécharger CVs
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className={`text-left px-6 py-4 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      Candidat
                    </th>
                    <th className={`text-left px-6 py-4 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      CV
                    </th>
                    <th className={`text-left px-6 py-4 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      Score
                    </th>
                    <th className={`text-left px-6 py-4 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      Statut
                    </th>
                    <th className={`text-left px-6 py-4 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${candidate.shortlisted ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            {candidate.shortlisted ? (
                              <Star className="w-5 h-5 text-yellow-600" />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {candidate.name}
                            </p>
                            {candidate.email && (
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {candidate.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {candidate.cv_filename}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {candidate.score !== null && candidate.score !== undefined ? (
                          <span className={`text-lg font-semibold ${getScoreColor(candidate.score)}`}>
                            {candidate.score}%
                          </span>
                        ) : (
                          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(candidate.status)}`}>
                          {candidate.status === 'analyzed' && 'Analysé'}
                          {candidate.status === 'processing' && 'En cours'}
                          {candidate.status === 'pending' && 'En attente'}
                          {candidate.status === 'rejected' && 'Rejeté'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewCandidate(candidate)}
                            className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                            title="Voir les détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                            title="Télécharger le CV"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                            disabled={deletingId === candidate.id}
                            className={`p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                            title="Supprimer le CV"
                          >
                            {deletingId === candidate.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}