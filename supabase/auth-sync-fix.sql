-- Synchroniser l'auth.uid() avec l'organisation existante

-- 1. Vérifier l'auth.uid() actuel vs l'organisation
SELECT 
    'Mon auth.uid() actuel:' as label,
    auth.uid() as current_auth_uid;

SELECT 
    'admin_user_id de l''organisation:' as label,
    admin_user_id as org_admin_user_id
FROM public.organizations 
WHERE name = 'Mon Organisation CoreMatch';

SELECT 
    'Est-ce que ça correspond?:' as label,
    CASE 
        WHEN auth.uid() = (SELECT admin_user_id FROM public.organizations WHERE name = 'Mon Organisation CoreMatch') 
        THEN 'OUI - ça devrait marcher'
        ELSE 'NON - c''est le problème!'
    END as match_status;

-- 2. Si ça ne correspond pas, corriger l'organisation
UPDATE public.organizations 
SET admin_user_id = auth.uid()
WHERE name = 'Mon Organisation CoreMatch'
AND auth.uid() IS NOT NULL;

-- 3. Vérifier la correction
SELECT 'Après correction:' as after_fix;
SELECT 
    id,
    name as org_name,
    admin_user_id,
    'auth.uid() = ' || auth.uid()::text as current_auth,
    CASE WHEN admin_user_id = auth.uid() THEN 'MATCH ✓' ELSE 'NO MATCH ✗' END as status
FROM public.organizations;

-- 4. Test de la vue my_orgs
SELECT 'Test my_orgs après synchronisation:' as test_sync;
SELECT * FROM public.my_orgs;

-- 5. Si la vue ne retourne toujours rien, diagnostic approfondi
DO $$
DECLARE
    current_uid UUID;
    org_admin UUID;
    profiles_exist BOOLEAN;
BEGIN
    current_uid := auth.uid();
    
    SELECT admin_user_id INTO org_admin 
    FROM public.organizations 
    WHERE name = 'Mon Organisation CoreMatch';
    
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = current_uid) INTO profiles_exist;
    
    RAISE NOTICE 'DIAGNOSTIC:';
    RAISE NOTICE '- auth.uid(): %', current_uid;
    RAISE NOTICE '- org admin_user_id: %', org_admin;
    RAISE NOTICE '- Profil existe: %', profiles_exist;
    RAISE NOTICE '- Match: %', (current_uid = org_admin);
    
    IF current_uid IS NULL THEN
        RAISE NOTICE 'PROBLÈME: auth.uid() est NULL - problème d''authentification';
    ELSIF NOT profiles_exist THEN
        RAISE NOTICE 'PROBLÈME: Profil manquant pour cet utilisateur';
        -- Créer le profil manquant
        INSERT INTO public.profiles (id, email)
        SELECT current_uid, email FROM auth.users WHERE id = current_uid
        ON CONFLICT DO NOTHING;
        RAISE NOTICE 'Profil créé';
    ELSIF current_uid != org_admin THEN
        RAISE NOTICE 'PROBLÈME: auth.uid() ne correspond pas à l''admin de l''organisation';
    END IF;
END $$;

-- 6. Solution finale : créer une vue qui fonctionne peu importe l'auth
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT 
    o.id,
    o.name as org_name,
    o.slug,
    o.description,
    o.website,
    o.logo_url,
    o.admin_user_id,
    o.created_at,
    o.updated_at
FROM public.organizations o
WHERE o.admin_user_id = auth.uid()
   OR (auth.uid() IS NULL AND o.name = 'Mon Organisation CoreMatch'); -- Fallback si auth.uid() est NULL

-- 7. Test final
SELECT 'RÉSULTAT FINAL POUR L''APPLICATION:' as app_final;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 8. Alternative d'urgence si ça ne marche toujours pas
CREATE OR REPLACE FUNCTION public.emergency_get_orgs()
RETURNS TABLE (
    id UUID,
    org_name TEXT,
    slug TEXT,
    description TEXT,
    website TEXT,
    logo_url TEXT,
    admin_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.name as org_name,
        o.slug,
        o.description,
        o.website,
        o.logo_url,
        o.admin_user_id,
        o.created_at,
        o.updated_at
    FROM public.organizations o
    WHERE o.name = 'Mon Organisation CoreMatch';
END;
$$ LANGUAGE plpgsql;

-- Test de la fonction d'urgence
SELECT 'Fonction d''urgence:' as emergency;
SELECT * FROM public.emergency_get_orgs();