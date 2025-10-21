'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Project } from '@/lib/types';
import { useTheme } from '@/app/components/ThemeProvider';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';
import { 
  Plus, 
  Upload, 
  Users, 
  TrendingUp, 
  MoreHorizontal,
  Trash2,
  Eye,
  Brain,
  Star,
  Edit,
  Table,
  Grid3x3,
  LayoutGrid,
  List,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  Zap,
  Target,
  Award,
  Briefcase,
  Calendar,
  FileText,
  UserCheck,
  TrendingDown,
  BarChart3,
  Timer,
  CheckSquare,
  XSquare,
  Sparkles,
  Rocket
} from 'lucide-react';

// Note: The modals that were previously defined in this file should be extracted to their own components.
// For this fix, I am keeping them here but have refactored their error handling.

export default function CVScreeningPage() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Project | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ action: () => void; title: string; message: string; } | null>(null);

  const [viewMode, setViewMode] = useState<'gallery' | 'list' | 'table'>(() => {
    // Restore view mode from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cv_viewMode');
      return (saved as 'gallery' | 'list' | 'table') || 'table';
    }
    return 'table';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'candidates'>('date');
  
  const orgId = params?.orgId as string;

  // Check if current user is master admin
  const isMasterAdmin = currentUser?.email === 'admin@corematch.test';

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour voir les projets.");
      }

      // Set current user for master admin check
      setCurrentUser(session.user);
      
      const response = await fetch(`/api/admin/list-projects?orgId=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Le chargement des projets a échoué.");
      }
      
      const data = await response.json();
      if (data.success) {
        setProjects(data.data);
      } else {
        throw new Error(data.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      loadProjects();
    }
  }, [orgId, loadProjects]);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cv_viewMode', viewMode);
    }
  }, [viewMode]);

  const handleDeleteProject = (projectId: string) => {
    setShowConfirmModal({
      action: async () => {
        setError(null);
        try {
          const response = await fetch(`/api/cv/projects/${projectId}`, { method: 'DELETE' });
          if (!response.ok) {
            const data = await response.json().catch(() => ({})); // Graceful error handling
            throw new Error(data.message || "Erreur lors de la suppression du projet.");
          }
          loadProjects();
        } catch (err: any) {
          setError(err.message);
        }
        setShowConfirmModal(null);
      },
      title: "Supprimer le projet",
      message: "Êtes-vous sûr de vouloir supprimer ce projet et tous les candidats associés ? Cette action est irréversible."
    });
  };

  const handleExport = () => {
    try {
      // Prepare CSV data
      const headers = ['Projet', 'Poste', 'Candidats', 'Analysés', 'Shortlistés', 'Taux de complétion', 'Date de création'];
      const csvRows = [headers.join(',')];

      projects.forEach(project => {
        const candidateCount = project.candidate_count || 0;
        const analyzedCount = project.analyzed_count || 0;
        const shortlistedCount = project.shortlisted_count || 0;
        const completionRate = candidateCount > 0 ? Math.round((analyzedCount / candidateCount) * 100) : 0;

        const row = [
          `"${project.name.replace(/"/g, '""')}"`,
          `"${(project.job_title || '-').replace(/"/g, '""')}"`,
          candidateCount,
          analyzedCount,
          shortlistedCount,
          `${completionRate}%`,
          new Date(project.created_at).toLocaleDateString('fr-FR')
        ];
        csvRows.push(row.join(','));
      });

      // Create and download CSV file
      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `projets_cv_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError('Erreur lors de l\'export: ' + err.message);
    }
  };

  // ... Other functions refactored to use the confirmation modal or setError

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="transition-colors duration-200">
      <div className="space-y-6 p-4 md:p-6">
        {/* Header moderne avec métriques rapides */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 md:p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-center lg:text-left">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
                🚀 CV Screening
                {isMasterAdmin && <span className="text-yellow-300 text-lg ml-2">👑 MASTER ADMIN</span>}
              </h1>
              <p className="text-blue-100 text-base md:text-lg lg:text-xl">
                {isMasterAdmin
                  ? "Mode administrateur - Vue globale de tous les projets"
                  : "Intelligence artificielle pour RH de haut niveau"
                }
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 lg:flex lg:items-center lg:space-x-6">
              {/* Métriques rapides */}
              <div className="text-center">
                <div className="text-xl md:text-2xl lg:text-3xl font-bold">{projects.length}</div>
                <div className="text-xs md:text-sm lg:text-base text-blue-100">Projets</div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl lg:text-3xl font-bold">
                  {projects.reduce((total, p) => total + (p.candidates_count || 0), 0)}
                </div>
                <div className="text-xs md:text-sm lg:text-base text-blue-100">Candidats</div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl lg:text-3xl font-bold text-green-300">
                  {projects.reduce((total, p) => total + (p.shortlisted_count || 0), 0)}
                </div>
                <div className="text-xs md:text-sm lg:text-base text-blue-100">Shortlistés</div>
              </div>
            </div>
          </div>
        </div>

        {/* Barre d'outils ultra-moderne pour RH pressés */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="space-y-4">
            {/* Ligne 1: Recherche */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Recherche instantanée */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  placeholder="Recherche instantanée..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                  }`}
                />
              </div>

              {/* Filtres rapides - cachés sur très petit écran */}
              <div className="flex items-center space-x-2 sm:min-w-0">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className={`px-3 sm:px-4 py-3 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  <option value="all">Tous</option>
                  <option value="active">Actifs</option>
                  <option value="completed">Terminés</option>
                </select>
              </div>
            </div>

            {/* Ligne 2: Vues et Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Sélecteur de vue */}
              <div className="flex items-center justify-center sm:justify-start border rounded-lg overflow-hidden border-gray-300 dark:border-gray-600">
                <button 
                  onClick={() => setViewMode('table')} 
                  className={`flex-1 sm:flex-none px-3 sm:px-2 py-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`} 
                  title="Mode Tableur RH"
                >
                  <Table className="w-4 h-4 mx-auto sm:mx-0" />
                  <span className="ml-2 sm:hidden text-sm">Tableur</span>
                </button>
                <button 
                  onClick={() => setViewMode('gallery')} 
                  className={`flex-1 sm:flex-none px-3 sm:px-2 py-2 ${viewMode === 'gallery' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`} 
                  title="Vue galerie"
                >
                  <Grid3x3 className="w-4 h-4 mx-auto sm:mx-0" />
                  <span className="ml-2 sm:hidden text-sm">Galerie</span>
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`flex-1 sm:flex-none px-3 sm:px-2 py-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`} 
                  title="Vue liste"
                >
                  <List className="w-4 h-4 mx-auto sm:mx-0" />
                  <span className="ml-2 sm:hidden text-sm">Liste</span>
                </button>
              </div>

              {/* Actions rapides */}
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                
                <Button 
                  onClick={() => setShowCreateModal(true)} 
                  className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Nouveau Projet</span>
                  <span className="sm:hidden">Nouveau</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="border rounded-md p-4 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300">
            <div className="flex items-center"><AlertTriangle className="w-5 h-5 mr-3" /><span>{error}</span></div>
            <button onClick={() => setError(null)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><X className="w-4 h-4" /></button>
          </div>
        )}

{(() => {
          // Logique de filtrage et tri intelligente
          let filteredProjects = projects.filter(project => {
            const matchesSearch = searchTerm === '' || 
              project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (project.job_title && project.job_title.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesFilter = filterStatus === 'all' || 
              (filterStatus === 'active' && (project.candidate_count || 0) > 0) ||
              (filterStatus === 'completed' && (project.analyzed_count || 0) === (project.candidate_count || 0) && (project.candidate_count || 0) > 0);
            
            return matchesSearch && matchesFilter;
          });

          // Tri intelligent
          filteredProjects.sort((a, b) => {
            switch(sortBy) {
              case 'name': return a.name.localeCompare(b.name);
              case 'candidates': return (b.candidate_count || 0) - (a.candidate_count || 0);
              case 'date': 
              default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
          });

          if (filteredProjects.length === 0 && !isLoading) {
            return (
              <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-medium mb-2 text-gray-900 dark:text-white">
                  {searchTerm || filterStatus !== 'all' ? 'Aucun résultat' : 'Prêt à impressionner ?'}
                </h3>
                <p className="mb-6 text-gray-700 dark:text-gray-400 max-w-md mx-auto">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Essayez de modifier vos critères de recherche ou filtres.'
                    : 'Créez votre premier projet et montrez à vos collègues la puissance de l\'IA pour le recrutement.'}
                </p>
                <Button 
                  onClick={() => setShowCreateModal(true)} 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Créer un projet révolutionnaire
                </Button>
              </div>
            );
          }

          // Mode Tableur RH Ultra-Moderne
          if (viewMode === 'table') {
            return (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Message mobile amélioré pour le mode tableur */}
                <div className="lg:hidden bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-blue-200 dark:border-blue-500/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-blue-700 dark:text-blue-300">
                      <Table className="w-5 h-5 mr-2" />
                      <div>
                        <div className="font-semibold text-sm">Mode Tableur 📊</div>
                        <div className="text-xs text-gray-700 dark:text-gray-400">Faites défiler horizontalement →</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewMode('gallery')}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Vue Mobile</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider w-1/4">
                          <button 
                            onClick={() => setSortBy('name')} 
                            className="flex items-center space-x-2 hover:text-blue-600"
                          >
                            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">PROJET</span>
                            <span className="sm:hidden">PROJ</span>
                            {sortBy === 'name' && <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </button>
                        </th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider w-1/6">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">POSTE</span>
                            <span className="sm:hidden">POS</span>
                          </div>
                        </th>
                        {isMasterAdmin && (
                          <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider w-1/6">
                            <div className="flex items-center space-x-1 sm:space-x-2">
                              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span className="hidden sm:inline">ORGANISATION</span>
                              <span className="sm:hidden">ORG</span>
                            </div>
                          </th>
                        )}
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider">
                          <button 
                            onClick={() => setSortBy('candidates')} 
                            className="flex items-center space-x-1 sm:space-x-2 hover:text-blue-600"
                          >
                            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">CANDIDATS</span>
                            <span className="sm:hidden">CAND</span>
                            {sortBy === 'candidates' && <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </button>
                        </th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">ANALYSE IA</span>
                            <span className="sm:hidden">IA</span>
                          </div>
                        </th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">SHORTLIST</span>
                            <span className="sm:hidden">⭐</span>
                          </div>
                        </th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider w-28">
                          <button
                            onClick={() => setSortBy('date')}
                            className="flex items-center space-x-1 sm:space-x-2 hover:text-blue-600"
                          >
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">DATE</span>
                            <span className="sm:hidden">📅</span>
                            {sortBy === 'date' && <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </button>
                        </th>
                        <th className="text-right px-3 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base tracking-wider w-40">
                          <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">ACTIONS</span>
                            <span className="sm:hidden">⚡</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredProjects.map((project) => {
                        const candidateCount = project.candidate_count || 0;
                        const analyzedCount = project.analyzed_count || 0;
                        const shortlistedCount = project.shortlisted_count || 0;
                        const completionRate = candidateCount > 0 ? (analyzedCount / candidateCount) * 100 : 0;
                        const shortlistRate = analyzedCount > 0 ? (shortlistedCount / analyzedCount) * 100 : 0;
                        
                        return (
                          <tr key={project.id} className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700">
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <Link href={`/org/${orgId}/cv/${project.id}`} className="block hover:bg-gray-50 dark:hover:bg-gray-700/30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-1 transition-colors cursor-pointer">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${candidateCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                  <div>
                                    <div className="font-semibold text-sm sm:text-lg text-blue-600 dark:text-blue-400 hover:underline">
                                      {project.name}
                                    </div>
                                    {project.description && (
                                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-[10rem] sm:max-w-sm overflow-hidden break-words">
                                        {project.description && project.description.length > 100
                                          ? `${project.description.substring(0, 100)}...`
                                          : project.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            </td>
                            
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              {project.job_title ? (
                                <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 truncate max-w-[6rem] sm:max-w-none">
                                  {project.job_title}
                                </span>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-400 text-xs sm:text-base">-</span>
                              )}
                            </td>

                            {isMasterAdmin && (
                              <td className="px-3 sm:px-6 py-3 sm:py-4">
                                <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 truncate max-w-[8rem] sm:max-w-none">
                                  {project.organization_name || 'Organisation inconnue'}
                                </span>
                              </td>
                            )}

                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="flex items-center space-x-1 sm:space-x-2">
                                <span className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                  {candidateCount}
                                </span>
                                {candidateCount > 0 && (
                                  <div className="flex flex-col">
                                    <span className="text-xs sm:text-sm text-green-600 dark:text-green-400">actifs</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-1 sm:space-x-2">
                                    <span className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">
                                      {analyzedCount}/{candidateCount}
                                    </span>
                                    {completionRate > 0 && (
                                      <span className={`text-xs px-1 sm:px-2 py-1 rounded-full ${
                                        completionRate === 100 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                          : completionRate >= 50 
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                      }`}>
                                        {Math.round(completionRate)}%
                                      </span>
                                    )}
                                  </div>
                                  {candidateCount > 0 && (
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 sm:h-2 mt-1">
                                      <div 
                                        className={`h-1 sm:h-2 rounded-full ${
                                          completionRate === 100 ? 'bg-green-500' :
                                          completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${completionRate}%` }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <div className="flex items-center space-x-1 sm:space-x-2">
                                <Star className={`w-3 h-3 sm:w-4 sm:h-4 ${shortlistedCount > 0 ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-300'}`} />
                                <span className="text-base sm:text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                  {shortlistedCount}
                                </span>
                                {shortlistRate > 0 && (
                                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                                    ({Math.round(shortlistRate)}%)
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-3 sm:px-6 py-3 sm:py-4 w-28">
                              <div className="flex items-center space-x-1 whitespace-nowrap">
                                <Calendar className="w-3 h-3 text-gray-500 dark:text-gray-400 hidden sm:inline flex-shrink-0" />
                                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(project.created_at).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 sm:px-6 py-3 sm:py-4 w-40">
                              <div className="flex items-center justify-end space-x-2 flex-nowrap">
                                <button
                                  onClick={() => setShowEditModal(project)}
                                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors whitespace-nowrap flex-shrink-0"
                                >
                                  <Edit className="w-4 h-4 mr-1.5" />
                                  <span>Modif</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap flex-shrink-0"
                                >
                                  <Trash2 className="w-4 h-4 mr-1.5" />
                                  <span>Suppr</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          // Mode Galerie amélioré et responsive
          return (
            <div className={`grid gap-4 md:gap-6 ${viewMode === 'gallery' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
              {filteredProjects.map((project) => (
                <div key={project.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl border p-4 md:p-6 hover:shadow-xl transition-all duration-200 hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                        {project.name}
                      </h3>
                      {project.job_title && (
                        <p className="text-sm mb-2 text-blue-600 dark:text-blue-400">
                          🎯 {project.job_title}
                        </p>
                      )}
                      {isMasterAdmin && project.organization_name && (
                        <p className="text-sm mb-2 text-purple-600 dark:text-purple-400">
                          🏢 {project.organization_name}
                        </p>
                      )}
                      {project.description && (
                        <p className="text-sm line-clamp-2 text-gray-700 dark:text-gray-300">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold">{project.candidate_count || 0}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-500">candidats</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Brain className="w-4 h-4 text-green-500" />
                        <span className="font-semibold">{project.analyzed_count || 0}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-500">analysés</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold text-yellow-600">{project.shortlisted_count || 0}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-500">shortlistés</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex items-center justify-center text-xs text-gray-700 dark:text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{new Date(project.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    
                    {/* Actions - Version mobile friendly */}
                    <div className="grid grid-cols-3 gap-2">
                      <Link 
                        href={`/org/${orgId}/cv/${project.id}`}
                        className="flex items-center justify-center px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors rounded-lg text-sm font-medium"
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        <span className="hidden sm:inline">Voir</span>
                        <span className="sm:hidden">👁</span>
                      </Link>
                      <button 
                        onClick={() => setShowEditModal(project)}
                        className="flex items-center justify-center px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors rounded-lg text-sm font-medium"
                      >
                        <Edit className="w-4 h-4 mr-1.5" />
                        <span className="hidden sm:inline">Edit</span>
                        <span className="sm:hidden">✏️</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(project.id)}
                        className="flex items-center justify-center px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors rounded-lg text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        <span className="hidden sm:inline">Suppr</span>
                        <span className="sm:hidden">🗑</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {showConfirmModal && (
        <ConfirmationModal 
          isOpen={!!showConfirmModal}
          onClose={() => setShowConfirmModal(null)}
          onConfirm={showConfirmModal.action}
          title={showConfirmModal.title}
          message={showConfirmModal.message}
          confirmText="Confirmer"
          cancelText="Annuler"
        />
      )}

      {showCreateModal && <CreateProjectModal orgId={orgId} onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); loadProjects(); }} />}
      {showEditModal && <EditProjectModal project={showEditModal} onClose={() => setShowEditModal(null)} onSuccess={() => { setShowEditModal(null); loadProjects(); }} />}
    </div>
  );
}

// MODAL COMPONENTS (Should be in separate files)

function CreateProjectModal({ orgId, onClose, onSuccess }: { orgId: string; onClose: () => void; onSuccess: () => void; }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ job_title: '', description: '', requirements: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [aiLoading, setAiLoading] = useState<{ [key: string]: boolean }>({});
  const [showAiMagic, setShowAiMagic] = useState(false);
  const [creationMode, setCreationMode] = useState<'choose' | 'ai' | 'manual'>('choose');

  const handleAIGenerateAll = async () => {
    if (!formData.job_title.trim()) {
      setError("Veuillez d'abord saisir le titre du poste");
      return;
    }

    setShowAiMagic(true);
    setAiLoading({ description: true, requirements: true });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour utiliser l'IA.");
      }

      // Génération en parallèle pour impressionner l'utilisateur
      const [descResponse, reqResponse] = await Promise.all([
        fetch('/api/cv/generate-realistic', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `Génère une description de poste ultra-professionnelle pour: "${formData.job_title}". 
            Format: 
            - Présentation de l'entreprise (2-3 phrases)
            - Le poste (missions principales, 4-5 points)
            - Environnement de travail et avantages
            - Perspective d'évolution
            
            Style: moderne, attractif, vendeur. Longueur: 200-300 mots.`,
            type: 'description'
          })
        }),
        fetch('/api/cv/generate-realistic', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `Génère les exigences parfaites pour: "${formData.job_title}".
            Structure:
            - Expérience requise (années + type)
            - Compétences techniques indispensables (5-7 points)
            - Diplômes/formations
            - Soft skills valorisées
            - Un plus/bonus
            
            Style: clair, réaliste, pas trop exigeant. Format bullet points.`,
            type: 'requirements'
          })
        })
      ]);

      // Check for errors before parsing JSON
      if (!descResponse.ok || !reqResponse.ok) {
        const descError = !descResponse.ok ? await descResponse.text() : null;
        const reqError = !reqResponse.ok ? await reqResponse.text() : null;
        throw new Error(descError || reqError || 'Erreur lors de la génération IA');
      }

      const [descData, reqData] = await Promise.all([
        descResponse.json(),
        reqResponse.json()
      ]);

      // Animation séquentielle pour l'effet "wow"
      setTimeout(() => {
        setFormData(prev => ({ 
          ...prev, 
          description: descData.content || descData.generated_content || descData.text 
        }));
        setAiLoading(prev => ({ ...prev, description: false }));
      }, 1000);

      setTimeout(() => {
        setFormData(prev => ({ 
          ...prev, 
          requirements: reqData.content || reqData.generated_content || reqData.text 
        }));
        setAiLoading(prev => ({ ...prev, requirements: false }));
        setStep(2);
      }, 2000);

    } catch (err: any) {
      console.error('AI generation error:', err);
      setError(err.message);
      setAiLoading({ description: false, requirements: false });
      setShowAiMagic(false);
    }
  };

  const handleQuickAdjust = async (field: 'description' | 'requirements', action: string) => {
    setAiLoading({ ...aiLoading, [field]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expirée");

      const prompts = {
        description: {
          shorter: `Réduis cette description à l'essentiel (150 mots max): ${formData.description}`,
          longer: `Enrichis cette description avec plus de détails sur l'entreprise et les avantages: ${formData.description}`,
          formal: `Rends cette description plus formelle et corporate: ${formData.description}`,
          casual: `Rends cette description plus moderne et décontractée: ${formData.description}`
        },
        requirements: {
          easier: `Assouplis ces exigences, rends-les plus accessibles: ${formData.requirements}`,
          stricter: `Renforce ces exigences, sois plus sélectif: ${formData.requirements}`,
          technical: `Focus sur les compétences techniques: ${formData.requirements}`,
          soft: `Valorise davantage les soft skills: ${formData.requirements}`
        }
      };

      const response = await fetch('/api/cv/generate-realistic', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompts[field][action],
          type: field
        })
      });

      if (!response.ok) {
        // Try to get error message from response
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la génération IA';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If not JSON, use the text directly or a default message
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setFormData({ ...formData, [field]: data.content || data.generated_content || data.text });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading({ ...aiLoading, [field]: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour créer un projet.");
      }
      
      const response = await fetch('/api/admin/create-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orgId: orgId, // Ajout de l'orgId manquant
          name: formData.job_title, // Le nom du projet = titre du poste
          job_title: formData.job_title,
          description: formData.description,
          requirements: formData.requirements,
          created_by: session.user.id
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Erreur lors de la création du projet.");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-y-auto backdrop-blur-sm p-2 sm:p-4 pt-4 sm:pt-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header avec gradient - Responsive */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">🚀 Créer une offre d'emploi</h2>
              <p className="text-blue-100 text-sm sm:text-base md:text-lg mt-1">
                {creationMode === 'manual' 
                  ? "Rédigez ou collez votre offre d'emploi personnalisée" 
                  : creationMode === 'ai' 
                    ? "L'IA va générer une offre professionnelle en quelques secondes"
                    : "Choisissez votre méthode de création préférée"
                }
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>Titre du poste</span>
            <span>Génération IA</span>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-160px)]">
          {step === 1 && creationMode === 'choose' && (
            <div className="space-y-8">
              <div className="text-center">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mb-3">
                  Comment voulez-vous créer votre offre d'emploi ?
                </h3>
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
                  Choisissez la méthode qui vous convient le mieux
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
                {/* Option IA */}
                <div className="group relative">
                  <button
                    onClick={() => setCreationMode('ai')}
                    className="w-full p-4 sm:p-6 md:p-8 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl sm:rounded-2xl border-2 border-blue-200 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-400 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                  >
                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">🤖</div>
                    <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Génération Automatique
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mb-3 sm:mb-4">
                      L'IA crée une offre complète et professionnelle en quelques secondes
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">⚡ Rapide</span>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">🎯 Professionnel</span>
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">✨ Optimisé</span>
                    </div>
                  </button>
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                    Recommandé
                  </div>
                </div>

                {/* Option Manuelle */}
                <div>
                  <button
                    onClick={() => {setCreationMode('manual'); setStep(2);}}
                    className="w-full p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-xl sm:rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                  >
                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">✏️</div>
                    <h4 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Saisie Manuelle
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mb-3 sm:mb-4">
                      Collez votre description existante ou rédigez entièrement votre offre
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">🎨 Personnalisé</span>
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">📝 Contrôle total</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && creationMode === 'ai' && (
            <div className="space-y-6">
              {/* Bouton retour en haut à gauche */}
              <div className="flex justify-start">
                <button 
                  onClick={() => setCreationMode('choose')}
                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
                >
                  ← Retour au choix
                </button>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Quel poste recrutez-vous ? 🤖
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  L'IA va créer une offre complète et professionnelle
                </p>
              </div>

              <div className="max-w-lg mx-auto space-y-4">
                <div>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg border-2 border-blue-200 dark:border-blue-500 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-gray-700 transition-colors text-center font-medium"
                    value={formData.job_title} 
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} 
                    placeholder="ex: Développeur Full Stack Senior"
                    autoFocus
                  />
                </div>

                {formData.job_title.trim() && (
                  <div className="animate-fade-in space-y-3">
                    <button 
                      type="button"
                      onClick={handleAIGenerateAll}
                      disabled={showAiMagic}
                      className="w-full py-3 sm:py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:scale-100 text-sm sm:text-base"
                    >
                      {showAiMagic ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent mr-2 sm:mr-3"></div>
                          <span className="text-sm sm:text-base">✨ L'IA génère votre offre...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <span className="text-sm sm:text-base">🎯 Générer l'offre complète avec l'IA</span>
                        </span>
                      )}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => {setCreationMode('manual'); setStep(2);}}
                      className="w-full py-2 sm:py-3 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base"
                    >
                      Ou saisir manuellement →
                    </button>
                    
                    <p className="text-center text-xs text-gray-600 dark:text-gray-500 mt-2">
                      Description + Exigences générées automatiquement en 30 secondes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {creationMode === 'ai' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-green-700 dark:text-green-300 font-medium">
                      Offre générée avec succès ! Vous pouvez maintenant l'ajuster.
                    </span>
                  </div>
                </div>
              )}
              
              {creationMode === 'manual' && (
                <div className="text-center mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Créez votre offre d'emploi ✏️
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Saisissez ou collez le contenu de votre offre d'emploi
                  </p>
                </div>
              )}

              {creationMode === 'manual' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    🎯 Titre du poste *
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 transition-colors font-medium text-sm sm:text-base"
                    value={formData.job_title} 
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} 
                    placeholder="ex: Développeur Full Stack Senior"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Description */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    📋 Description du poste
                  </label>
                  <textarea 
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 transition-colors text-sm sm:text-base ${aiLoading.description ? 'animate-pulse' : ''}`}
                    rows={8}
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                    placeholder={creationMode === 'manual' ? "Collez votre description existante ou rédigez-la entièrement..." : ""}
                  />
                  
                  {creationMode === 'ai' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleQuickAdjust('description', 'shorter')} disabled={aiLoading.description} className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">📝 Plus court</button>
                      <button type="button" onClick={() => handleQuickAdjust('description', 'longer')} disabled={aiLoading.description} className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">📖 Plus détaillé</button>
                      <button type="button" onClick={() => handleQuickAdjust('description', 'casual')} disabled={aiLoading.description} className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">😊 Plus moderne</button>
                    </div>
                  )}
                </div>

                {/* Requirements */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    ✅ Exigences & Compétences
                  </label>
                  <textarea 
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 transition-colors text-sm sm:text-base ${aiLoading.requirements ? 'animate-pulse' : ''}`}
                    rows={8}
                    value={formData.requirements} 
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} 
                    placeholder={creationMode === 'manual' ? "Collez vos exigences existantes ou rédigez-les entièrement..." : ""}
                  />
                  
                  {creationMode === 'ai' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleQuickAdjust('requirements', 'easier')} disabled={aiLoading.requirements} className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">😌 Plus accessible</button>
                      <button type="button" onClick={() => handleQuickAdjust('requirements', 'stricter')} disabled={aiLoading.requirements} className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">🎯 Plus sélectif</button>
                      <button type="button" onClick={() => handleQuickAdjust('requirements', 'technical')} disabled={aiLoading.requirements} className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">💻 Plus technique</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions - Version mobile responsive */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <button 
                    type="button"
                    onClick={() => {setStep(1); setCreationMode('choose');}}
                    className="px-4 sm:px-6 py-2 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium text-sm sm:text-base"
                  >
                    ← Retour
                  </button>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isLoading || !formData.job_title} 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full sm:w-auto"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          <span className="text-sm sm:text-base">Création...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm sm:text-base">🎉 Créer le projet</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function EditProjectModal({ project, onClose, onSuccess }: { project: Project; onClose: () => void; onSuccess: () => void; }) {
  const [formData, setFormData] = useState({ 
    name: project.name || '', 
    job_title: project.job_title || '', 
    description: project.description || '', 
    requirements: project.requirements || '' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour modifier un projet.");
      }
      
      const response = await fetch(`/api/cv/projects/${project.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Erreur lors de la modification du projet.");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Modifier le projet</h3>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du projet *</label>
            <input 
              type="text" 
              required 
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre du poste</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" 
              value={formData.job_title} 
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea 
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" 
              rows={3}
              value={formData.description} 
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exigences</label>
            <textarea 
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" 
              rows={3}
              value={formData.requirements} 
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} 
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={isLoading || !formData.name} className="flex-1">
              {isLoading ? 'Modification...' : 'Modifier'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}