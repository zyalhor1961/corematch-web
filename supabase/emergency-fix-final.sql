-- Solution d'urgence finale sans utiliser company_name

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

-- 4. Vérifier le résultat
SELECT 'Organisations après création:' as info;
SELECT * FROM public.my_orgs;

-- 5. Si ça ne marche toujours pas, créer une vue qui fonctionne à coup sûr
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

-- 6. Test final
SELECT 'Test final de my_orgs:' as test;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 7. Créer également une fonction de secours
CREATE OR REPLACE FUNCTION public.get_user_orgs()
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
    -- S'assurer qu'une organisation existe
    IF NOT EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE admin_user_id = auth.uid()
    ) THEN
        -- Créer une organisation par défaut
        INSERT INTO public.organizations (name, admin_user_id, description)
        VALUES (
            'Organisation par défaut',
            auth.uid(),
            'Organisation créée automatiquement'
        );
    END IF;
    
    -- Retourner les organisations
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

-- 8. Test de la fonction de secours
SELECT 'Test fonction get_user_orgs:' as func_test;
SELECT * FROM public.get_user_orgs();

-- 9. Compter le résultat final
SELECT 
    'Résultat final:' as status,
    COUNT(*) as nombre_organisations_trouvees
FROM public.my_orgs;

-- 10. Afficher le résultat exact que l'API va retourner
SELECT 'API Response:' as api;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;