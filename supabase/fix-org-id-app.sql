-- Solution finale pour corriger org_id=undefined dans l'application

-- 1. Créer une fonction simple pour récupérer l'organisation de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_current_user_org()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    org_exists BOOLEAN := FALSE;
BEGIN
    -- Récupérer l'ID de l'utilisateur actuel
    current_user_id := auth.uid();
    
    -- Vérifier si l'utilisateur a déjà une organisation
    SELECT EXISTS(
        SELECT 1 FROM public.organizations 
        WHERE admin_user_id = current_user_id
    ) INTO org_exists;
    
    -- Si pas d'organisation, en créer une automatiquement
    IF NOT org_exists AND current_user_id IS NOT NULL THEN
        INSERT INTO public.organizations (name, admin_user_id, description, slug)
        VALUES (
            'Mon Organisation CoreMatch',
            current_user_id,
            'Organisation créée automatiquement',
            'org-' || substring(current_user_id::text from 1 for 8)
        );
    END IF;
    
    -- Retourner l'organisation de l'utilisateur
    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        COALESCE(o.slug, 'default-org'),
        o.description,
        o.created_at
    FROM public.organizations o
    WHERE o.admin_user_id = current_user_id
    LIMIT 1;
END;
$$;

-- 2. Créer une fonction qui retourne seulement l'ID (plus simple pour l'app)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_id UUID;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Essayer de récupérer l'ID
    SELECT id INTO org_id
    FROM public.organizations
    WHERE admin_user_id = current_user_id
    LIMIT 1;
    
    -- Si pas d'org, en créer une
    IF org_id IS NULL THEN
        INSERT INTO public.organizations (name, admin_user_id, description, slug)
        VALUES (
            'Mon Organisation CoreMatch',
            current_user_id,
            'Organisation créée automatiquement',
            'org-' || substring(current_user_id::text from 1 for 8)
        )
        RETURNING id INTO org_id;
    END IF;
    
    RETURN org_id;
END;
$$;

-- 3. Corriger la vue my_orgs pour qu'elle fonctionne toujours
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT 
    o.id,
    o.name as org_name,
    COALESCE(o.slug, 'default-org') as slug,
    o.description,
    o.website,
    o.logo_url,
    COALESCE(o.plan, 'free') as plan,
    COALESCE(o.status, 'active') as status,
    o.admin_user_id,
    o.created_at,
    o.updated_at
FROM public.organizations o
WHERE o.admin_user_id = auth.uid();

-- 4. Créer des données de test pour l'organisation courante
DO $$
DECLARE
    my_org_id UUID;
    current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
    -- Récupérer ou créer l'organisation
    SELECT public.get_my_org_id() INTO my_org_id;
    
    IF my_org_id IS NOT NULL THEN
        -- Créer des compteurs d'usage pour le mois actuel
        INSERT INTO public.usage_counters (org_id, period_month, counter_type, counter_value)
        VALUES 
            (my_org_id, current_month, 'documents_created', 8),
            (my_org_id, current_month, 'projects_created', 4),
            (my_org_id, current_month, 'candidates_added', 25),
            (my_org_id, current_month, 'matches_made', 12)
        ON CONFLICT (org_id, period_month, counter_type) 
        DO UPDATE SET 
            counter_value = EXCLUDED.counter_value,
            updated_at = NOW();
        
        -- Créer quelques projets
        INSERT INTO public.projects (org_id, name, description, status, created_by)
        VALUES 
            (my_org_id, 'Dashboard Analytics', 'Analyse des performances de matching', 'active', auth.uid()),
            (my_org_id, 'Campagne Q1 2025', 'Recrutement startups tech', 'active', auth.uid()),
            (my_org_id, 'Expansion Internationale', 'Développement marchés européens', 'planning', auth.uid())
        ON CONFLICT DO NOTHING;
        
        -- Créer quelques documents
        INSERT INTO public.documents (org_id, name, description, file_type, uploaded_by)
        VALUES 
            (my_org_id, 'Rapport Mensuel', 'Rapport d''activité mensuel', 'pdf', auth.uid()),
            (my_org_id, 'Présentation Investisseurs', 'Deck de présentation', 'pptx', auth.uid()),
            (my_org_id, 'Guide Utilisateur', 'Documentation utilisateur', 'pdf', auth.uid())
        ON CONFLICT DO NOTHING;
        
        -- Créer quelques candidats
        INSERT INTO public.candidates (org_id, first_name, last_name, email, status, notes)
        VALUES 
            (my_org_id, 'Jean', 'Martin', 'jean.martin@startup.com', 'pending', 'Profil intéressant'),
            (my_org_id, 'Marie', 'Dubois', 'marie@techcorp.com', 'qualified', 'Expertise IA'),
            (my_org_id, 'Pierre', 'Bernard', 'pierre.b@innovation.fr', 'interviewed', 'Entretien planifié')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Données créées pour organisation: %', my_org_id;
    END IF;
