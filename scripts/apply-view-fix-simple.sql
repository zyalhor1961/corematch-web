-- Simple SQL script to fix my_orgs view
-- Run this in Supabase SQL Editor

DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT
  o.id,
  o.name AS org_name,
  o.plan,
  o.status,
  o.trial_end_date,
  o.created_at,
  om.role AS user_role,
  om.role,
  om.created_at AS membership_created_at
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.org_id
WHERE om.user_id = auth.uid();

ALTER VIEW public.my_orgs SET (security_invoker = true);
GRANT SELECT ON public.my_orgs TO anon, authenticated;
