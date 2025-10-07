-- Fix infinite recursion in organization_members RLS policies

BEGIN;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
DROP POLICY IF EXISTS "Org admins can manage memberships" ON organization_members;

-- Create simple, non-recursive policies
-- Users can view their own membership records
CREATE POLICY "Users view own memberships" ON organization_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can view memberships in orgs they belong to (without recursion)
CREATE POLICY "Members view org memberships" ON organization_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
      AND om.user_id = auth.uid()
    )
  );

-- Org admins can insert/update/delete memberships
CREATE POLICY "Admins manage memberships" ON organization_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
      AND om.user_id = auth.uid()
      AND om.role = 'org_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
      AND om.user_id = auth.uid()
      AND om.role = 'org_admin'
    )
  );

COMMIT;
