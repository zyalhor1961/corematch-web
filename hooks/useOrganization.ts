import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Organization {
  id: string;
  org_name: string;
  slug: string;
  description?: string;
  plan?: string;
  status?: string;
  admin_user_id: string;
}

export const useOrganization = () => {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      setError(null);

      // Méthode 1: Utiliser la fonction RPC que nous avons créée
      const { data: orgIdData, error: idError } = await supabase.rpc('get_my_org_id');
      
      if (idError) {
        console.error('Erreur get_my_org_id:', idError);
        throw idError;
      }

      if (orgIdData) {
        setOrgId(orgIdData);
        
        // Récupérer les détails complets de l'organisation via la vue my_orgs
        // Note: my_orgs est une vue qui filtre automatiquement par auth.uid()
        const { data: orgDetails, error: orgError } = await supabase
          .from('my_orgs')
          .select('*')
          .single();
        
        if (orgError) {
          console.error('Erreur my_orgs:', orgError);
          // Fallback: utiliser la fonction get_current_user_org
          const { data: fallbackOrg, error: fallbackError } = await supabase
            .rpc('get_current_user_org');
          
          if (fallbackError) {
            throw fallbackError;
          }
          
          if (fallbackOrg && fallbackOrg.length > 0) {
            setOrgData({
              id: fallbackOrg[0].id,
              org_name: fallbackOrg[0].name,
              slug: fallbackOrg[0].slug,
              description: fallbackOrg[0].description,
              plan: 'free',
              status: 'active',
              admin_user_id: orgIdData
            });
            console.log('✅ Organisation chargée (fallback):', fallbackOrg[0]);
          }
        } else {
          setOrgData({
            id: orgDetails.id,
            org_name: orgDetails.org_name,
            slug: orgDetails.slug,
            description: orgDetails.description,
            plan: orgDetails.plan || 'free',
            status: orgDetails.status || 'active',
            admin_user_id: orgDetails.admin_user_id
          });
          console.log('✅ Organisation chargée:', orgDetails);
        }
      }

    } catch (err: any) {
      console.error('❌ Erreur chargement organisation:', err);
      setError(err.message || 'Erreur de chargement');
      
      // Méthode de fallback: créer une organisation automatiquement
      try {
        console.log('🔄 Tentative de création automatique d\'organisation...');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: newOrg, error: createError } = await supabase
            .from('organizations')
            .insert({
              name: 'Mon Organisation CoreMatch',
              admin_user_id: user.id,
              description: 'Organisation créée automatiquement',
              slug: `org-${user.id.substring(0, 8)}`
            })
            .select()
            .single();
          
          if (!createError && newOrg) {
            setOrgId(newOrg.id);
            setOrgData({
              id: newOrg.id,
              org_name: newOrg.name,
              slug: newOrg.slug,
              description: newOrg.description,
              plan: 'free',
              status: 'active',
              admin_user_id: user.id
            });
            console.log('✅ Organisation créée automatiquement:', newOrg);
          }
        }
      } catch (fallbackError) {
        console.error('❌ Fallback échoué:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Charger l'organisation au mount
    fetchOrganization();

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        fetchOrganization();
      } else if (event === 'SIGNED_OUT') {
        setOrgId(null);
        setOrgData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    orgId,
    orgData,
    loading,
    error,
    refetch: fetchOrganization
  };
};

// Hook pour les appels API avec org_id automatique
export const useOrgQuery = () => {
  const { orgId } = useOrganization();

  const fetchWithOrgId = async (
    table: string, 
    options: {
      select?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    } = {}
  ) => {
    if (!orgId) {
      throw new Error('Organisation ID non disponible');
    }

    let supabaseQuery = supabase
      .from(table)
      .select(options.select || '*')
      .eq('org_id', orgId);

    // Ajouter des filtres supplémentaires
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        supabaseQuery = supabaseQuery.eq(key, value);
      });
    }

    // Ajouter le tri
    if (options.orderBy) {
      supabaseQuery = supabaseQuery.order(options.orderBy.column, { 
        ascending: options.orderBy.ascending !== false 
      });
    }

    // Ajouter la limite
    if (options.limit) {
      supabaseQuery = supabaseQuery.limit(options.limit);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error(`❌ Erreur ${table}:`, error);
      throw error;
    }

    console.log(`✅ ${table} chargé:`, data?.length || 0, 'records');
    return data;
  };

  // Fonction pour compter les records
  const countWithOrgId = async (table: string, filters: Record<string, any> = {}) => {
    if (!orgId) {
      throw new Error('Organisation ID non disponible');
    }

    let supabaseQuery = supabase
      .from(table)
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    // Ajouter des filtres supplémentaires
    Object.entries(filters).forEach(([key, value]) => {
      supabaseQuery = supabaseQuery.eq(key, value);
    });

    const { count, error } = await supabaseQuery;

    if (error) {
      console.error(`❌ Erreur count ${table}:`, error);
      throw error;
    }

    return count || 0;
  };

  return { 
    fetchWithOrgId, 
    countWithOrgId, 
    orgId,
    isReady: !!orgId
  };
};