END $$;

-- 5. Test des fonctions créées
SELECT '=== TEST DES FONCTIONS ===' as test_section;

-- Test get_my_org_id()
SELECT 'Mon ID d''organisation:' as label, public.get_my_org_id() as org_id;

-- Test get_current_user_org()
SELECT 'Mes informations d''organisation:' as label;
SELECT * FROM public.get_current_user_org();

-- Test my_orgs
SELECT 'Vue my_orgs:' as label;
SELECT * FROM public.my_orgs;

-- 6. Simuler les appels API de l'application
SELECT '=== SIMULATION DES APPELS API COREMATCH ===' as api_simulation;

-- Usage counters (dashboard)
SELECT 'usage_counters API:' as api_name;
SELECT 
    counter_type,
    counter_value,
    period_month
FROM public.usage_counters 
WHERE org_id = public.get_my_org_id()
AND period_month = TO_CHAR(NOW(), 'YYYY-MM');

-- Projects API
SELECT 'projects API:' as api_name;
SELECT 
    id,
    name,
    description,
    status,
    created_at
FROM public.projects 
WHERE org_id = public.get_my_org_id()
ORDER BY created_at DESC
LIMIT 5;

-- Documents API
SELECT 'documents API:' as api_name;
SELECT 
    id,
    name,
    description,
    file_type,
    created_at
FROM public.documents 
WHERE org_id = public.get_my_org_id()
ORDER BY created_at DESC
LIMIT 5;

-- Candidates API
SELECT 'candidates API:' as api_name;
SELECT 
    id,
    first_name,
    last_name,
    email,
    status
FROM public.candidates 
WHERE org_id = public.get_my_org_id()
ORDER BY created_at DESC
LIMIT 5;

-- 7. Instructions finales
SELECT '
=== INSTRUCTIONS POUR CORRIGER L''APPLICATION ===

PROBLÈME ACTUEL:
- L''application fait des appels avec org_id=eq.undefined
- Cela cause des erreurs 400 Bad Request

SOLUTION:
1. Au login/refresh, appeler cette fonction:
   const { data } = await supabase.rpc("get_my_org_id")
   
2. Stocker le résultat dans votre state management:
   - Redux: dispatch(setOrgId(data))
   - Context: setOrgId(data)
   - Zustand: setOrgId(data)

3. Utiliser cet ID dans toutes les requêtes:
   Au lieu de: .eq("org_id", undefined)
   Utiliser: .eq("org_id", orgId)

EXEMPLE DE CODE:
```javascript
// Au login
const getOrgId = async () => {
  const { data, error } = await supabase.rpc("get_my_org_id");
  if (data && !error) {
    // Stocker dans le state
    setOrgId(data);
  }
};

// Dans les composants
const fetchUsage = async () => {
  if (!orgId) return;
  
  const { data } = await supabase
    .from("usage_counters")
    .select("*")
    .eq("org_id", orgId)
    .eq("period_month", currentMonth);
};
```

ALTERNATIVE SIMPLE:
Utiliser la vue my_orgs pour récupérer l''ID:
const { data } = await supabase.from("my_orgs").select("id").single();
' as solution_instructions;