'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { Check, Users, FileText, Mail, Plus } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Form state
  const [orgName, setOrgName] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [inviteEmails, setInviteEmails] = useState(['']);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user?.user_metadata?.company_name) {
        setOrgName(user.user_metadata.company_name);
      }
    };
    
    getUser();
  }, []);

  const steps = [
    {
      id: 1,
      title: 'Organisation',
      description: 'Configurez votre organisation'
    },
    {
      id: 2,
      title: 'Modules',
      description: 'Choisissez vos modules'
    },
    {
      id: 3,
      title: 'Équipe',
      description: 'Invitez votre équipe'
    }
  ];

  const modules = [
    {
      id: 'cv-screening',
      name: 'CV Screening',
      description: 'Analyse automatique de CV avec IA',
      icon: Users,
      popular: true
    },
    {
      id: 'deb-assistant',
      name: 'DEB Assistant',
      description: 'Traitement des factures intracommunautaires',
      icon: FileText,
      popular: false
    }
  ];

  const handleModuleToggle = (moduleId: string) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const addEmailField = () => {
    setInviteEmails([...inviteEmails, '']);
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...inviteEmails];
    newEmails[index] = value;
    setInviteEmails(newEmails);
  };

  const removeEmail = (index: number) => {
    setInviteEmails(inviteEmails.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .rpc('create_organization_with_admin', {
          org_name: orgName,
          admin_user_id: user?.id
        });

      if (orgError) {
        throw orgError;
      }

      // Store selected modules in user metadata or organization settings
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          selected_modules: selectedModules,
          onboarding_completed: true
        }
      });

      if (updateError) {
        console.error('Error updating user metadata:', updateError);
      }

      // Send invites (simplified - in production you'd send actual emails)
      const validEmails = inviteEmails.filter(email => email.trim() && email.includes('@'));
      if (validEmails.length > 0) {
        for (const email of validEmails) {
          await supabase
            .from('organization_members')
            .insert({
              org_id: orgData,
              invited_email: email,
              role: 'org_viewer'
            });
        }
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      alert('Erreur lors de la configuration. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return orgName.trim().length > 0;
      case 2:
        return selectedModules.length > 0;
      case 3:
        return true; // Team invitation is optional
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep >= step.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-full h-1 mx-4 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map(step => (
              <div key={step.id} className="text-center">
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Configurez votre organisation
              </h2>
              <p className="text-gray-600 mb-6">
                Donnez un nom à votre organisation pour commencer
              </p>
              
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'organisation
                </label>
                <input
                  id="orgName"
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mon Entreprise"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Choisissez vos modules
              </h2>
              <p className="text-gray-600 mb-6">
                Sélectionnez les modules que vous souhaitez utiliser
              </p>
              
              <div className="space-y-4">
                {modules.map(module => {
                  const Icon = module.icon;
                  const isSelected = selectedModules.includes(module.id);
                  
                  return (
                    <div
                      key={module.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleModuleToggle(module.id)}
                    >
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-4 ${
                          isSelected ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            isSelected ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {module.name}
                            </h3>
                            {module.popular && (
                              <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                Populaire
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm">
                            {module.description}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Invitez votre équipe
              </h2>
              <p className="text-gray-600 mb-6">
                Invitez vos collègues à rejoindre votre organisation (optionnel)
              </p>
              
              <div className="space-y-4">
                {inviteEmails.map((email, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="colleague@email.com"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                    />
                    {inviteEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addEmailField}
                  className="flex items-center text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une adresse email
                </button>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  💡 Les invitations seront envoyées par email. Vos collègues pourront 
                  créer leur compte et rejoindre votre organisation.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Précédent
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
            >
              {isLoading ? 'Configuration...' : 
               currentStep === 3 ? 'Terminer' : 'Suivant'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}