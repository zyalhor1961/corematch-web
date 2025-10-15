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
      // First try the my_orgs view
      let { data, error } = await supabase
        .from('my_orgs')
        .select('*')
        .order('org_name');

      // If my_orgs fails or is empty, try direct organizations query
      if (error || !data || data.length === 0) {
        console.log('my_orgs failed, trying direct organizations query');
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, plan, status')
          .order('name');

        if (orgError) {
          throw new Error(orgError.message || "Impossible de charger les organisations.");
        }

        // Transform to match expected format and add default role
        data = orgData?.map(org => ({
          ...org,
          org_name: org.name, // Map name to org_name for consistency
          role: 'org_admin' // Default role for direct access
        })) || [];
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
      org_viewer: 'bg-gray-100 text-foreground'
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
      canceled: 'bg-gray-100 text-foreground'
    };
    const labels: { [key: string]: string } = {
      active: 'Actif',
      trialing: 'Essai',
      past_due: 'En retard',
      canceled: 'AnnulÃ©'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.trialing}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-muted">Chargement de vos organisations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center bg-card p-8 border border-border rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Erreur de chargement</h2>
          <p className="text-muted mb-6">{error}</p>
          <Button onClick={loadOrganizations}>RÃ©essayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Vos organisations</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted">{user?.email}</span>
              <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => router.push('/'))}>
                DÃ©connexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {organizations.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg shadow-sm border border-border">
            <Building2 className="h-12 w-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Aucune organisation trouvÃ©e</h3>
            <p className="text-muted mb-6">CrÃ©ez une organisation pour commencer Ã  utiliser CoreMatch.</p>
            <Button onClick={createNewOrganization}>
              <Plus className="w-4 h-4 mr-2" />
              CrÃ©er une organisation
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <div key={org.id} className="bg-card rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/org/${org.id}`)}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Building2 className="h-8 w-8 text-brand" />
                    <div className="flex space-x-2">
                      {org.role && getRoleBadge(org.role)}
                      {getStatusBadge(org.status)}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 truncate">{org.org_name}</h3>
                  <p className="text-sm text-muted mb-4">Plan {org.plan}</p>
                  <div className="text-sm font-medium text-brand hover:opacity-90">AccÃ©der â†’</div>
                </div>
              </div>
            ))}
            <div className="bg-card rounded-lg shadow-sm border-2 border-dashed border-border hover:border-brand transition-colors cursor-pointer flex items-center justify-center" onClick={createNewOrganization}>
              <div className="p-6 text-center">
                <Plus className="h-8 w-8 text-muted mx-auto mb-2" />
                <h3 className="text-lg font-medium text-foreground">Nouvelle organisation</h3>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

