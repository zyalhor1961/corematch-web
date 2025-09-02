-- Corriger la récursion infinie dans les politiques RLS

-- Supprimer toutes les politiques RLS problématiques sur les tables d'organisation
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;

DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;

DROP POLICY IF EXISTS "organization_invitations_select_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update_policy" ON public.organization_invitations;

-- Recréer des politiques RLS SIMPLES sans récursion

-- Politiques pour organizations (très simples)
CREATE POLICY "organizations_access_policy"
  ON public.organizations 
  FOR ALL
  USING (admin_user_id = auth.uid());

-- Politiques pour organization_members (sans référencer organizations)
CREATE POLICY "organization_members_own_access"
  ON public.organization_members 
  FOR ALL
  USING (user_id = auth.uid() OR invited_by = auth.uid());

-- Politiques pour organization_invitations (sans référencer organizations)
CREATE POLICY "organization_invitations_own_access"
  ON public.organization_invitations 
  FOR ALL
  USING (invited_by = auth.uid());

-- Supprimer et recréer la vue my_orgs avec une logique simplifiée
DROP VIEW IF EXISTS public.my_orgs CASCADE;

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
  'admin' as user_role,
  'accepted' as membership_status,
  1 as member_count,
  0 as pending_invitations_count
FROM public.organizations o
WHERE o.admin_user_id = auth.uid();

-- Pas de RLS sur la vue pour éviter les problèmes
-- ALTER VIEW public.my_orgs SET (security_invoker = false);

-- Créer une fonction alternative pour récupérer les organisations
CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS TABLE (
  id UUID,
  org_name TEXT,
  slug TEXT,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  admin_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_role TEXT,
  membership_status TEXT,
  member_count BIGINT,
  pending_invitations_count BIGINT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;
  
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
    o.updated_at,
    'admin'::TEXT as user_role,
    'accepted'::TEXT as membership_status,
    COALESCE((
      SELECT COUNT(*) 
      FROM public.organization_members om 
      WHERE om.organization_id = o.id 
      AND om.status = 'accepted'
    ), 0) as member_count,
    COALESCE((
      SELECT COUNT(*) 
      FROM public.organization_invitations oi 
      WHERE oi.organization_id = o.id 
      AND oi.status = 'pending' 
      AND oi.expires_at > NOW()
    ), 0) as pending_invitations_count
  FROM public.organizations o
  WHERE o.admin_user_id = current_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tester la nouvelle fonction
SELECT 'Test de la fonction get_my_organizations:' as test;
SELECT COUNT(*) as org_count FROM public.get_my_organizations();

-- Tester la vue directement
SELECT 'Test de la vue my_orgs:' as test;
SELECT COUNT(*) as org_count_view FROM public.my_orgs;

-- Alternative: créer une vue très simple
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
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

-- Message de confirmation
SELECT 'Politiques RLS corrigées et vue simplifiée créée!' as message;

-- Vérifier l'état des politiques
SELECT 'Politiques RLS actives:' as info;
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE '%organization%'
ORDER BY tablename, policyname;