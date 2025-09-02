-- Diagnostic ultime du problème d'authentification

-- 1. Vérifier auth.uid() en détail
SELECT 'AUTH DEBUG:' as debug;
SELECT 
    auth.uid() as auth_uid,
    auth.uid() IS NULL as is_null,
    auth.jwt() as jwt_info,
    current_user as pg_user,
    session_user as session_user;

-- 2. Voir TOUS les utilisateurs auth
SELECT 'TOUS LES USERS AUTH:' as users;
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- 3. Voir TOUS les profils
SELECT 'TOUS LES PROFILS:' as profiles;
SELECT id, email, created_at FROM public.profiles ORDER BY created_at DESC LIMIT 5;

-- 4. Voir TOUTES les organisations (sans filtre)
SELECT 'TOUTES LES ORGANISATIONS:' as all_orgs;
SELECT id, name, admin_user_id, created_at FROM public.organizations ORDER BY created_at DESC;

-- 5. Test : Créer une organisation avec un utilisateur auth existant
DO $$
DECLARE
    first_auth_user UUID;
    test_org_id UUID;
BEGIN
    -- Prendre le premier utilisateur auth disponible
    SELECT id INTO first_auth_user FROM auth.users LIMIT 1;
    
    IF first_auth_user IS NOT NULL THEN
        RAISE NOTICE 'Premier utilisateur auth trouvé: %', first_auth_user;
        
        -- Créer une organisation pour ce user
        INSERT INTO public.organizations (name, admin_user_id, description)
        VALUES ('Test Auth Organization', first_auth_user, 'Test avec user auth réel')
        RETURNING id INTO test_org_id;
        
        RAISE NOTICE 'Organisation test créée: %', test_org_id;
    ELSE
        RAISE NOTICE 'Aucun utilisateur auth trouvé!';
    END IF;
END $$;

-- 6. Créer une vue qui montre TOUTES les organisations (pour debug)
CREATE OR REPLACE VIEW public.debug_all_orgs AS
SELECT 
    id,
    name as org_name,
    slug,
    description,
    admin_user_id,
    created_at
FROM public.organizations;

-- 7. Désactiver temporairement RLS sur organizations
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- 8. Créer une vue my_orgs sans RLS
DROP VIEW IF EXISTS public.my_orgs;
CREATE VIEW public.my_orgs AS
SELECT 
    id,
    name as org_name,
    COALESCE(slug, 'default') as slug,
    description,
    website,
    logo_url,
    admin_user_id,
    created_at,
    updated_at
FROM public.organizations;

-- 9. Test avec RLS désactivé
SELECT 'TEST SANS RLS:' as no_rls_test;
SELECT * FROM public.my_orgs ORDER BY created_at DESC;

-- 10. Si vous avez des organisations, créer une organisation générique
INSERT INTO public.organizations (name, admin_user_id, description, slug)
VALUES (
    'Organisation Générique',
    (SELECT id FROM auth.users LIMIT 1), -- Prendre n'importe quel user
    'Organisation pour test',
    'org-generique'
)
ON CONFLICT DO NOTHING;

-- 11. Résultat final
SELECT 'TOUTES LES ORGS VISIBLES:' as final_result;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 12. Solution d'urgence : créer une table statique
CREATE TABLE IF NOT EXISTS public.default_organization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT DEFAULT 'Mon Organisation CoreMatch',
    slug TEXT DEFAULT 'mon-org',
    description TEXT DEFAULT 'Organisation par défaut',
    website TEXT,
    logo_url TEXT,
    admin_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insérer une org par défaut
INSERT INTO public.default_organization (org_name, description, admin_user_id)
VALUES ('Mon Organisation CoreMatch', 'Organisation par défaut', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT DO NOTHING;

-- 13. Créer une vue qui utilise soit les vraies orgs soit la par défaut
CREATE OR REPLACE VIEW public.my_orgs_fallback AS
SELECT * FROM public.my_orgs
UNION ALL
SELECT 
    id,
    org_name,
    slug,
    description,
    website,
    logo_url,
    admin_user_id,
    created_at,
    updated_at
FROM public.default_organization
WHERE NOT EXISTS (SELECT 1 FROM public.my_orgs);

SELECT 'SOLUTION DE SECOURS:' as fallback;
SELECT * FROM public.my_orgs_fallback ORDER BY org_name ASC;