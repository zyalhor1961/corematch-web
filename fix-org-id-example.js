// Exemple de code pour corriger org_id=undefined dans l'application CoreMatch

// 1. Hook React pour gérer l'organisation
import { useState, useEffect } from 'react';
import { supabase } from './supabase'; // Votre client Supabase

export const useOrganization = () => {
  const [orgId, setOrgId] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      setError(null);

      // Méthode 1: Utiliser la fonction RPC
      const { data: orgIdData, error: idError } = await supabase.rpc('get_my_org_id');
      
      if (idError) {
        console.error('Erreur get_my_org_id:', idError);
        throw idError;
      }

      if (orgIdData) {
        setOrgId(orgIdData);
        
        // Récupérer les détails complets de l'organisation
        const { data: orgDetails, error: orgError } = await supabase
          .from('my_orgs')
          .select('*')
          .single();
        
        if (orgError) {
          console.error('Erreur my_orgs:', orgError);
          throw orgError;
        }

        setOrgData(orgDetails);
        console.log('✅ Organisation chargée:', orgDetails);
      }

    } catch (err) {
      console.error('❌ Erreur chargement organisation:', err);
      setError(err);
      
      // Méthode de fallback: créer une organisation
      try {
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
            setOrgData(newOrg);
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

// 2. Hook pour les appels API avec org_id automatique
export const useOrgQuery = () => {
  const { orgId } = useOrganization();

  const fetchWithOrgId = async (table, query = {}) => {
    if (!orgId) {
      throw new Error('Organisation ID non disponible');
    }

    let supabaseQuery = supabase
      .from(table)
      .select(query.select || '*')
      .eq('org_id', orgId);

    // Ajouter des filtres supplémentaires
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        supabaseQuery = supabaseQuery.eq(key, value);
      });
    }

    // Ajouter le tri
    if (query.orderBy) {
      supabaseQuery = supabaseQuery.order(query.orderBy.column, { 
        ascending: query.orderBy.ascending !== false 
      });
    }

    // Ajouter la limite
    if (query.limit) {
      supabaseQuery = supabaseQuery.limit(query.limit);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error(`❌ Erreur ${table}:`, error);
      throw error;
    }

    console.log(`✅ ${table} chargé:`, data?.length || 0, 'records');
    return data;
  };

  return { fetchWithOrgId, orgId };
};

// 3. Exemple d'utilisation dans un composant Dashboard
export const Dashboard = () => {
  const { orgId, orgData, loading: orgLoading } = useOrganization();
  const { fetchWithOrgId } = useOrgQuery();
  
  const [usageData, setUsageData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Charger les données d'usage (mois actuel)
        const currentMonth = new Date().toISOString().substring(0, 7);
        const usage = await fetchWithOrgId('usage_counters', {
          filters: { period_month: currentMonth },
          orderBy: { column: 'counter_type' }
        });
        setUsageData(usage);

        // Charger les projets récents
        const projectsData = await fetchWithOrgId('projects', {
          orderBy: { column: 'created_at', ascending: false },
          limit: 5
        });
        setProjects(projectsData);

      } catch (error) {
        console.error('❌ Erreur chargement dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [orgId]);

  if (orgLoading || loading) {
    return <div>Chargement du dashboard...</div>;
  }

  if (!orgId) {
    return <div>Impossible de charger l'organisation</div>;
  }

  return (
    <div>
      <h1>Dashboard - {orgData?.org_name}</h1>
      
      <div>
        <h2>Statistiques du mois</h2>
        {usageData.map(stat => (
          <div key={stat.counter_type}>
            {stat.counter_type}: {stat.counter_value}
          </div>
        ))}
      </div>

      <div>
        <h2>Projets récents</h2>
        {projects.map(project => (
          <div key={project.id}>
            {project.name} - {project.status}
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. Context Provider pour l'organisation (alternative à Redux)
import { createContext, useContext } from 'react';

const OrganizationContext = createContext();

export const OrganizationProvider = ({ children }) => {
  const orgData = useOrganization();
  
  return (
    <OrganizationContext.Provider value={orgData}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrgContext = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrgContext must be used within OrganizationProvider');
  }
  return context;
};

// 5. Exemple d'utilisation avec le Context
export const App = () => {
  return (
    <OrganizationProvider>
      <Dashboard />
      {/* Autres composants qui ont besoin de l'orgId */}
    </OrganizationProvider>
  );
};

// 6. Middleware pour les appels API (si vous utilisez une couche d'abstraction)
export const apiClient = {
  async get(endpoint, params = {}) {
    const { data: orgId } = await supabase.rpc('get_my_org_id');
    
    if (!orgId) {
      throw new Error('Organisation non trouvée');
    }

    // Ajouter org_id aux paramètres automatiquement
    const finalParams = {
      ...params,
      org_id: orgId
    };

    return supabase
      .from(endpoint)
      .select()
      .match(finalParams);
  }
};

/*
RÉSUMÉ DE LA SOLUTION:

1. Le problème était org_id=eq.undefined dans toutes les requêtes
2. L'application ne récupérait pas l'ID d'organisation après login
3. La solution crée des hooks React qui:
   - Récupèrent automatiquement l'org_id au login
   - Créent une organisation si elle n'existe pas
   - Fournissent l'org_id à tous les composants
   - Automatisent les requêtes avec l'org_id correct

ÉTAPES D'INTÉGRATION:
1. Exécuter le script SQL fix-org-id-app.sql dans Supabase
2. Intégrer les hooks dans votre application React
3. Remplacer les appels API directs par les hooks useOrgQuery
4. Tester que org_id n'est plus undefined

VÉRIFICATION:
Dans la console du navigateur, vous devriez voir:
✅ Organisation chargée: { id: "...", org_name: "..." }
Au lieu de:
❌ GET .../usage_counters?org_id=eq.undefined 400 (Bad Request)
*/