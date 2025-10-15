-- =============================================================================
-- STEP 2: CREATE - Create new non-recursive policies
-- =============================================================================
-- Run this AFTER running STEP 1
-- =============================================================================

-- =============================================================================
-- Create helper functions
-- =============================================================================

-- Helper function to check if user is org member
-- Uses SECURITY DEFINER to bypass RLS and prevent recursion
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_member BOOLEAN;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Direct check without triggering RLS on organization_members
    -- SECURITY DEFINER bypasses RLS policies
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE org_id = check_org_id
        AND user_id = current_user_id
    ) INTO is_member;

    RETURN is_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check via organizations.admin_user_id to avoid organization_members recursion
    -- SECURITY DEFINER bypasses RLS policies
    SELECT EXISTS (
        SELECT 1 FROM organizations
        WHERE id = check_org_id
        AND admin_user_id = current_user_id
    ) INTO is_admin;

    RETURN is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;

-- =============================================================================
-- Create policies on organization_members (SIMPLE - NO RECURSION)
-- =============================================================================

-- Users can always see their own memberships (no recursion)
CREATE POLICY "view_own_membership"
    ON organization_members FOR SELECT
    USING (user_id = auth.uid());

-- Organization admins can manage members (checked via organizations.admin_user_id)
CREATE POLICY "admin_manage_members"
    ON organization_members FOR ALL
    USING (public.is_org_admin(org_id));

-- =============================================================================
-- Create policies on organizations
-- =============================================================================

-- Users can see organizations where they are the admin
CREATE POLICY "view_own_organizations"
    ON organizations FOR SELECT
    USING (admin_user_id = auth.uid());

-- Admins can update their organizations
CREATE POLICY "admin_update_organization"
    ON organizations FOR UPDATE
    USING (admin_user_id = auth.uid());

-- Users can insert organizations (they become admin)
CREATE POLICY "insert_organization"
    ON organizations FOR INSERT
    WITH CHECK (admin_user_id = auth.uid());

-- =============================================================================
-- Create policies on projects
-- =============================================================================

CREATE POLICY "view_org_projects"
    ON projects FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "create_org_projects"
    ON projects FOR INSERT
    WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "update_own_or_admin_projects"
    ON projects FOR UPDATE
    USING (
        public.is_org_member(org_id) AND
        (created_by = auth.uid() OR public.is_org_admin(org_id))
    );

CREATE POLICY "admin_delete_projects"
    ON projects FOR DELETE
    USING (public.is_org_admin(org_id));

-- =============================================================================
-- Create policies on candidates
-- =============================================================================

CREATE POLICY "view_org_candidates"
    ON candidates FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "create_org_candidates"
    ON candidates FOR INSERT
    WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "update_org_candidates"
    ON candidates FOR UPDATE
    USING (public.is_org_member(org_id));

CREATE POLICY "admin_delete_candidates"
    ON candidates FOR DELETE
    USING (public.is_org_admin(org_id));

-- =============================================================================
-- Create policies on usage_counters
-- =============================================================================

CREATE POLICY "view_org_usage"
    ON usage_counters FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "manage_org_usage"
    ON usage_counters FOR ALL
    USING (public.is_org_member(org_id));

-- =============================================================================
-- Create policies on subscriptions
-- =============================================================================

CREATE POLICY "view_org_subscriptions"
    ON subscriptions FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "admin_manage_subscriptions"
    ON subscriptions FOR ALL
    USING (public.is_org_admin(org_id));

-- =============================================================================
-- Create policies on leads
-- =============================================================================

CREATE POLICY "view_org_leads"
    ON leads FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "manage_org_leads"
    ON leads FOR ALL
    USING (public.is_org_member(org_id));

-- =============================================================================
-- Ensure RLS is enabled
-- =============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Verification
-- =============================================================================

SELECT
    'New policies created:' as info;

SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organization_members', 'organizations', 'projects',
    'candidates', 'usage_counters', 'subscriptions', 'leads'
)
GROUP BY tablename
ORDER BY tablename;

-- =============================================================================
-- ✅ DONE! Infinite recursion fixed. Test by querying organizations.
-- =============================================================================
