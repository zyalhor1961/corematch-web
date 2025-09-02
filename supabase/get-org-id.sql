-- Script pour obtenir l'ID d'organisation pour l'application frontend

-- 1. Diagnostic complet
SELECT '=== DIAGNOSTIC AUTH ET ORGANISATIONS ===' as section;

-- Vérifier auth.uid()
SELECT 
    'auth.uid() actuel:' as label,
    COALESCE(auth.uid()::text, 'NULL - PROBLÈME D''AUTH') as auth_uid;

-- Compter les organisations totales
SELECT 
    'Organisations totales:' as label,
    COUNT(*) as count
FROM public.organizations;

-- Voir toutes les organisations avec leurs admin_user_id
SELECT 
    'Toutes les organisations:' as label,
    id,
    name,
    admin_user_id,
    CASE 
        WHEN admin_user_id = auth.uid() THEN 'CETTE ORG M''APPARTIENT ✓'
        ELSE 'Pas à moi'
    END as ownership
FROM public.organizations
ORDER BY created_at DESC;

-- 2. Test de la vue my_orgs
SELECT '=== TEST VUE MY_ORGS ===' as section;
SELECT * FROM public.my_orgs;

-- 3. Créer une fonction simple pour récupérer l'organisation
CREATE OR REPLACE FUNCTION public.get_my_organization()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_record RECORD;
    result JSON;
BEGIN
    -- Récupérer l'organisation de l'utilisateur
    SELECT 
        id,
        name as org_name,
        slug,
        description,
        admin_user_id
    INTO org_record
    FROM public.organizations
    WHERE admin_user_id = auth.uid()
    LIMIT 1;
    
    IF org_record IS NULL THEN
        -- Aucune organisation trouvée, en créer une
        INSERT INTO public.organizations (name, admin_user_id, description, slug)
        VALUES (
            'Mon Organisation CoreMatch',
            auth.uid(),
            'Organisation créée automatiquement',
            'mon-org-' || substring(auth.uid()::text from 1 for 8)
        )
        RETURNING id, name as org_name, slug, description, admin_user_id
        INTO org_record;
    END IF;
    
    -- Construire le JSON de retour
    result := json_build_object(
        'id', org_record.id,
        'name', org_record.org_name,
        'slug', org_record.slug,
        'description', org_record.description,
        'admin_user_id', org_record.admin_user_id
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'error', SQLSTATE,
            'message', SQLERRM,
            'auth_uid', auth.uid()
        );
END;
$$;

-- 4. Test de la fonction
SELECT '=== TEST FONCTION GET_MY_ORGANIZATION ===' as section;
SELECT public.get_my_organization() as my_org_data;

-- 5. Créer une fonction simple qui retourne juste l'ID
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Essayer de récupérer l'ID de l'organisation
    SELECT id INTO org_id
    FROM public.organizations
    WHERE admin_user_id = auth.uid()
    LIMIT 1;
    
    -- Si pas d'organisation, en créer une
    IF org_id IS NULL THEN
        INSERT INTO public.organizations (name, admin_user_id, description, slug)
        VALUES (
            'Mon Organisation CoreMatch',
            auth.uid(),
            'Organisation créée automatiquement',
            'mon-org-' || substring(auth.uid()::text from 1 for 8)
        )
        RETURNING id INTO org_id;
    END IF;
    
    RETURN org_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- 6. Test de la fonction simple
SELECT '=== TEST FONCTION GET_MY_ORG_ID ===' as section;
SELECT 
    'Mon ID d''organisation:' as label,
    public.get_my_org_id() as org_id;

-- 7. Vérifier que les données de test existent
DO $$
DECLARE
    my_org_id UUID;
    current_month TEXT;
BEGIN
    my_org_id := public.get_my_org_id();
    current_month := TO_CHAR(NOW(), 'YYYY-MM');
    
    IF my_org_id IS NOT NULL THEN
        -- Créer des données de test si elles n'existent pas
        INSERT INTO public.usage_counters (org_id, period_month, counter_type, counter_value)
        VALUES 
            (my_org_id, current_month, 'documents_created', 5),
            (my_org_id, current_month, 'projects_created', 3),
            (my_org_id, current_month, 'candidates_added', 12)
        ON CONFLICT (org_id, period_month, counter_type) 
        DO UPDATE SET counter_value = EXCLUDED.counter_value;
        
        INSERT INTO public.projects (org_id, name, description, created_by)
        VALUES 
            (my_org_id, 'Projet Test Dashboard', 'Projet pour tester le dashboard', auth.uid()),
            (my_org_id, 'Campagne Recrutement Q1', 'Recrutement premier trimestre', auth.uid())
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Données de test créées pour organisation: %', my_org_id;
    END IF;
END $$;

-- 8. Test final des APIs que l'application appelle
SELECT '=== SIMULATION DES APPELS API DE L''APPLICATION ===' as section;

-- Simuler l'appel usage_counters
SELECT 'API usage_counters simulation:' as api_call;
SELECT *
FROM public.usage_counters
WHERE org_id = public.get_my_org_id()
AND period_month = TO_CHAR(NOW(), 'YYYY-MM');

-- Simuler l'appel projects
SELECT 'API projects simulation:' as api_call;
SELECT *
FROM public.projects
WHERE org_id = public.get_my_org_id()
ORDER BY created_at DESC;

-- Simuler l'appel documents
SELECT 'API documents simulation:' as api_call;
SELECT *
FROM public.documents
WHERE org_id = public.get_my_org_id()
ORDER BY created_at DESC;

-- 9. Instructions pour l'application frontend
SELECT '=== INSTRUCTIONS POUR LE FRONTEND ===' as instructions;
SELECT '
POUR CORRIGER LE PROBLÈME org_id=undefined :

1. Appeler cette fonction au login: SELECT public.get_my_org_id()
2. Stocker le résultat dans votre état application (Redux/Context)
3. Utiliser cet ID dans toutes les requêtes API

Exemple d''usage:
- Au lieu de: org_id=eq.undefined
- Utiliser: org_id=eq.' || public.get_my_org_id() || '

Ou créer un endpoint qui appelle get_my_organization() pour avoir toutes les infos.
' as solution;