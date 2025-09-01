'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Button } from '../components/ui/button';
import { Building2, Users, FileText, Plus } from 'lucide-react';

interface Organization {
  org_id: string;
  org_name: string;
  role: string;
  plan: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      await loadOrganizations();
    };

    getUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('my_orgs')
        .select('*')
        .order('org_name');

      if (error) {
        console.error('Error loading organizations:', error);
        return;
      }

      setOrganizations(data || []);
      
      // If user has only one org, redirect directly
      if (data?.length === 1) {
        router.push(`/org/${data[0].org_id}`);
        return;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewOrganization = () => {
    router.push('/onboarding');
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      org_admin: 'bg-red-100 text-red-800',
      org_manager: 'bg-blue-100 text-blue-800',
      org_viewer: 'bg-gray-100 text-gray-800'
    };
    
    const labels = {
      org_admin: 'Admin',
      org_manager: 'Manager',
      org_viewer: 'Viewer'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[role as keyof typeof colors] || colors.org_viewer}`}>
        {labels[role as keyof typeof labels] || role}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      trial: 'bg-yellow-100 text-yellow-800',
      past_due: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      active: 'Actif',
      trial: 'Essai',
      past_due: 'En retard',
      canceled: 'Annulé'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors] || colors.trial}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de vos organisations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Vos organisations
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Connecté en tant que {user?.email}
              </span>
              <Button 
                variant="outline" 
                onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
              >
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune organisation trouvée
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre première organisation pour commencer à utiliser CoreMatch
            </p>
            <Button onClick={createNewOrganization}>
              <Plus className="w-4 h-4 mr-2" />
              Créer une organisation
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {organizations.map((org) => (
                <div
                  key={org.org_id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/org/${org.org_id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Building2 className="h-8 w-8 text-blue-600" />
                      <div className="flex space-x-2">
                        {getRoleBadge(org.role)}
                        {getStatusBadge(org.status)}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {org.org_name}
                    </h3>
                    
                    <div className="text-sm text-gray-600 mb-4">
                      Plan {org.plan}
                    </div>

                    <div className="flex items-center text-blue-600 hover:text-blue-700">
                      <span className="text-sm font-medium">Accéder →</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Add new organization card */}
              <div
                className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer"
                onClick={createNewOrganization}
              >
                <div className="p-6 text-center">
                  <Plus className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nouvelle organisation
                  </h3>
                  <p className="text-sm text-gray-600">
                    Créer une nouvelle organisation
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Aide et ressources
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">CV Screening</h3>
                  <p className="text-sm text-gray-600">
                    Guide d&apos;utilisation du module de tri de CV
                  </p>
                </div>

                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">DEB Assistant</h3>
                  <p className="text-sm text-gray-600">
                    Documentation pour le traitement des factures
                  </p>
                </div>

                <div className="text-center p-4 border border-gray-200 rounded-lg">
                  <Building2 className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Support</h3>
                  <p className="text-sm text-gray-600">
                    Contactez notre équipe support
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}