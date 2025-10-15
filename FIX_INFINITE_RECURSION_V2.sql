-- =============================================================================
-- FIX: Infinite Recursion in organization_members RLS Policies - V2
-- =============================================================================
-- This version includes comprehensive cleanup of ALL existing policies
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: COMPREHENSIVE CLEANUP - Drop ALL existing policies
-- =============================================================================

-- Get list of all policies and drop them
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on organization_members
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'organization_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON organization_members', pol.policyname);
    END LOOP;

    -- Drop all policies on organizations
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'organizations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON organizations', pol.policyname);
    END LOOP;

    -- Drop all policies on projects
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'projects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
    END LOOP;

    -- Drop all policies on candidates
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'candidates'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON candidates', pol.policyname);
    END LOOP;

    -- Drop all policies on usage_counters
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'usage_counters'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON usage_counters', pol.policyname);
    END LOOP;

    -- Drop all policies on subscriptions
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'subscriptions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON subscriptions', pol.policyname);
    END LOOP;

    -- Drop all policies on leads
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'leads'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
    END LOOP;

    RAISE NOTICE '✅ All existing policies dropped';
END $$;

-- =============================================================================
-- STEP 2: Drop and recreate helper functions
-- =============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.is_org_member(UUID);
DROP FUNCTION IF EXISTS public.is_org_admin(UUID);
DROP FUNCTION IF EXISTS auth.is_org_member(UUID);
DROP FUNCTION IF EXISTS auth.is_org_admin(UUID);

-- Helper function to check if user is org member
-- Uses SECURITY DEFINER to bypass RLS and prevent recursion
CREATE FUNCTION public.is_org_member(check_org_id UUID)
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
CREATE FUNCTION public.is_org_admin(check_org_id UUID)
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

RAISE NOTICE '✅ Helper functions created';

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

RAISE NOTICE '✅ organization_members policies created';

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

RAISE NOTICE '✅ organizations policies created';

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

RAISE NOTICE '✅ projects policies created';

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

RAISE NOTICE '✅ candidates policies created';

-- Usage counters policies
CREATE POLICY "view_org_usage"
    ON usage_counters FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "manage_org_usage"
    ON usage_counters FOR ALL
    USING (public.is_org_member(org_id));

RAISE NOTICE '✅ usage_counters policies created';

-- Subscriptions policies
CREATE POLICY "view_org_subscriptions"
    ON subscriptions FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "admin_manage_subscriptions"
    ON subscriptions FOR ALL
    USING (public.is_org_admin(org_id));

RAISE NOTICE '✅ subscriptions policies created';

-- Leads policies
CREATE POLICY "view_org_leads"
    ON leads FOR SELECT
    USING (public.is_org_member(org_id));

CREATE POLICY "manage_org_leads"
    ON leads FOR ALL
    USING (public.is_org_member(org_id));

RAISE NOTICE '✅ leads policies created';

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

RAISE NOTICE '✅ RLS enabled on all tables';

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show all policies
SELECT
    'All policies after fix:' as info;

SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
    'organization_members', 'organizations', 'projects',
    'candidates', 'usage_counters', 'subscriptions', 'leads'
)
GROUP BY tablename
ORDER BY tablename;

-- Test query
SELECT 'Testing: Can query organizations now?' as test;

-- =============================================================================
-- ✅ DONE! The infinite recursion should be fixed
-- =============================================================================
