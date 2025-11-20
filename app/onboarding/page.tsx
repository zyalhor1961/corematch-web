'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Check, Users, FileText, Mail, Plus, X } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [orgName, setOrgName] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [inviteEmails, setInviteEmails] = useState(['']);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to login if no user is found
        router.push('/login');
        return;
      }
      setUser(user);
      
      if (user?.user_metadata?.company_name) {
        setOrgName(user.user_metadata.company_name);
      }
    };
    
    getUser();
  }, [router]);

  const steps = [
    { id: 1, title: 'Organisation', description: 'Configurez votre organisation' },
    { id: 2, title: 'Modules', description: 'Choisissez vos modules' },
    { id: 3, title: 'Équipe', description: 'Invitez votre équipe' }
  ];

  const modules = [
    { id: 'cv-screening', name: 'CV Screening', description: 'Analyse automatique de CV avec IA', icon: Users, popular: true },
    { id: 'deb-assistant', name: 'DEB Assistant', description: 'Traitement des factures intracommunautaires', icon: FileText, popular: false }
  ];

  const handleModuleToggle = (moduleId: string) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const addEmailField = () => setInviteEmails([...inviteEmails, '']);

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...inviteEmails];
    newEmails[index] = value;
    setInviteEmails(newEmails);
  };

  const removeEmail = (index: number) => {
    setInviteEmails(inviteEmails.filter((_, i) => i !== index));
  };

  const validateEmail = (email: string) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  const handleNext = async () => {
    setError(null);
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    if (!user) {
      setError("Utilisateur non authentifié. Veuillez vous reconnecter.");
      setIsLoading(false);
      return;
    }
    
    try {
      // Step 1: Create organization via admin API (bypass RLS completely)
      const response = await fetch('/api/admin/create-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: orgName,
          admin_user_id: user.id,
          plan: 'starter',
          status: 'active'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création de l\'organisation');
      }

      const { organization: orgData } = await response.json();

      const orgId = orgData?.id;
      if (!orgId) {
        throw new Error("La création de l'organisation a échoué: ID manquant.");
      }

      // Note: User is already added to organization_members by the API
      // with role 'owner' in /api/admin/create-organization

      // Step 2: Update user metadata with selected modules
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          selected_modules: selectedModules,
          onboarding_completed: true
        }
      });

      if (updateError) throw updateError;

      // Step 3: Send invites via secure API
      const validEmails = inviteEmails.filter(email => email.trim() && validateEmail(email));
      if (validEmails.length > 0) {
        try {
          const inviteResponse = await fetch('/api/admin/send-invitations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orgId,
              emails: validEmails,
              role: 'org_viewer', // Default role for invitations
            }),
          });

          if (!inviteResponse.ok) {
            const inviteError = await inviteResponse.json();
            console.error('[Onboarding] Failed to send invitations:', inviteError);
            // Don't block onboarding if invitations fail - just log
          } else {
            console.log(`[Onboarding] Successfully sent ${validEmails.length} invitations`);
          }
        } catch (inviteError) {
          console.error('[Onboarding] Invitation error:', inviteError);
          // Don't block onboarding if invitations fail
        }
      }

      router.push(`/org/${orgId}`);
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Erreur lors de la configuration. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return orgName.trim().length > 2;
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
      <div className="max-w-3xl w-full">
        <div className="mb-8">
          <ol className="flex items-center w-full">
            {steps.map((step, index) => (
              <li key={step.id} className={`flex w-full items-center ${index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ""} ${currentStep > step.id ? 'after:border-blue-600' : 'after:border-gray-200'}`}>
                <span className={`flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 ${currentStep >= step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {currentStep > step.id ? <Check className="w-5 h-5" /> : <span>{step.id}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 min-h-[400px]">
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Créez votre organisation</h2>
              <p className="text-gray-600 mb-6">Ce sera votre espace de travail partagé.</p>
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-2">Nom de lorganisation</label>
                <input id="orgName" type="text" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: Acme Inc" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choisissez vos modules</h2>
              <p className="text-gray-600 mb-6">Sélectionnez au moins un module pour commencer.</p>
              <div className="space-y-4">
                {modules.map(module => {
                  const Icon = module.icon;
                  const isSelected = selectedModules.includes(module.id);
                  return (
                    <div key={module.id} className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => handleModuleToggle(module.id)}>
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-4 ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}><Icon className="w-6 h-6" /></div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                            {module.popular && <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">Populaire</span>}
                          </div>
                          <p className="text-gray-600 text-sm">{module.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}><Check className="w-3 h-3 text-white" /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitez votre équipe</h2>
              <p className="text-gray-600 mb-6">Invitez des membres dans votre organisation (cette étape est optionnelle).</p>
              <div className="space-y-3">
                {inviteEmails.map((email, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-gray-400 shrink-0" />
                    <input type="email" className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="collegue@entreprise.com" value={email} onChange={(e) => updateEmail(index, e.target.value)} />
                    <button type="button" onClick={() => removeEmail(index)} className="text-gray-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={addEmailField} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"><Plus className="w-4 h-4 mr-1" />Ajouter un membre</button>
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">💡 Les invitations seront envoyées par email. Vos collègues pourront créer leur compte et rejoindre votre organisation.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-bold">Erreur</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>Précédent</Button>
            <Button onClick={handleNext} disabled={!canProceed() || isLoading}>{isLoading ? 'Finalisation...' : currentStep === 3 ? 'Terminer et aller au tableau de bord' : 'Suivant'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
