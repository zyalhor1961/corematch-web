'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import { supabase } from '@/lib/supabase/client';
import {
  X,
  Play,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles
} from 'lucide-react';
import type { JobSpec, MustHaveRule } from '@/lib/cv-analysis/deterministic-evaluator';

interface AnalysisConfigModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (config?: JobSpec) => void;
}

export default function AnalysisConfigModal({
  projectId,
  isOpen,
  onClose,
  onAnalyze
}: AnalysisConfigModalProps) {
  const { isDarkMode } = useTheme();
  const [jobSpec, setJobSpec] = useState<JobSpec | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs d'édition rapide
  const [newMustHave, setNewMustHave] = useState('');
  const [newSkill, setNewSkill] = useState('');

  // Load JobSpec when modal opens
  useEffect(() => {
    if (isOpen) {
      loadJobSpec();
    }
  }, [isOpen, projectId]);

  const loadJobSpec = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Vous devez être connecté');
      }

      const response = await fetch(`/api/cv/projects/${projectId}/job-spec`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de la configuration');
      }

      const result = await response.json();
      setJobSpec(result.data.jobSpec);
    } catch (err) {
      console.error('Load JobSpec error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Vous devez être connecté');
      }

      const response = await fetch(`/api/cv/projects/${projectId}/job-spec/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération');
      }

      const result = await response.json();
      setJobSpec(result.data.jobSpec);
    } catch (err) {
      console.error('Auto-generate error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddMustHave = () => {
    if (!jobSpec || !newMustHave.trim()) return;

    const rule: MustHaveRule = {
      id: `M${jobSpec.must_have.length + 1}`,
      desc: newMustHave.trim(),
      severity: 'standard'
    };

    setJobSpec({
      ...jobSpec,
      must_have: [...jobSpec.must_have, rule]
    });

    setNewMustHave('');
  };

  const handleRemoveMustHave = (id: string) => {
    if (!jobSpec) return;
    setJobSpec({
      ...jobSpec,
      must_have: jobSpec.must_have.filter(r => r.id !== id)
    });
  };

  const handleAddSkill = () => {
    if (!jobSpec || !newSkill.trim()) return;

    setJobSpec({
      ...jobSpec,
      skills_required: [...jobSpec.skills_required, newSkill.trim()]
    });

    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    if (!jobSpec) return;
    setJobSpec({
      ...jobSpec,
      skills_required: jobSpec.skills_required.filter(s => s !== skill)
    });
  };

  const handleAnalyze = () => {
    onAnalyze(jobSpec || undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b ${
          isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Configurer l'analyse
              </h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Modifiez les critères avant de lancer l'analyse des CVs
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}

          {error && (
            <div className={`p-4 rounded-lg flex items-start space-x-3 mb-4 ${
              isDarkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
            }`}>
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !jobSpec && (
            <div className="text-center py-12">
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Aucune configuration trouvée. Voulez-vous générer automatiquement ?
              </p>
              <Button
                onClick={handleAutoGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Générer automatiquement
                  </>
                )}
              </Button>
            </div>
          )}

          {!isLoading && jobSpec && (
            <div className="space-y-6">
              {/* Auto-generate button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleAutoGenerate}
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-none hover:from-purple-600 hover:to-blue-600"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Régénération...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-2" />
                      Régénérer
                    </>
                  )}
                </Button>
              </div>

              {/* Must-have rules */}
              <section>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Critères obligatoires ({jobSpec.must_have.length})
                </h3>

                <div className="space-y-2 mb-3">
                  {jobSpec.must_have.map(rule => (
                    <div
                      key={rule.id}
                      className={`p-3 rounded-lg flex items-start justify-between ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rule.severity === 'critical'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {rule.severity === 'critical' ? 'CRITIQUE' : 'Standard'}
                        </span>
                        <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {rule.desc}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveMustHave(rule.id)}
                        className="ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add must-have */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ajouter un critère obligatoire..."
                    value={newMustHave}
                    onChange={e => setNewMustHave(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddMustHave()}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border`}
                  />
                  <button
                    onClick={handleAddMustHave}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </section>

              {/* Skills required */}
              <section>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Compétences requises ({jobSpec.skills_required.length})
                </h3>

                <div className="flex flex-wrap gap-2 mb-3">
                  {jobSpec.skills_required.map((skill, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-full text-sm flex items-center space-x-2 ${
                        isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <span>{skill}</span>
                      <button onClick={() => handleRemoveSkill(skill)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add skill */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ajouter une compétence..."
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddSkill()}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border`}
                  />
                  <button
                    onClick={handleAddSkill}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </section>

              {/* Weights */}
              <section>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Poids des critères
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Expérience: {jobSpec.weights?.w_exp || 0.5}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={jobSpec.weights?.w_exp || 0.5}
                      onChange={e => setJobSpec({
                        ...jobSpec,
                        weights: { ...jobSpec.weights!, w_exp: parseFloat(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Compétences: {jobSpec.weights?.w_skills || 0.3}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={jobSpec.weights?.w_skills || 0.3}
                      onChange={e => setJobSpec({
                        ...jobSpec,
                        weights: { ...jobSpec.weights!, w_skills: parseFloat(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200'
        }`}>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Ces modifications s'appliquent uniquement à cette analyse
          </p>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={!jobSpec}
              className="bg-green-500 hover:bg-green-600"
            >
              <Play className="w-4 h-4 mr-2" />
              Lancer l'analyse
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
