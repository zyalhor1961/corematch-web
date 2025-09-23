'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import { 
  X, 
  Briefcase, 
  Users, 
  MapPin, 
  Clock, 
  DollarSign,
  Sparkles,
  FileText,
  CheckCircle,
  Target,
  Award,
  Building,
  Wand2,
  Loader2
} from 'lucide-react';

interface JobOfferEditorProps {
  orgId: string;
  project?: any;
  onClose: () => void;
  onSuccess: () => void;
}

// Templates d'offres d'emploi
const JOB_TEMPLATES = {
  developer: {
    title: 'Développeur Full Stack',
    category: 'Tech',
    icon: '💻',
    job_title: 'Développeur Full Stack Senior',
    description: `Nous recherchons un développeur Full Stack passionné pour rejoindre notre équipe dynamique.
    
Vos missions principales :
• Développer et maintenir nos applications web
• Participer à l'architecture technique
• Collaborer avec l'équipe produit
• Mentorer les développeurs juniors`,
    requirements: `• 5+ ans d'expérience en développement web
• Maîtrise de React, Node.js, TypeScript
• Expérience avec les bases de données SQL/NoSQL
• Pratique des méthodologies Agile
• Excellent esprit d'équipe
• Anglais professionnel`,
    salary: '55-75k€',
    location: 'Paris / Remote',
    contract: 'CDI'
  },
  marketing: {
    title: 'Marketing Manager',
    category: 'Marketing',
    icon: '📈',
    job_title: 'Marketing Manager Digital',
    description: `Rejoignez notre équipe marketing pour piloter notre stratégie digitale et développer notre présence en ligne.
    
Vos responsabilités :
• Définir et exécuter la stratégie marketing digital
• Gérer les campagnes publicitaires (SEA, Social Ads)
• Optimiser le SEO et le content marketing
• Analyser les performances et ROI`,
    requirements: `• 3-5 ans d'expérience en marketing digital
• Expertise Google Ads, Facebook Ads, LinkedIn Ads
• Maîtrise des outils analytics (GA4, GTM)
• Créativité et orientation résultats
• Capacité à gérer plusieurs projets
• Français et anglais courants`,
    salary: '45-60k€',
    location: 'Lyon',
    contract: 'CDI'
  },
  sales: {
    title: 'Commercial B2B',
    category: 'Sales',
    icon: '🎯',
    job_title: 'Business Developer B2B SaaS',
    description: `Accélérez votre carrière en rejoignant notre équipe commerciale en pleine croissance.
    
Ce que vous ferez :
• Prospecter et qualifier de nouveaux clients
• Gérer le cycle de vente complet
• Négocier et closer des deals
• Développer votre portefeuille clients`,
    requirements: `• 2+ ans d'expérience en vente B2B
• Idéalement dans le SaaS ou Tech
• Excellent relationnel et écoute active
• Orienté résultats et chasseur
• Organisé et autonome
• Permis B requis`,
    salary: '35-45k€ + commissions',
    location: 'Bordeaux',
    contract: 'CDI'
  },
  design: {
    title: 'Product Designer',
    category: 'Design',
    icon: '🎨',
    job_title: 'Product Designer UX/UI',
    description: `Créez des expériences utilisateur exceptionnelles pour nos produits digitaux.
    
Vos missions :
• Designer des interfaces web et mobile
• Mener des recherches utilisateurs
• Créer des prototypes et wireframes
• Collaborer avec les développeurs`,
    requirements: `• 3+ ans en design produit
• Portfolio démontrant votre expertise UX/UI
• Maîtrise de Figma, Sketch ou Adobe XD
• Connaissance des principes d'accessibilité
• Sensibilité business et data
• Curiosité et créativité`,
    salary: '45-55k€',
    location: 'Remote',
    contract: 'CDI'
  }
};

