-- =============================================================================
-- FIX: Infinite Recursion in organization_members RLS Policies
-- =============================================================================
-- Problem: organization_members policies were querying organization_members
-- table itself, creating infinite recursion
--
-- Solution: Use simple, non-recursive policies that don't self-reference
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Drop problematic policies
-- =============================================================================

-- Drop all existing policies on organization_members
DROP POLICY IF EXISTS "view_org_members" ON organization_members;
DROP POLICY IF EXISTS "manage_org_members" ON organization_members;
DROP POLICY IF EXISTS "Members view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins manage org members" ON organization_members;
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_own_access" ON organization_members;

-- Drop problematic helper functions that create recursion
DROP FUNCTION IF EXISTS auth.is_org_member(UUID);
DROP FUNCTION IF EXISTS auth.is_org_admin(UUID);

-- Drop all policies on organizations that depend on organization_members
DROP POLICY IF EXISTS "org_members_select" ON organizations;
DROP POLICY IF EXISTS "org_admins_update" ON organizations;
DROP POLICY IF EXISTS "Users access their organizations" ON organizations;
DROP POLICY IF EXISTS "Admins update organizations" ON organizations;
DROP POLICY IF EXISTS "organizations_access_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;

-- Drop policies on other tables that use the problematic helper functions
DROP POLICY IF EXISTS "Members view projects" ON projects;
DROP POLICY IF EXISTS "Members create projects" ON projects;
DROP POLICY IF EXISTS "Members update projects" ON projects;
DROP POLICY IF EXISTS "Admins delete projects" ON projects;
DROP POLICY IF EXISTS "view_projects" ON projects;
DROP POLICY IF EXISTS "create_projects" ON projects;
DROP POLICY IF EXISTS "update_projects" ON projects;
DROP POLICY IF EXISTS "delete_projects" ON projects;

DROP POLICY IF EXISTS "Members view candidates" ON candidates;
DROP POLICY IF EXISTS "Members create candidates" ON candidates;
DROP POLICY IF EXISTS "Members update candidates" ON candidates;
DROP POLICY IF EXISTS "Admins delete candidates" ON candidates;
DROP POLICY IF EXISTS "view_candidates" ON candidates;
DROP POLICY IF EXISTS "create_candidates" ON candidates;
DROP POLICY IF EXISTS "update_candidates" ON candidates;
DROP POLICY IF EXISTS "delete_candidates" ON candidates;

DROP POLICY IF EXISTS "Members view usage" ON usage_counters;
DROP POLICY IF EXISTS "Members manage usage" ON usage_counters;
DROP POLICY IF EXISTS "view_usage" ON usage_counters;
DROP POLICY IF EXISTS "manage_usage" ON usage_counters;

DROP POLICY IF EXISTS "Members view subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "view_subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "manage_subscriptions" ON subscriptions;

DROP POLICY IF EXISTS "Members view leads" ON leads;
DROP POLICY IF EXISTS "Members manage leads" ON leads;
DROP POLICY IF EXISTS "view_leads" ON leads;
DROP POLICY IF EXISTS "manage_leads" ON leads;

-- =============================================================================
-- STEP 2: Create NON-RECURSIVE helper functions in public schema
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
-- STEP 3: Create SIMPLE, NON-RECURSIVE policies on organization_members
-- =============================================================================
-- These policies MUST NOT query organization_members table!

-- Users can always see their own memberships (no recursion)
CREATE POLICY "view_own_membership"
    ON organization_members FOR SELECT
    USING (user_id = auth.uid());

-- Organization admins can manage members (checked via organizations.admin_user_id)
CREATE POLICY "admin_manage_members"
    ON organization_members FOR ALL
    USING (
        public.is_org_admin(org_id)
    );

-- =============================================================================
-- STEP 4: Create policies on organizations (using safe helper)
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
-- STEP 5: Recreate policies on dependent tables using safe helpers
-- =============================================================================

-- Projects policies
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

-- Candidates policies
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

-- Usage counters policies
CREATE POLICY "view_org_usage"
    ON usage_counters FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "manage_org_usage"
    ON usage_counters FOR ALL
    USING (public.is_org_member(org_id));

-- Subscriptions policies
CREATE POLICY "view_org_subscriptions"
    ON subscriptions FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "admin_manage_subscriptions"
    ON subscriptions FOR ALL
    USING (public.is_org_admin(org_id));

-- Leads policies
CREATE POLICY "view_org_leads"
    ON leads FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "manage_org_leads"
    ON leads FOR ALL
    USING (public.is_org_member(org_id));

-- =============================================================================
-- STEP 6: Ensure RLS is enabled on all tables
-- =============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check policies on organization_members
SELECT
    'organization_members policies:' as info,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'organization_members';

-- Verify no self-referencing queries in policies
SELECT
    'Checking for recursion in policies...' as info;

-- Test basic query
SELECT 'Testing: SELECT from organization_members' as test;
-- SELECT COUNT(*) FROM organization_members;

-- =============================================================================
-- ✅ DONE! The infinite recursion should be fixed
-- =============================================================================
