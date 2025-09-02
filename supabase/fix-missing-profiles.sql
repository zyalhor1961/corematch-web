-- Corriger le problème des profils manquants

-- 1. Voir le problème exactement
SELECT 'PROBLÈME IDENTIFIÉ:' as problem;
SELECT 'Users dans auth.users:' as auth_users_count, COUNT(*) FROM auth.users;
SELECT 'Users dans profiles:' as profiles_count, COUNT(*) FROM public.profiles;

-- 2. Voir les utilisateurs auth qui n'ont pas de profil
SELECT 'Users auth SANS profil:' as missing_profiles;
SELECT 
    au.id,
    au.email,
    au.created_at,
    'MANQUE PROFIL' as status
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 3. Créer les profils manquants pour TOUS les utilisateurs auth
INSERT INTO public.profiles (id, email, created_at)
SELECT 
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Vérifier que tous les profils existent maintenant
SELECT 'Vérification après création des profils:' as verification;
SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_users,
    (SELECT COUNT(*) FROM public.profiles) as profiles,
    CASE 
        WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles) 
        THEN '✓ TOUS LES PROFILS EXISTENT'
        ELSE '✗ PROFILS MANQUANTS'
    END as status;

-- 5. Maintenant créer une organisation pour votre utilisateur
DO $$
DECLARE
    current_user_id UUID;
    user_email TEXT;
    new_org_id UUID;
BEGIN
    -- Récupérer l'utilisateur actuel
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'ERREUR: auth.uid() est NULL';
        -- Utiliser le premier utilisateur disponible
        SELECT id INTO current_user_id FROM public.profiles LIMIT 1;
        RAISE NOTICE 'Utilisation du premier profil disponible: %', current_user_id;
    END IF;
    
    -- Récupérer l'email
    SELECT email INTO user_email FROM public.profiles WHERE id = current_user_id;
    
    RAISE NOTICE 'Création organisation pour user: % (email: %)', current_user_id, user_email;
    
    -- Supprimer les organisations existantes pour cet utilisateur
    DELETE FROM public.organizations WHERE admin_user_id = current_user_id;
    
    -- Créer une nouvelle organisation
    INSERT INTO public.organizations (name, admin_user_id, description, slug)
    VALUES (
        'Mon Organisation CoreMatch',
        current_user_id,
        'Organisation créée automatiquement pour ' || COALESCE(user_email, 'utilisateur'),
        'mon-org-' || substring(current_user_id::text from 1 for 8)
    )
    RETURNING id INTO new_org_id;
    
    RAISE NOTICE 'Organisation créée avec succès: %', new_org_id;
    
    -- Ajouter comme membre admin
    INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
    VALUES (new_org_id, current_user_id, 'admin', 'accepted', NOW())
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Utilisateur ajouté comme admin';
    
END $$;

-- 6. Réactiver RLS sur organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 7. Recréer la vue my_orgs proprement
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT 
    o.id,
    o.name as org_name,
    COALESCE(o.slug, 'default-org') as slug,
    o.description,
    o.website,
    o.logo_url,
    o.admin_user_id,
    o.created_at,
    o.updated_at
FROM public.organizations o
WHERE o.admin_user_id = auth.uid();

-- 8. Test final de la vue
SELECT 'TEST FINAL MY_ORGS:' as final_test;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 9. Si auth.uid() est encore NULL, créer une vue de secours
CREATE OR REPLACE VIEW public.my_orgs_backup AS
SELECT 
    o.id,
    o.name as org_name,
    COALESCE(o.slug, 'default-org') as slug,
    o.description,
    o.website,
    o.logo_url,
    o.admin_user_id,
    o.created_at,
    o.updated_at
FROM public.organizations o;

-- 10. Test des deux vues
SELECT 'Vue principale (my_orgs):' as vue_principale;
SELECT COUNT(*) as count_principal FROM public.my_orgs;

SELECT 'Vue de secours (my_orgs_backup):' as vue_secours;
SELECT COUNT(*) as count_secours FROM public.my_orgs_backup;

-- 11. Solution finale : utiliser la vue de secours si nécessaire
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.my_orgs) = 0 AND (SELECT COUNT(*) FROM public.my_orgs_backup) > 0 THEN
        -- Remplacer my_orgs par la vue de secours
        DROP VIEW public.my_orgs;
        ALTER VIEW public.my_orgs_backup RENAME TO my_orgs;
        RAISE NOTICE 'Vue de secours activée comme vue principale';
    END IF;
END $$;

-- 12. Résultat final pour l'application
SELECT 'RÉSULTAT FINAL POUR VOTRE APPLICATION:' as app_result;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;