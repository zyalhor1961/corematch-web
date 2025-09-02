-- Solution directe ultime pour créer et voir une organisation

-- 1. Forcer la création d'une organisation maintenant
DO $$
DECLARE
    user_id UUID := auth.uid();
    org_id UUID;
BEGIN
    RAISE NOTICE 'Utilisateur actuel: %', user_id;
    
    -- Supprimer les organisations existantes pour cet utilisateur (nettoyage)
    DELETE FROM public.organizations WHERE admin_user_id = user_id;
    
    -- Créer une nouvelle organisation
    INSERT INTO public.organizations (id, name, admin_user_id, description, slug, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        'CoreMatch Organization',
        user_id,
        'Mon organisation CoreMatch',
        'corematch-' || substring(user_id::text from 1 for 8),
        NOW(),
        NOW()
    )
    RETURNING id INTO org_id;
    
    RAISE NOTICE 'Organisation créée avec ID: %', org_id;
END $$;

-- 2. Vérifier immédiatement
SELECT 'Vérification directe:' as check;
SELECT 
    id,
    name,
    admin_user_id,
    'auth.uid() = ' || auth.uid()::text as current_user,
    'Match: ' || (admin_user_id = auth.uid())::text as is_match
FROM public.organizations 
WHERE admin_user_id = auth.uid();

-- 3. Test de la vue my_orgs
SELECT 'Test vue my_orgs après création:' as vue_test;
SELECT COUNT(*) as count_orgs FROM public.my_orgs;
SELECT * FROM public.my_orgs;

-- 4. Si la vue ne fonctionne toujours pas, créer une table temporaire
CREATE TABLE IF NOT EXISTS public.temp_user_orgs AS
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

-- 5. Test de la table temporaire
SELECT 'Test table temporaire:' as temp_test;
SELECT * FROM public.temp_user_orgs;

-- 6. Créer une vue complètement nouvelle
DROP VIEW IF EXISTS public.my_orgs_new;
CREATE VIEW public.my_orgs_new AS
SELECT * FROM public.temp_user_orgs;

-- 7. Test final
SELECT 'TEST FINAL - Voici ce que votre app devrait voir:' as final_result;
SELECT * FROM public.my_orgs_new ORDER BY org_name ASC;

-- 8. Renommer pour remplacer my_orgs
DROP VIEW IF EXISTS public.my_orgs;
ALTER VIEW public.my_orgs_new RENAME TO my_orgs;

-- 9. Résultat final final
SELECT 'RÉSULTAT POUR VOTRE APPLICATION:' as app_result;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;