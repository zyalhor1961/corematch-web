'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Project } from '@/lib/types';
import { useTheme } from '@/app/components/ThemeProvider';
import CandidatesListModal from '@/app/components/cv/CandidatesListModal';
import JobOfferEditor from '@/app/components/cv/JobOfferEditor';
import CandidatesSheetView from '@/app/components/cv/CandidatesSheetView';
import PDFViewerModal from '@/app/components/cv/PDFViewerModal';
import AnalysisModal from '@/app/components/cv/AnalysisModal';
import { 
  Plus, 
  Upload, 
  Users, 
  TrendingUp, 
  Play,
  MoreHorizontal,
  Trash2,
  Eye,
  ExternalLink,
  Brain,
  Star,
  Edit,
  Table,
  Grid3x3,
  List
} from 'lucide-react';

export default function CVScreeningPage() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Project | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [showCandidatesModal, setShowCandidatesModal] = useState<string | null>(null);
  const [showSheetView, setShowSheetView] = useState<{projectId: string, projectName: string} | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [showPDFViewer, setShowPDFViewer] = useState<{
    url: string;
    fileName: string;
    candidateName: string;
  } | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<{
    candidateName: string;
    analysis: any;
  } | null>(null);
  const [showShortlistModal, setShowShortlistModal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');
  
  const orgId = params?.orgId as string;

  useEffect(() => {
    if (orgId) {
      loadProjects();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    try {
      const response = await fetch(`/api/cv/projects?orgId=${orgId}`);
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;
    
    try {
      const response = await fetch(`/api/cv/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadProjects();
      } else {
        alert('Erreur lors de la suppression du projet');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Erreur lors de la suppression du projet');
    }
  };

  const analyzeAllCandidates = async (projectId: string) => {
    if (!confirm('Lancer l\'analyse IA pour tous les CV de ce projet ?')) return;

    try {
      const response = await fetch(`/api/cv/projects/${projectId}/analyze-all`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Rafraîchir silencieusement après analyse
        loadProjects();
        // Message seulement si échecs
        if (data.data.failed > 0) {
          alert(`Analyse terminée: ${data.data.analyzed} réussis, ${data.data.failed} échoués`);
        }
      } else {
        alert('❌ Erreur lors de l\'analyse en lot');
      }
    } catch (error) {
      console.error('Error analyzing all candidates:', error);
      alert('❌ Erreur lors de l\'analyse en lot');
    }
  };


  const createShortlist = async (projectId: string, maxCandidates: number) => {
    try {
      const response = await fetch(`/api/cv/projects/${projectId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxCandidates: maxCandidates })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Shortlist créée: ${data.data.shortlisted} candidats sélectionnés sur ${data.data.shortlisted + data.data.rejected} analysés`);
        loadProjects();
      } else {
        alert('❌ Erreur lors de la création de la shortlist');
      }
    } catch (error) {
      console.error('Error creating shortlist:', error);
      alert('❌ Erreur lors de la création de la shortlist');
    }
  };


  const openSheetView = async (projectId: string, projectName: string) => {
    try {
      // Load candidates for the sheet view
      const response = await fetch(`/api/cv/projects/${projectId}/candidates`);
      const data = await response.json();
      
      if (data.success) {
        setCandidates(data.data || []);
        setShowSheetView({ projectId, projectName });
      } else {
        alert('❌ Erreur lors du chargement des candidats');
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
      alert('❌ Erreur lors du chargement des candidats');
    }
  };

  const extractAnalysisFromNotes = (notes: string) => {
    const scoreMatch = notes.match(/Score: (\d+)\/100/);
    const recommendationMatch = notes.match(/Recommandation: ([^\n]+)/);
    const summaryMatch = notes.match(/Résumé: ([^\n]+)/);
    
    return {
      score: scoreMatch ? parseInt(scoreMatch[1]) : undefined,
      recommendation: recommendationMatch?.[1] || '',
      summary: summaryMatch?.[1] || '',
      strengths: ["Analyse détaillée disponible"],
      weaknesses: ["Voir les notes complètes pour plus de détails"]
    };
  };

  const getDisplayName = (candidate: any) => {
    if (candidate.name) return candidate.name;
    if (candidate.first_name && candidate.last_name) {
      return `${candidate.first_name} ${candidate.last_name}`;
    }
    if (candidate.first_name) return candidate.first_name;
    
    // Extract from filename in notes
    const filename = candidate.notes?.match(/CV file: ([^|\n]+)/)?.[1];
    if (filename) {
      return filename.replace(/\.[^/.]+$/, ""); // Remove extension
    }
    
    return 'Candidat sans nom';
  };

  const viewCandidateFromSheet = (candidate: any) => {
    // Check if we should show analysis or PDF
    const analysis = extractAnalysisFromNotes(candidate.notes || '');
    
    if (analysis.score !== undefined) {
      // Show analysis modal
      setShowAnalysis({
        candidateName: getDisplayName(candidate),
        analysis: analysis
      });
    } else {
      // Show PDF if available
      const filename = candidate.notes?.match(/CV file: ([^|\n]+)/)?.[1] || 
                     `${candidate.first_name || 'candidat'}.pdf`;
      const pathMatch = candidate.notes?.match(/Path: ([^|\n]+)/);
      const filePath = pathMatch?.[1]?.trim();
      
      if (filePath) {
        const supabaseUrl = 'https://glexllbywdvlxpbanjmn.supabase.co';
        const downloadUrl = `${supabaseUrl}/storage/v1/object/public/cv/${filePath}`;
        
        setShowPDFViewer({
          url: downloadUrl,
          fileName: filename,
          candidateName: getDisplayName(candidate)
        });
      }
    }
  };

  const getStatusBadge = (project: Project & { candidate_count?: number; analyzed_count?: number }) => {
    const totalCandidates = project.candidate_count || 0;
    const analyzed = project.analyzed_count || 0;
    
    if (totalCandidates === 0) {
      return <span className={`px-2 py-1 text-xs rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>Vide</span>;
    }
    
    if (analyzed === totalCandidates) {
      return <span className={`px-2 py-1 text-xs rounded-full ${isDarkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'}`}>Terminé</span>;
    }
    
    if (analyzed > 0) {
      return <span className={`px-2 py-1 text-xs rounded-full ${isDarkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>En cours</span>;
    }
    
    return <span className={`px-2 py-1 text-xs rounded-full ${isDarkMode ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-100 text-yellow-800'}`}>Nouveau</span>;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>CV Screening</h1>
          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Analysez et triez vos candidatures automatiquement</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className={`flex items-center border rounded-lg overflow-hidden ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-2 ${viewMode === 'gallery' 
                ? 'bg-slate-600 text-white' 
                : `${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`
              }`}
              title="Vue galerie"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' 
                ? 'bg-slate-600 text-white' 
                : `${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`
              }`}
              title="Vue liste"
            >
              <List className="w-4 h-4" />
            </button>
          </div>


          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau projet
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 rounded-lg shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center">
            <Users className="w-8 h-8 text-slate-600 mr-3" />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Projets actifs</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{projects.length}</p>
            </div>
          </div>
        </div>
        
        <div className={`p-6 rounded-lg shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center">
            <Upload className="w-8 h-8 text-emerald-600 mr-3" />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>CV ce mois</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {projects.reduce((sum, p) => sum + (p.candidate_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-lg shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-amber-600 mr-3" />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Score moyen</p>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>78</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className={`text-center py-12 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <Users className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Aucun projet CV
          </h3>
          <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Créez votre premier projet pour commencer à analyser des CV
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Créer un projet
          </Button>
        </div>
      ) : 
        viewMode === 'gallery' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className={`rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {project.name}
                      </h3>
                      {project.job_title && (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{project.job_title}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(project)}
                      <button 
                        onClick={() => setShowEditModal(project)}
                        className={`p-1 rounded text-blue-500 hover:text-blue-700 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-100'}`}
                        title="Modifier l'offre d'emploi"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteProject(project.id)}
                        className={`p-1 rounded text-red-500 hover:text-red-700 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-red-100'}`}
                        title="Supprimer le projet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div 
                      className={`flex justify-between text-sm cursor-pointer p-1 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                      onClick={() => setShowCandidatesModal(project.id)}
                      title="Cliquer pour voir les CV"
                    >
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>CV téléversés:</span>
                      <span className="font-medium text-slate-600">{project.candidate_count || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Analysés:</span>
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{project.analyzed_count || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Shortlistés:</span>
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{project.shortlisted_count || 0}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 mb-3">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setShowUploadModal(project.id)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload CV
                    </Button>
                    
                    
                    {(project.candidate_count || 0) > (project.analyzed_count || 0) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => analyzeAllCandidates(project.id)}
                        className="text-amber-600 hover:bg-amber-50"
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        Analyser tout
                      </Button>
                    )}
                    
                    {(project.analyzed_count || 0) > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowShortlistModal(project.id)}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Shortlist
                      </Button>
                    )}
                  </div>
                  
                  {(project.candidate_count || 0) > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openSheetView(project.id, project.name)}
                      className="w-full text-slate-600 hover:bg-slate-50"
                    >
                      <Table className="w-4 h-4 mr-2" />
                      Vue tableur & Export
                    </Button>
                  )}
                </div>

                <div className={`px-6 py-3 border-t ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Liste Vue - Format Table Compact */
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'bg-gray-750 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium">
                <div className="col-span-4">
                  <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Projet</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Statut</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>CV / Analysés</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Progrès</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actions</span>
                </div>
              </div>
            </div>
            
            {/* Rows */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {projects.map((project) => {
                const totalCandidates = project.candidate_count || 0;
                const analyzed = project.analyzed_count || 0;
                const shortlisted = project.shortlisted_count || 0;
                const progressPercentage = totalCandidates > 0 ? Math.round((analyzed / totalCandidates) * 100) : 0;
                
                return (
                  <div key={project.id} className={`px-6 py-4 hover:bg-opacity-50 transition-colors ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}>
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Projet Info */}
                      <div className="col-span-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                          }`}>
                            <Users className={`w-5 h-5 ${
                              isDarkMode ? 'text-slate-300' : 'text-slate-600'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className={`font-medium truncate ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {project.name}
                            </h3>
                            {project.job_title && (
                              <p className={`text-sm truncate ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {project.job_title}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Statut */}
                      <div className="col-span-2 text-center">
                        {getStatusBadge(project)}
                      </div>
                      
                      {/* Métriques */}
                      <div className="col-span-2 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center space-x-2">
                            <span className={`text-lg font-bold ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {totalCandidates}
                            </span>
                            <span className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>/</span>
                            <span className={`text-lg font-bold text-amber-600`}>
                              {analyzed}
                            </span>
                          </div>
                          {shortlisted > 0 && (
                            <div className="flex items-center justify-center">
                              <Star className="w-3 h-3 text-rose-500 mr-1" />
                              <span className={`text-xs ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {shortlisted} shortlistés
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Barre de progrès */}
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <div className={`w-full h-2 rounded-full ${
                            isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            <div 
                              className="h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                          <div className="text-center">
                            <span className={`text-xs font-medium ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {progressPercentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions rapides */}
                      <div className="col-span-2 flex justify-end space-x-2">
                        <button
                          onClick={() => setShowCandidatesModal(project.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDarkMode 
                              ? 'hover:bg-gray-700 text-gray-400 hover:text-slate-400' 
                              : 'hover:bg-slate-50 text-gray-500 hover:text-slate-600'
                          }`}
                          title="Voir les CV"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {(project.candidate_count || 0) > (project.analyzed_count || 0) && (
                          <button
                            onClick={() => analyzeAllCandidates(project.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode 
                                ? 'hover:bg-gray-700 text-gray-400 hover:text-amber-400' 
                                : 'hover:bg-amber-50 text-gray-500 hover:text-amber-600'
                            }`}
                            title="Analyser tout"
                          >
                            <Brain className="w-4 h-4" />
                          </button>
                        )}
                        
                        {(project.analyzed_count || 0) > 0 && (
                          <button
                            onClick={() => setShowShortlistModal(project.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode 
                                ? 'hover:bg-gray-700 text-gray-400 hover:text-rose-400' 
                                : 'hover:bg-rose-50 text-gray-500 hover:text-rose-600'
                            }`}
                            title="Créer shortlist"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => setShowEditModal(project)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDarkMode 
                              ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                          }`}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      }

      {/* Create Modal - Using JobOfferEditor */}
      {showCreateModal && (
        <JobOfferEditor 
          orgId={orgId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadProjects();
          }}
        />
      )}

      {/* Edit Modal - Using new JobOfferEditor */}
      {showEditModal && (
        <JobOfferEditor 
          orgId={orgId}
          project={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSuccess={() => {
            setShowEditModal(null);
            loadProjects();
          }}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadCVModal 
          projectId={showUploadModal}
          onClose={() => setShowUploadModal(null)}
          onSuccess={() => {
            setShowUploadModal(null);
            loadProjects();
          }}
        />
      )}

      {/* Candidates List Modal */}
      {showCandidatesModal && (
        <CandidatesListModal 
          projectId={showCandidatesModal}
          onClose={() => setShowCandidatesModal(null)}
        />
      )}

      {/* Sheet View Modal */}
      {showSheetView && (
        <CandidatesSheetView
          candidates={candidates}
          projectName={showSheetView.projectName}
          onViewCandidate={viewCandidateFromSheet}
          onClose={() => setShowSheetView(null)}
        />
      )}

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

      {/* Shortlist Modal */}
      {showShortlistModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 w-full max-w-md mx-4 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Créer une shortlist</h3>
              <button
                onClick={() => setShowShortlistModal(null)}
                className={`text-2xl ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ×
              </button>
            </div>
            
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Combien de candidats maximum voulez-vous dans la shortlist ?
              </label>
              <input
                type="number"
                min="1"
                max="20"
                defaultValue="5"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                id="shortlistCount"
              />
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                L'IA sélectionnera automatiquement les meilleurs candidats analysés
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowShortlistModal(null)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const input = document.getElementById('shortlistCount') as HTMLInputElement;
                  const maxCandidates = parseInt(input.value) || 5;
                  createShortlist(showShortlistModal, maxCandidates);
                  setShowShortlistModal(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Star className="w-4 h-4 mr-2" />
                Créer la shortlist
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function CreateProjectModal({ orgId, onClose, onSuccess }: {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    job_title: '',
    description: '',
    requirements: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/cv/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          orgId,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onSuccess();
      } else {
        alert('Erreur lors de la création du projet');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Erreur lors de la création du projet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Créer un projet CV</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du projet *
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre du poste
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exigences du poste
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: 5 ans d'expérience en React, maîtrise TypeScript..."
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name}
              className="flex-1"
            >
              {isLoading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UploadCVModal({ projectId, onClose, onSuccess }: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch(`/api/cv/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        // Succès silencieux - juste fermer le modal et rafraîchir
        if (data.data?.errors?.length > 0) {
          console.warn('Erreurs lors de l\'upload:', data.data.errors);
          alert(`Attention: ${data.data.errors.join(', ')}`);
        }
        onSuccess();
      } else {
        alert('Erreur lors du téléchargement des CV');
      }
    } catch (error) {
      console.error('Error uploading CVs:', error);
      alert('Erreur lors du téléchargement des CV');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Télécharger des CV</h3>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fichiers CV (PDF, DOC, DOCX)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {files && files.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {files.length} fichier(s) sélectionné(s)
              </p>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isUploading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isUploading || !files || files.length === 0}
              className="flex-1"
            >
              {isUploading ? 'Téléchargement...' : 'Télécharger'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}