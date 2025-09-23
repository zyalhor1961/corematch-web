'use client';

import { useState, useEffect, useCallback } from 'react';
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
  User
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
  
  const orgId = params?.orgId as string;
  const projectId = params?.projectId as string;

  const loadProject = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Vous devez être connecté pour voir le projet.");
      }
      
      const response = await fetch(`/api/cv/projects/${projectId}`, {
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
      
      const response = await fetch(`/api/cv/projects/${projectId}/candidates`, {
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
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Télécharger CVs
            </Button>
            <Button>
              <Brain className="w-4 h-4 mr-2" />
              Analyser tout
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
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Télécharger CVs
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
                          <button className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Download className="w-4 h-4" />
                          </button>
                          <button className={`p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500`}>
                            <Trash2 className="w-4 h-4" />
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