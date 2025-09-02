-- Script pour trouver et corriger le problème des organisations manquantes

-- 1. Voir l'utilisateur actuel
SELECT '=== MON ID UTILISATEUR ===' as section;
SELECT auth.uid() as my_user_id;

-- 2. Voir TOUTES les organisations (peu importe le propriétaire)
SELECT '=== TOUTES LES ORGANISATIONS ===' as section;
SELECT 
    id,
    name,
    admin_user_id,
    created_at,
    CASE 
        WHEN admin_user_id = auth.uid() THEN 'C''EST MON ORG'
        ELSE 'PAS MON ORG'
    END as ownership
FROM public.organizations 
ORDER BY created_at DESC;

-- 3. Voir tous les profils utilisateurs
SELECT '=== TOUS LES PROFILS ===' as section;
SELECT id, email FROM public.profiles ORDER BY created_at DESC LIMIT 10;

-- 4. Tester la requête exacte de my_orgs manuellement
SELECT '=== TEST MANUEL MY_ORGS ===' as section;
SELECT 
    id,
    name as org_name,
    slug,
    description,
    website,
    logo_url,
    admin_user_id,
    created_at,
    updated_at
FROM public.organizations
WHERE admin_user_id = auth.uid();

-- 5. Vérifier si auth.uid() est NULL
SELECT '=== VERIFICATION AUTH ===' as section;
SELECT 
    CASE 
        WHEN auth.uid() IS NULL THEN 'PROBLEME: auth.uid() est NULL'
        ELSE 'OK: auth.uid() = ' || auth.uid()::text
    END as auth_status;

-- 6. Solution temporaire : créer une organisation pour l'utilisateur actuel
DO $$
DECLARE
    current_user UUID;
    user_email TEXT;
    new_org_id UUID;
BEGIN
    -- Récupérer l'utilisateur actuel
    current_user := auth.uid();
    
    IF current_user IS NULL THEN
        RAISE NOTICE 'ERREUR: Impossible de récupérer l''utilisateur actuel';
        RETURN;
    END IF;
    
    -- Récupérer l'email de l'utilisateur
    SELECT email INTO user_email FROM public.profiles WHERE id = current_user;
    
    RAISE NOTICE 'Utilisateur actuel: % (email: %)', current_user, COALESCE(user_email, 'email inconnu');
    
    -- Vérifier si l'utilisateur a déjà une organisation
    IF EXISTS (SELECT 1 FROM public.organizations WHERE admin_user_id = current_user) THEN
        RAISE NOTICE 'L''utilisateur a déjà une organisation';
        RETURN;
    END IF;
    
    -- Créer une organisation par défaut pour cet utilisateur
    INSERT INTO public.organizations (name, admin_user_id, slug, description)
    VALUES (
        COALESCE(user_email, 'Mon Organisation') || ' Corp',
        current_user,
        lower(replace(COALESCE(user_email, 'mon-org'), '@', '-at-')),
        'Organisation créée automatiquement'
    )
    RETURNING id INTO new_org_id;
    
    RAISE NOTICE 'Organisation créée avec ID: %', new_org_id;
    
    -- Ajouter l'utilisateur comme membre admin
    INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
    VALUES (new_org_id, current_user, 'admin', 'accepted', NOW())
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Utilisateur ajouté comme admin de l''organisation';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la création: %', SQLERRM;
END $$;

-- 7. Re-tester la vue my_orgs après création
SELECT '=== TEST FINAL MY_ORGS ===' as section;
SELECT * FROM public.my_orgs;

-- 8. Alternative: créer une vue my_orgs encore plus simple
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT 
    id,
    name as org_name,
    COALESCE(slug, lower(replace(name, ' ', '-'))) as slug,
    description,
    website,
    logo_url,
    admin_user_id,
    created_at,
    updated_at
FROM public.organizations
WHERE admin_user_id = auth.uid();

-- 9. Test final
SELECT '=== RESULTAT FINAL ===' as section;
SELECT 
    COUNT(*) as nombre_orgs,
    string_agg(org_name, ', ') as noms_orgs
FROM public.my_orgs;

-- 10. Debug complet de l'API call
SELECT '=== DEBUG API CALL ===' as section;
SELECT 
    'GET /rest/v1/my_orgs?select=*&order=org_name.asc' as api_endpoint,
    COUNT(*) as expected_result_count
FROM public.my_orgs;

SELECT * FROM public.my_orgs ORDER BY org_name ASC;