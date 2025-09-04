'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Button } from '../components/ui/button';
import { Building2, Users, FileText, Plus, AlertTriangle } from 'lucide-react';

interface Organization {
  id: string;
  org_name: string;
  role?: string;
  plan: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('my_orgs')
        .select('*')
        .order('org_name');

      if (error) {
        throw new Error(error.message || "Impossible de charger les organisations.");
      }

      if (data?.length === 1) {
        router.push(`/org/${data[0].id}`);
        return;
      }
      setOrganizations(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const getUserAndOrgs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      await loadOrganizations();
    };

    getUserAndOrgs();
  }, [loadOrganizations, router]);

  const createNewOrganization = () => {
    router.push('/onboarding');
  };

  const getRoleBadge = (role: string) => {
    const colors: { [key: string]: string } = {
      org_admin: 'bg-red-100 text-red-800',
      org_manager: 'bg-blue-100 text-blue-800',
      org_viewer: 'bg-gray-100 text-gray-800'
    };
    const labels: { [key: string]: string } = {
      org_admin: 'Admin',
      org_manager: 'Manager',
      org_viewer: 'Viewer'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[role] || colors.org_viewer}`}>
        {labels[role] || role}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-yellow-100 text-yellow-800',
      past_due: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800'
    };
    const labels: { [key: string]: string } = {
      active: 'Actif',
      trialing: 'Essai',
      past_due: 'En retard',
      canceled: 'Annulé'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.trialing}`}>
        {labels[status] || status}
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Erreur de chargement</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={loadOrganizations}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Vos organisations</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => router.push('/'))}>
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {organizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune organisation trouvée</h3>
            <p className="text-gray-600 mb-6">Créez une organisation pour commencer à utiliser CoreMatch.</p>
            <Button onClick={createNewOrganization}>
              <Plus className="w-4 h-4 mr-2" />
              Créer une organisation
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <div key={org.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/org/${org.id}`)}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Building2 className="h-8 w-8 text-blue-600" />
                    <div className="flex space-x-2">
                      {org.role && getRoleBadge(org.role)}
                      {getStatusBadge(org.status)}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">{org.org_name}</h3>
                  <p className="text-sm text-gray-600 mb-4">Plan {org.plan}</p>
                  <div className="text-sm font-medium text-blue-600 hover:text-blue-700">Accéder →</div>
                </div>
              </div>
            ))}
            <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer flex items-center justify-center" onClick={createNewOrganization}>
              <div className="p-6 text-center">
                <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-gray-900">Nouvelle organisation</h3>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}