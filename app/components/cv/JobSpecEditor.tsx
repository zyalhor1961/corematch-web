'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import {
  Settings,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  X,
  HelpCircle,
  Sliders,
  Sparkles
} from 'lucide-react';
import type { JobSpec, MustHaveRule } from '@/lib/cv-analysis/deterministic-evaluator';

interface JobSpecEditorProps {
  projectId: string;
  initialJobSpec?: JobSpec;
  onSave?: (jobSpec: JobSpec) => void;
}

const DEFAULT_JOB_SPEC: Partial<JobSpec> = {
  title: '',
  must_have: [],
  skills_required: [],
  nice_to_have: [],
  relevance_rules: {
    direct: [],
    adjacent: [],
    peripheral: []
  },
  skills_map: {},
  weights: {
    w_exp: 0.5,
    w_skills: 0.3,
    w_nice: 0.2,
    p_adjacent: 0.5
  },
  thresholds: {
    years_full_score: 3,
    shortlist_min: 75,
    consider_min: 60
  }
};

export default function JobSpecEditor({ projectId, initialJobSpec, onSave }: JobSpecEditorProps) {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobSpec, setJobSpec] = useState<JobSpec>(
    initialJobSpec || { ...DEFAULT_JOB_SPEC, analysis_date: new Date().toISOString().split('T')[0] } as JobSpec
  );

  const [newMustHave, setNewMustHave] = useState({ desc: '', severity: 'standard' as 'critical' | 'standard' });
  const [newSkill, setNewSkill] = useState('');
  const [newNiceToHave, setNewNiceToHave] = useState('');
  const [newDirectKeyword, setNewDirectKeyword] = useState('');
  const [newAdjacentKeyword, setNewAdjacentKeyword] = useState('');
  const [newPeripheralKeyword, setNewPeripheralKeyword] = useState('');

  useEffect(() => {
    if (initialJobSpec) {
      setJobSpec(initialJobSpec);
    }
  }, [initialJobSpec]);

  const handleAddMustHave = () => {
    if (!newMustHave.desc.trim()) return;

    const rule: MustHaveRule = {
      id: `M${jobSpec.must_have.length + 1}`,
      desc: newMustHave.desc,
      severity: newMustHave.severity
    };

    setJobSpec(prev => ({
      ...prev,
      must_have: [...prev.must_have, rule]
    }));

    setNewMustHave({ desc: '', severity: 'standard' });
  };

  const handleRemoveMustHave = (id: string) => {
    setJobSpec(prev => ({
      ...prev,
      must_have: prev.must_have.filter(r => r.id !== id)
    }));
  };

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    setJobSpec(prev => ({
      ...prev,
      skills_required: [...prev.skills_required, newSkill.trim()]
    }));
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setJobSpec(prev => ({
      ...prev,
      skills_required: prev.skills_required.filter(s => s !== skill)
    }));
  };

  const handleAddNiceToHave = () => {
    if (!newNiceToHave.trim()) return;
    setJobSpec(prev => ({
      ...prev,
      nice_to_have: [...prev.nice_to_have, newNiceToHave.trim()]
    }));
    setNewNiceToHave('');
  };

  const handleRemoveNiceToHave = (item: string) => {
    setJobSpec(prev => ({
      ...prev,
      nice_to_have: prev.nice_to_have.filter(n => n !== item)
    }));
  };

  const handleAddKeyword = (type: 'direct' | 'adjacent' | 'peripheral', keyword: string) => {
    if (!keyword.trim()) return;
    setJobSpec(prev => ({
      ...prev,
      relevance_rules: {
        ...prev.relevance_rules,
        [type]: [...prev.relevance_rules[type], keyword.trim()]
      }
    }));

    if (type === 'direct') setNewDirectKeyword('');
    if (type === 'adjacent') setNewAdjacentKeyword('');
    if (type === 'peripheral') setNewPeripheralKeyword('');
  };

  const handleRemoveKeyword = (type: 'direct' | 'adjacent' | 'peripheral', keyword: string) => {
    setJobSpec(prev => ({
      ...prev,
      relevance_rules: {
        ...prev.relevance_rules,
        [type]: prev.relevance_rules[type].filter(k => k !== keyword)
      }
    }));
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/cv/projects/${projectId}/job-spec/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération automatique');
      }

      const result = await response.json();

      if (result.success && result.data?.jobSpec) {
        setJobSpec(result.data.jobSpec);
        console.log('[JobSpecEditor] Auto-generated JobSpec loaded');
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (err) {
      console.error('Auto-generate error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/cv/projects/${projectId}/job-spec`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobSpec })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      setSaveSuccess(true);
      if (onSave) {
        onSave(jobSpec);
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2"
      >
        <Settings className="w-4 h-4" />
        <span>Configuration analyse</span>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between ${
          isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200'
        }`}>
          <div className="flex-1">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Configuration JOB_SPEC
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Configuration déterministe et auditable de l'analyse CV
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              variant="outline"
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white border-none hover:from-purple-600 hover:to-blue-600"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Génération...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Générer automatiquement</span>
                </>
              )}
            </Button>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* 1. Titre du poste */}
            <section>
              <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                1. Titre du poste
              </h3>
              <input
                type="text"
                value={jobSpec.title}
                onChange={e => setJobSpec(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Enseignant FLE, Développeur Full Stack..."
                className={`w-full px-4 py-2 rounded-lg ${
                  isDarkMode
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </section>

            {/* 2. Must-Have (Critères obligatoires) */}
            <section>
              <div className="flex items-center space-x-2 mb-3">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  2. Critères obligatoires (must_have)
                </h3>
                <div className="group relative">
                  <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className={`absolute left-0 bottom-full mb-2 w-64 p-2 text-xs rounded shadow-lg hidden group-hover:block ${
                    isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-900 text-white'
                  }`}>
                    Règles qui DOIVENT être satisfaites. Une règle "critical" non satisfaite = REJECT automatique.
                  </div>
                </div>
              </div>

              {/* Liste des règles */}
              <div className="space-y-2 mb-3">
                {jobSpec.must_have.map(rule => (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-lg flex items-start justify-between ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                          isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {rule.id}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rule.severity === 'critical'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {rule.severity === 'critical' ? 'CRITIQUE' : 'Standard'}
                        </span>
                      </div>
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

              {/* Ajouter une règle */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <textarea
                  placeholder="Description de la règle (ex: Diplôme M2 FLE ou équivalent)"
                  value={newMustHave.desc}
                  onChange={e => setNewMustHave(prev => ({ ...prev, desc: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${
                    isDarkMode
                      ? 'bg-gray-600 text-white border-gray-500'
                      : 'bg-white text-gray-900 border-gray-300'
                  } border`}
                  rows={2}
                />
                <div className="flex items-center justify-between">
                  <select
                    value={newMustHave.severity}
                    onChange={e => setNewMustHave(prev => ({ ...prev, severity: e.target.value as 'critical' | 'standard' }))}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-gray-600 text-white border-gray-500'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border`}
                  >
                    <option value="standard">Standard</option>
                    <option value="critical">CRITIQUE (rejet si non satisfait)</option>
                  </select>
                  <button
                    onClick={handleAddMustHave}
                    className="ml-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </button>
                </div>
              </div>
            </section>

            {/* 3. Compétences requises */}
            <section>
              <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                3. Compétences requises (skills_required)
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

              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ajouter une compétence (ex: conception de cours)"
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

            {/* 4. Nice-to-have */}
            <section>
              <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                4. Compétences souhaitées (nice_to_have)
              </h3>

              <div className="flex flex-wrap gap-2 mb-3">
                {jobSpec.nice_to_have.map((item, idx) => (
                  <span
                    key={idx}
                    className={`px-3 py-1 rounded-full text-sm flex items-center space-x-2 ${
                      isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    <span>{item}</span>
                    <button onClick={() => handleRemoveNiceToHave(item)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ajouter un atout (ex: arabe, médiation sociale)"
                  value={newNiceToHave}
                  onChange={e => setNewNiceToHave(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddNiceToHave()}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isDarkMode
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-white text-gray-900 border-gray-300'
                  } border`}
                />
                <button
                  onClick={handleAddNiceToHave}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* 5. Règles de pertinence */}
            <section>
              <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                5. Règles de pertinence des expériences (relevance_rules)
              </h3>

              {/* DIRECTE */}
              <div className="mb-4">
                <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                  DIRECTE (même métier/fonction)
                </h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {jobSpec.relevance_rules.direct.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-xs flex items-center space-x-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      <span>{kw}</span>
                      <button onClick={() => handleRemoveKeyword('direct', kw)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ex: enseignant FLE, formateur FLE"
                    value={newDirectKeyword}
                    onChange={e => setNewDirectKeyword(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddKeyword('direct', newDirectKeyword)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border`}
                  />
                  <button
                    onClick={() => handleAddKeyword('direct', newDirectKeyword)}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ADJACENTE */}
              <div className="mb-4">
                <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  ADJACENTE (compétences transférables)
                </h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {jobSpec.relevance_rules.adjacent.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-xs flex items-center space-x-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    >
                      <span>{kw}</span>
                      <button onClick={() => handleRemoveKeyword('adjacent', kw)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ex: interprète, traducteur, médiateur"
                    value={newAdjacentKeyword}
                    onChange={e => setNewAdjacentKeyword(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddKeyword('adjacent', newAdjacentKeyword)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border`}
                  />
                  <button
                    onClick={() => handleAddKeyword('adjacent', newAdjacentKeyword)}
                    className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* PÉRIPHÉRIQUE */}
              <div>
                <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>
                  PÉRIPHÉRIQUE (même secteur mais pas la fonction)
                </h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {jobSpec.relevance_rules.peripheral.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-xs flex items-center space-x-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                      <span>{kw}</span>
                      <button onClick={() => handleRemoveKeyword('peripheral', kw)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ex: secteur éducatif, bénévolat éducatif"
                    value={newPeripheralKeyword}
                    onChange={e => setNewPeripheralKeyword(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddKeyword('peripheral', newPeripheralKeyword)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                    } border`}
                  />
                  <button
                    onClick={() => handleAddKeyword('peripheral', newPeripheralKeyword)}
                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* 6. Poids et seuils */}
            <section>
              <div className="flex items-center space-x-2 mb-3">
                <Sliders className="w-5 h-5 text-gray-500" />
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  6. Poids et seuils
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Poids */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Poids des critères
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Expérience (w_exp): {jobSpec.weights?.w_exp || 0.5}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={jobSpec.weights?.w_exp || 0.5}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          weights: { ...prev.weights!, w_exp: parseFloat(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Compétences (w_skills): {jobSpec.weights?.w_skills || 0.3}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={jobSpec.weights?.w_skills || 0.3}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          weights: { ...prev.weights!, w_skills: parseFloat(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Nice-to-have (w_nice): {jobSpec.weights?.w_nice || 0.2}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={jobSpec.weights?.w_nice || 0.2}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          weights: { ...prev.weights!, w_nice: parseFloat(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Poids expérience adjacente (p_adjacent): {jobSpec.weights?.p_adjacent || 0.5}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={jobSpec.weights?.p_adjacent || 0.5}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          weights: { ...prev.weights!, p_adjacent: parseFloat(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Seuils */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Seuils de décision
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Années pour score max
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={jobSpec.thresholds?.years_full_score || 3}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          thresholds: { ...prev.thresholds!, years_full_score: parseInt(e.target.value) }
                        }))}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${
                          isDarkMode
                            ? 'bg-gray-600 text-white border-gray-500'
                            : 'bg-white text-gray-900 border-gray-300'
                        } border`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Score min shortlist (≥)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={jobSpec.thresholds?.shortlist_min || 75}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          thresholds: { ...prev.thresholds!, shortlist_min: parseInt(e.target.value) }
                        }))}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${
                          isDarkMode
                            ? 'bg-gray-600 text-white border-gray-500'
                            : 'bg-white text-gray-900 border-gray-300'
                        } border`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Score min à considérer (≥)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={jobSpec.thresholds?.consider_min || 60}
                        onChange={e => setJobSpec(prev => ({
                          ...prev,
                          thresholds: { ...prev.thresholds!, consider_min: parseInt(e.target.value) }
                        }))}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${
                          isDarkMode
                            ? 'bg-gray-600 text-white border-gray-500'
                            : 'bg-white text-gray-900 border-gray-300'
                        } border`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-2">
            {saveSuccess && (
              <div className="flex items-center space-x-2 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">Sauvegardé avec succès</span>
              </div>
            )}
            {error && (
              <div className="flex items-center space-x-2 text-red-500">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !jobSpec.title.trim()}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder la configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
