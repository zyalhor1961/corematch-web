-- Vérifier la structure exacte de la table profiles
SELECT 'Colonnes dans la table profiles:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Supprimer les vues existantes qui peuvent avoir des erreurs
DROP VIEW IF EXISTS public.organization_details CASCADE;
DROP VIEW IF EXISTS public.organization_members_view CASCADE;
DROP VIEW IF EXISTS public.organization_invitations_view CASCADE;
DROP VIEW IF EXISTS public.my_orgs CASCADE;

-- Créer la vue my_orgs SANS utiliser full_name
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
    ELSE om.role
  END as user_role,
  CASE 
    WHEN o.admin_user_id = auth.uid() THEN 'accepted'
    ELSE om.status
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

-- Créer une vue simplifiée pour les détails d'organisation
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
  -- Utiliser seulement les colonnes qui existent
  p.email as admin_email,
  p.avatar_url as admin_avatar,
  p.company_name as admin_company,
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
LEFT JOIN public.profiles p ON p.id = o.admin_user_id
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

-- Vue pour les membres - version simplifiée
CREATE VIEW public.organization_members_view AS
SELECT 
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.status,
  om.invited_at,
  om.joined_at,
  -- Informations du membre (colonnes qui existent)
  p.email,
  p.avatar_url,
  p.company_name,
  -- Informations de qui a invité
  inviter.email as invited_by_email,
  -- Informations de l'organisation
  o.admin_user_id as org_admin_id
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
LEFT JOIN public.profiles inviter ON inviter.id = om.invited_by
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

-- Vue pour les invitations - version simplifiée
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
  -- Informations de l'organisation
  o.name as org_name,
  -- Informations de qui a invité
  p.email as invited_by_email
FROM public.organization_invitations oi
JOIN public.organizations o ON o.id = oi.organization_id
JOIN public.profiles p ON p.id = oi.invited_by
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

-- Test de la vue my_orgs
SELECT 'Test de la vue my_orgs:' as test;
SELECT COUNT(*) as nombre_organisations FROM public.my_orgs;

-- Afficher les vues créées
SELECT 'Vues créées avec succès!' as message;
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE '%org%'
ORDER BY table_name;