-- Solution d'urgence finale et propre

-- 1. Vérifier l'état actuel
SELECT 
    auth.uid() as current_user_id,
    (SELECT COUNT(*) FROM public.organizations) as total_organizations,
    (SELECT COUNT(*) FROM public.organizations WHERE organizations.admin_user_id = auth.uid()) as my_organizations;

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

-- 4. Recréer la vue my_orgs proprement
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

-- 5. Créer une fonction de secours sans ambiguïté
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
DECLARE
    current_uid UUID;
BEGIN
    -- Récupérer l'UID de l'utilisateur actuel
    current_uid := auth.uid();
    
    -- S'assurer qu'une organisation existe
    IF NOT EXISTS (
        SELECT 1 FROM public.organizations org
        WHERE org.admin_user_id = current_uid
    ) THEN
        -- Créer une organisation par défaut
        INSERT INTO public.organizations (name, admin_user_id, description)
        VALUES (
            'Organisation par défaut',
            current_uid,
            'Organisation créée automatiquement'
        );
    END IF;
    
    -- Retourner les organisations
    RETURN QUERY
    SELECT 
        org.id,
        org.name as org_name,
        org.slug,
        org.description,
        org.website,
        org.logo_url,
        org.admin_user_id,
        org.created_at,
        org.updated_at
    FROM public.organizations org
    WHERE org.admin_user_id = current_uid;
END;
$$ LANGUAGE plpgsql;

-- 6. Test de la vue
SELECT 'Test de my_orgs:' as test_vue;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;

-- 7. Test de la fonction
SELECT 'Test de get_user_orgs:' as test_fonction;
SELECT * FROM public.get_user_orgs();

-- 8. Résultat final
SELECT 
    'RESULTAT FINAL:' as status,
    COUNT(*) as nombre_organisations,
    string_agg(org_name, ', ') as noms_organisations
FROM public.my_orgs;

-- 9. Simulation de l'appel API exact
SELECT 'Simulation API /my_orgs:' as api_simulation;
SELECT * FROM public.my_orgs ORDER BY org_name ASC;