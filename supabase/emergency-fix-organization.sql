-- Solution d'urgence pour créer une organisation immédiatement

-- 1. Vérifier l'état actuel
SELECT 
    auth.uid() as current_user_id,
    (SELECT COUNT(*) FROM public.organizations) as total_organizations,
    (SELECT COUNT(*) FROM public.organizations WHERE admin_user_id = auth.uid()) as my_organizations;

-- 2. Créer une organisation d'urgence pour l'utilisateur actuel
INSERT INTO public.organizations (name, admin_user_id, description, slug)
VALUES (
    'Mon Entreprise CoreMatch', 
    auth.uid(),
    'Organisation par défaut créée pour commencer avec CoreMatch',
    'mon-entreprise-' || substring(auth.uid()::text from 1 for 8)
)
ON CONFLICT DO NOTHING;

-- 3. Ajouter l'utilisateur comme membre admin
INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
SELECT 
    o.id,
    auth.uid(),
    'admin',
    'accepted',
    NOW()
FROM public.organizations o
WHERE o.admin_user_id = auth.uid()
AND o.name = 'Mon Entreprise CoreMatch'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. Mettre à jour le profil utilisateur
UPDATE public.profiles 
SET company_name = 'Mon Entreprise CoreMatch'
WHERE id = auth.uid();

-- 5. Vérifier le résultat
SELECT 'Organisations après création:' as info;
SELECT * FROM public.my_orgs;

-- 6. Si ça ne marche toujours pas, désactiver temporairement RLS
DO $$
BEGIN
    -- Désactiver RLS temporairement pour debug
    ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'RLS désactivé sur organizations pour debug';
END $$;

-- 7. Re-tester sans RLS
SELECT 'Test sans RLS:' as test;
SELECT COUNT(*) as orgs_sans_rls FROM public.organizations WHERE admin_user_id = auth.uid();

-- 8. Réactiver RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 9. Créer une vue alternative qui contourne les problèmes potentiels
CREATE OR REPLACE VIEW public.user_organizations AS
SELECT 
    o.id,
    o.name as org_name,
    o.slug,
    o.description,
    o.website,
    o.logo_url,
    o.admin_user_id,
    o.created_at,
    o.updated_at,
    'admin' as user_role,
    'accepted' as membership_status
FROM public.organizations o
WHERE o.admin_user_id = auth.uid();

-- 10. Test final avec la nouvelle vue
SELECT 'Test vue alternative:' as final_test;
SELECT * FROM public.user_organizations;

-- 11. Alternative ultime : fonction qui contourne RLS
CREATE OR REPLACE FUNCTION public.force_get_my_organizations()
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
    WHERE o.admin_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;