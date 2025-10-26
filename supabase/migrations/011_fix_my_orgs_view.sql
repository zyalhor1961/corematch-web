-- Fix my_orgs view to return correct columns
-- Problem: View returns org_id but dashboard expects id
-- Also add missing columns for better functionality

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
  om.role, -- Keep both user_role and role for compatibility
  om.created_at AS membership_created_at
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.org_id
WHERE om.user_id = auth.uid();

-- Set security invoker to use the calling user's permissions
ALTER VIEW public.my_orgs SET (security_invoker = true);

-- Grant permissions
GRANT SELECT ON public.my_orgs TO anon, authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.my_orgs IS 'View that returns organizations for the current authenticated user with their role';
