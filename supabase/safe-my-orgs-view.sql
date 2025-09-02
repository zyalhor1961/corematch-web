-- D'abord, voir exactement les colonnes disponibles
SELECT 'Colonnes disponibles dans profiles:' as info;
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Supprimer toutes les vues problématiques
DROP VIEW IF EXISTS public.organization_details CASCADE;
DROP VIEW IF EXISTS public.organization_members_view CASCADE;
DROP VIEW IF EXISTS public.organization_invitations_view CASCADE;
DROP VIEW IF EXISTS public.my_orgs CASCADE;

-- Créer la vue my_orgs de manière très sûre - seulement les colonnes de organizations
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
  o.updated_at,
  CASE 
    WHEN o.admin_user_id = auth.uid() THEN 'admin'
    ELSE COALESCE(om.role, 'member')
  END as user_role,
  CASE 
    WHEN o.admin_user_id = auth.uid() THEN 'accepted'
    ELSE COALESCE(om.status, 'accepted')
  END as membership_status,
  -- Compter les membres
  (SELECT COUNT(*) 
   FROM public.organization_members om2 
   WHERE om2.organization_id = o.id 
   AND om2.status = 'accepted') as member_count,
  -- Compter les invitations en attente  
  (SELECT COUNT(*) 
   FROM public.organization_invitations oi 
   WHERE oi.organization_id = o.id 
   AND oi.status = 'pending' 
   AND oi.expires_at > NOW()) as pending_invitations_count
FROM public.organizations o
LEFT JOIN public.organization_members om ON om.organization_id = o.id 
  AND om.user_id = auth.uid()
WHERE 
  -- L'utilisateur est admin de l'organisation
  o.admin_user_id = auth.uid()
  OR 
  -- L'utilisateur est membre de l'organisation
  (om.user_id = auth.uid() AND om.status = 'accepted');

-- Activer RLS sur la vue
ALTER VIEW public.my_orgs SET (security_invoker = true);

-- Créer une version sûre de organization_details qui ne joint pas profiles
CREATE VIEW public.organization_details AS
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
  -- Statistiques
  (SELECT COUNT(*) 
   FROM public.organization_members om 
   WHERE om.organization_id = o.id 
   AND om.status = 'accepted') as total_members,
  (SELECT COUNT(*) 
   FROM public.organization_invitations oi 
   WHERE oi.organization_id = o.id 
   AND oi.status = 'pending' 
   AND oi.expires_at > NOW()) as pending_invitations,
  -- Rôle de l'utilisateur actuel
  CASE 
    WHEN o.admin_user_id = auth.uid() THEN 'admin'
    ELSE (
      SELECT om.role 
      FROM public.organization_members om 
      WHERE om.organization_id = o.id 
      AND om.user_id = auth.uid() 
      AND om.status = 'accepted'
    )
  END as current_user_role
FROM public.organizations o
WHERE 
  -- L'utilisateur est admin
  o.admin_user_id = auth.uid()
  OR 
  -- L'utilisateur est membre
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = o.id 
    AND om.user_id = auth.uid() 
    AND om.status = 'accepted'
  );

-- Vue simplifiée pour les membres
CREATE VIEW public.organization_members_view AS
SELECT 
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.status,
  om.invited_at,
  om.joined_at,
  om.invited_by,
  -- Référence à l'admin de l'organisation pour les permissions
  o.admin_user_id as org_admin_id
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.organization_id
WHERE 
  -- L'utilisateur peut voir les membres des organisations où il a accès
  o.admin_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM public.organization_members om2
    WHERE om2.organization_id = om.organization_id
    AND om2.user_id = auth.uid()
    AND om2.status = 'accepted'
  );

-- Vue simplifiée pour les invitations
CREATE VIEW public.organization_invitations_view AS
SELECT 
  oi.id,
  oi.organization_id,
  oi.email,
  oi.role,
  oi.token,
  oi.status,
  oi.expires_at,
  oi.created_at,
  oi.invited_by,
  -- Nom de l'organisation
  o.name as org_name
FROM public.organization_invitations oi
JOIN public.organizations o ON o.id = oi.organization_id
WHERE 
  -- Seuls les admins et membres peuvent voir les invitations
  o.admin_user_id = auth.uid()
  OR 
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = oi.organization_id
    AND om.user_id = auth.uid()
    AND om.status = 'accepted'
    AND om.role IN ('admin', 'member')
  );

-- Fonction simple pour obtenir l'organisation principale
CREATE OR REPLACE FUNCTION public.get_user_primary_organization()
RETURNS TABLE (
  id UUID,
  org_name TEXT,
  slug TEXT,
  user_role TEXT,
  is_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name as org_name,
    o.slug,
    CASE 
      WHEN o.admin_user_id = auth.uid() THEN 'admin'
      ELSE COALESCE(om.role, 'member')
    END as user_role,
    (o.admin_user_id = auth.uid()) as is_admin
  FROM public.organizations o
  LEFT JOIN public.organization_members om ON om.organization_id = o.id 
    AND om.user_id = auth.uid()
  WHERE 
    (o.admin_user_id = auth.uid())
    OR 
    (om.user_id = auth.uid() AND om.status = 'accepted')
  ORDER BY 
    -- Prioriser les organisations où l'utilisateur est admin
    CASE WHEN o.admin_user_id = auth.uid() THEN 1 ELSE 2 END,
    o.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tester la vue my_orgs
DO $$
BEGIN
  -- Tester que la vue fonctionne
  PERFORM * FROM public.my_orgs LIMIT 1;
  RAISE NOTICE '✓ Vue my_orgs créée et fonctionnelle';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✗ Erreur avec la vue my_orgs: %', SQLERRM;
END $$;

SELECT 'Vues créées de manière sécurisée!' as message;

-- Vérifier les vues créées
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'VIEW'
AND table_name LIKE '%org%'
ORDER BY table_name;