'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Project } from '@/lib/types';
import CandidatesListModal from '@/app/components/cv/CandidatesListModal';
import JobOfferEditor from '@/app/components/cv/JobOfferEditor';
import { 
  Plus, 
  Upload, 
  Users, 
  TrendingUp, 
  Download,
  Play,
  MoreHorizontal,
  Trash2,
  Eye,
  ExternalLink,
  Brain,
  Star,
  FileSpreadsheet,
  Edit
} from 'lucide-react';

export default function CVScreeningPage() {
  const params = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Project | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [showCandidatesModal, setShowCandidatesModal] = useState<string | null>(null);
  
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

  const createShortlist = async (projectId: string) => {
    const maxCandidates = prompt('Combien de candidats maximum pour la shortlist ?', '5');
    if (!maxCandidates) return;

    try {
      const response = await fetch(`/api/cv/projects/${projectId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxCandidates: parseInt(maxCandidates) })
      });

      const data = await response.json();

      if (data.success) {
        // Rafraîchir silencieusement
        loadProjects();
      } else {
        alert('❌ Erreur lors de la création de la shortlist');
      }
    } catch (error) {
      console.error('Error creating shortlist:', error);
      alert('❌ Erreur lors de la création de la shortlist');
    }
  };

  const exportResults = async (projectId: string, format: 'csv' | 'excel', type: 'all' | 'shortlist') => {
    try {
      const response = await fetch(`/api/cv/projects/${projectId}/export?format=${format}&type=${type}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `export-${projectId}-${type}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Export réussi - téléchargement automatique, pas de message
      } else {
        alert('❌ Erreur lors de l\'export');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      alert('❌ Erreur lors de l\'export');
    }
  };

  const getStatusBadge = (project: Project & { candidate_count?: number; analyzed_count?: number }) => {
    const totalCandidates = project.candidate_count || 0;
    const analyzed = project.analyzed_count || 0;
    
    if (totalCandidates === 0) {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Vide</span>;
    }
    
    if (analyzed === totalCandidates) {
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Terminé</span>;
    }
    
    if (analyzed > 0) {
      return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">En cours</span>;
    }
    
    return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Nouveau</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CV Screening</h1>
          <p className="text-gray-600">Analysez et triez vos candidatures automatiquement</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau projet
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Projets actifs</p>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Upload className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">CV ce mois</p>
              <p className="text-2xl font-bold text-gray-900">
                {projects.reduce((sum, p) => sum + (p.candidate_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Score moyen</p>
              <p className="text-2xl font-bold text-gray-900">78</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun projet CV
          </h3>
          <p className="text-gray-600 mb-6">
            Créez votre premier projet pour commencer à analyser des CV
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Créer un projet
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {project.name}
                    </h3>
                    {project.job_title && (
                      <p className="text-sm text-gray-600">{project.job_title}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(project)}
                    <button 
                      onClick={() => setShowEditModal(project)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-700"
                      title="Modifier l'offre d'emploi"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteProject(project.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700"
                      title="Supprimer le projet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div 
                    className="flex justify-between text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                    onClick={() => setShowCandidatesModal(project.id)}
                    title="Cliquer pour voir les CV"
                  >
                    <span className="text-gray-600">CV téléversés:</span>
                    <span className="font-medium text-blue-600">{project.candidate_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Analysés:</span>
                    <span className="font-medium">{project.analyzed_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shortlistés:</span>
                    <span className="font-medium">{project.shortlisted_count || 0}</span>
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
                      className="text-purple-600 hover:bg-purple-50"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Analyser tout
                    </Button>
                  )}
                  
                  {(project.analyzed_count || 0) > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => createShortlist(project.id)}
                      className="text-yellow-600 hover:bg-yellow-50"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Shortlist
                    </Button>
                  )}
                </div>
                
                {(project.candidate_count || 0) > 0 && (
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportResults(project.id, 'csv', 'all')}
                      className="flex-1 text-green-600 hover:bg-green-50"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportResults(project.id, 'excel', 'all')}
                      className="flex-1 text-blue-600 hover:bg-blue-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Excel
                    </Button>
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-gray-50 border-t">
                <p className="text-xs text-gray-500">
                  Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal - Using new JobOfferEditor */}
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