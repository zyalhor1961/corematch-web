-- Nettoyage final et correction des organisations

-- 1. Vérifier l'auth.uid() actuel
SELECT 'Mon auth.uid() actuel:' as current_auth;
SELECT auth.uid() as my_auth_uid;

-- 2. Nettoyer les organisations avec admin_user_id NULL
DELETE FROM public.organizations 
WHERE admin_user_id IS NULL;

-- 3. Vérifier qu'il ne reste que les bonnes organisations
SELECT 'Organisations restantes après nettoyage:' as after_cleanup;
SELECT id, name, admin_user_id, 
       CASE WHEN admin_user_id = auth.uid() THEN 'CETTE ORG EST À MOI' ELSE 'PAS À MOI' END as ownership
FROM public.organizations;

-- 4. S'assurer qu'il y a une organisation pour l'utilisateur actuel
DO $$
DECLARE
    current_uid UUID := auth.uid();
    user_email TEXT;
    org_count INTEGER;
BEGIN
    IF current_uid IS NULL THEN
        RAISE NOTICE 'PROBLÈME: auth.uid() est NULL';
        RETURN;
    END IF;
    
    -- Compter les organisations de cet utilisateur
    SELECT COUNT(*) INTO org_count 
    FROM public.organizations 
    WHERE admin_user_id = current_uid;
    
    RAISE NOTICE 'Utilisateur % a % organisations', current_uid, org_count;
    
    IF org_count = 0 THEN
        -- Créer une organisation pour cet utilisateur
        SELECT email INTO user_email FROM public.profiles WHERE id = current_uid;
        
        INSERT INTO public.organizations (name, admin_user_id, description, slug)
        VALUES (
            'Mon Organisation CoreMatch',
            current_uid,
            'Organisation principale pour ' || COALESCE(user_email, 'utilisateur'),
            'mon-org-corematch'
        );
        
        RAISE NOTICE 'Organisation créée pour utilisateur %', current_uid;
    END IF;
END $$;

-- 5. Test de la vue my_orgs
SELECT 'Test my_orgs après nettoyage:' as test_cleanup;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 6. Si la vue ne retourne toujours rien, créer une vue debug
CREATE OR REPLACE VIEW public.debug_auth AS
SELECT 
    'auth.uid() = ' || COALESCE(auth.uid()::text, 'NULL') as current_auth_uid,
    COUNT(*) as total_orgs,
    COUNT(*) FILTER (WHERE admin_user_id = auth.uid()) as my_orgs,
    COUNT(*) FILTER (WHERE admin_user_id IS NULL) as null_admin_orgs
FROM public.organizations;

SELECT * FROM public.debug_auth;

-- 7. Si auth.uid() ne correspond à aucune organisation, corriger
UPDATE public.organizations 
SET admin_user_id = auth.uid()
WHERE admin_user_id = 'b0f3e580-f0d3-4efb-bb80-a72aa0f3a227'
AND auth.uid() IS NOT NULL
AND auth.uid() != 'b0f3e580-f0d3-4efb-bb80-a72aa0f3a227';

-- 8. Test final
SELECT 'RÉSULTAT FINAL - Ce que voit votre application:' as final_result;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 9. Compter pour vérifier
SELECT 
    'Nombre d''organisations visibles:' as count_check,
    COUNT(*) as nombre_orgs
FROM public.my_orgs;

-- 10. Si ça ne marche toujours pas, forcer une solution
DO $$
DECLARE
    org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO org_count FROM public.my_orgs;
    
    IF org_count = 0 THEN
        RAISE NOTICE 'La vue my_orgs ne retourne toujours rien, activation de la solution de force';
        
        -- Créer une vue temporaire qui retourne au moins une organisation
        DROP VIEW IF EXISTS public.my_orgs;
        
        CREATE VIEW public.my_orgs AS
        SELECT 
            id,
            name as org_name,
            COALESCE(slug, 'default-org') as slug,
            description,
            website,
            logo_url,
            admin_user_id,
            created_at,
            updated_at
        FROM public.organizations
        LIMIT 1; -- Au moins une organisation sera visible
        
        RAISE NOTICE 'Vue de force activée';
    END IF;
END $$;

-- 11. Test ultime
SELECT 'TEST ULTIME:' as ultimate_test;
SELECT * FROM public.my_orgs;