export default function JobOfferEditor({ orgId, project, onClose, onSuccess }: JobOfferEditorProps) {
  const { isDarkMode } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'template' | 'custom'>(project ? 'custom' : 'template');
  const [formData, setFormData] = useState({
    name: project?.name || '',
    job_title: project?.job_title || '',
    description: project?.description || '',
    requirements: project?.requirements || '',
    salary: '',
    location: '',
    contract: 'CDI'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingRequirements, setIsGeneratingRequirements] = useState(false);

  const handleTemplateSelect = (templateKey: string) => {
    const template = JOB_TEMPLATES[templateKey as keyof typeof JOB_TEMPLATES];
    setSelectedTemplate(templateKey);
    setFormData({
      ...formData,
      name: template.title,
      job_title: template.job_title,
      description: template.description,
      requirements: template.requirements,
      salary: template.salary,
      location: template.location,
      contract: template.contract
    });
    setActiveTab('custom');
  };

  const generateRequirements = async () => {
    if (!formData.description.trim()) {
      alert('Veuillez d\'abord remplir la description du poste');
      return;
    }

    setIsGeneratingRequirements(true);
    try {
      const response = await fetch('/api/cv/generate-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          jobTitle: formData.job_title
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setFormData({ ...formData, requirements: data.requirements });
      } else {
        alert('Erreur lors de la génération des exigences');
      }
    } catch (error) {
      console.error('Error generating requirements:', error);
      alert('Erreur lors de la génération des exigences');
    } finally {
      setIsGeneratingRequirements(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const isEdit = !!project;
      const url = isEdit ? `/api/cv/projects/${project.id}` : '/api/cv/projects';
      const method = isEdit ? 'PUT' : 'POST';

      // Get current user for created_by field
      const { data: { user } } = await supabase.auth.getUser();

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          job_title: formData.job_title,
          description: formData.description,
          requirements: formData.requirements,
          orgId,
          ...(isEdit ? {} : { created_by: user?.id })
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        alert(`Erreur lors de ${isEdit ? 'la modification' : 'la création'} du projet`);
      }
    } catch (error) {
      console.error(`Error ${project ? 'updating' : 'creating'} project:`, error);
      alert(`Erreur lors de ${project ? 'la modification' : 'la création'} du projet`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`rounded-xl w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div>
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {project ? 'Modifier l\'offre' : 'Créer une offre d\'emploi'}
            </h2>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Utilisez un template ou créez votre offre personnalisée
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${
              isDarkMode 
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs - Hide templates tab when editing */}
        {!project && (
          <div className={`flex border-b px-6 ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <button
              onClick={() => setActiveTab('template')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'template' 
                  ? 'text-slate-600 border-slate-600' 
                  : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} border-transparent`
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Templates
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'custom' 
                  ? 'text-slate-600 border-slate-600' 
                  : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} border-transparent`
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Personnalisé
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {(activeTab === 'template' && !project) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(JOB_TEMPLATES).map(([key, template]) => (
                <div
                  key={key}
                  onClick={() => handleTemplateSelect(key)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                    selectedTemplate === key 
                      ? `border-slate-500 ${isDarkMode ? 'bg-slate-800/20' : 'bg-slate-50'}` 
                      : `${isDarkMode ? 'border-gray-600 hover:border-slate-400' : 'border-gray-200 hover:border-slate-300'}`
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>{template.title}</h3>
                      <p className={`text-sm mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>{template.category}</p>
                      <div className={`flex items-center space-x-4 mt-3 text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <span className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          {template.location}
                        </span>
                        <span className="flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {template.salary}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {template.contract}
                        </span>
                      </div>
                    </div>
                    {selectedTemplate === key && (
                      <CheckCircle className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informations principales */}
              <div className={`rounded-lg p-4 space-y-4 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <h3 className={`font-semibold flex items-center ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <Briefcase className="w-5 h-5 mr-2 text-slate-600" />
                  Informations principales
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Nom du projet *
                    </label>
                    <input
                      type="text"
                      required
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-800 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      placeholder="Ex: Recrutement Dev 2024"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Titre du poste *
                    </label>
                    <input
                      type="text"
                      required
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-800 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      placeholder="Ex: Développeur Full Stack Senior"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Localisation
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-800 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      placeholder="Paris, Remote..."
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      Salaire
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-800 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      placeholder="45-60k€"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <Clock className="w-4 h-4 inline mr-1" />
                      Type de contrat
                    </label>
                    <select
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-800 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                      value={formData.contract}
                      onChange={(e) => setFormData({ ...formData, contract: e.target.value })}
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Stage">Stage</option>
                      <option value="Alternance">Alternance</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Description du poste */}
              <div className={`rounded-lg p-4 space-y-4 ${
                isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
              }`}>
                <h3 className={`font-semibold flex items-center ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <Target className="w-5 h-5 mr-2 text-slate-600" />
                  Description du poste
                </h3>
                <textarea
                  required
                  rows={6}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-800 text-white' 
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder="Décrivez le poste, les missions, le contexte de l'entreprise..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                <p className={`text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  💡 Conseil : Utilisez des bullet points pour structurer les missions principales
                </p>
              </div>

              {/* Exigences */}
              <div className={`rounded-lg p-4 space-y-4 ${
                isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold flex items-center ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Award className="w-5 h-5 mr-2 text-emerald-600" />
                    Exigences et compétences
                  </h3>
                  <button
                    type="button"
                    onClick={generateRequirements}
                    disabled={isGeneratingRequirements || !formData.description.trim()}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isGeneratingRequirements || !formData.description.trim()
                        ? 'opacity-50 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-emerald-700 text-emerald-100 hover:bg-emerald-600'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                    title={!formData.description.trim() ? 'Remplissez d\'abord la description du poste' : 'Générer automatiquement les exigences'}
                  >
                    {isGeneratingRequirements ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Générer avec IA
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  required
                  rows={6}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-800 text-white' 
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder="• Années d'expérience requises
• Compétences techniques
• Soft skills
• Langues parlées..."
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                />
                <p className={`text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  💡 L'IA utilisera ces critères pour scorer les candidats. Utilisez le bouton "Générer avec IA" pour extraire automatiquement les exigences de la description du poste.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-between items-center p-6 border-t ${
          isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {activeTab === 'custom' && formData.name && (
              <span>✅ Prêt pour recevoir des CV</span>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            {activeTab === 'custom' && (
              <Button 
                onClick={handleSubmit}
                disabled={isLoading || !formData.name || !formData.job_title}
                className="bg-slate-600 hover:bg-slate-700"
              >
                {isLoading ? 'Création...' : project ? 'Modifier' : 'Créer l\'offre'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}