-- Fix RLS policy to also allow admin_user_id to view their organization
-- Previously only organization_members were allowed

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

-- Create new policy that includes admin_user_id
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    -- User is a member of the organization
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
    OR
    -- User is the admin of the organization
    admin_user_id = auth.uid()
  );

-- Also update the UPDATE policy to include admin_user_id
DROP POLICY IF EXISTS "Organization admins can update their org" ON organizations;

CREATE POLICY "Organization admins can update their org" ON organizations
  FOR UPDATE USING (
    -- User is an org_admin member
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
    OR
    -- User is the admin_user_id
    admin_user_id = auth.uid()
  );
