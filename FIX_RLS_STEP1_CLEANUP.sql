-- =============================================================================
-- STEP 1: CLEANUP - Drop ALL existing policies
-- =============================================================================
-- Run this first, then run STEP 2
-- =============================================================================

-- Drop ALL policies dynamically
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on organization_members
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'organization_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON organization_members', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on organization_members', pol.policyname;
    END LOOP;

    -- Drop all policies on organizations
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'organizations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON organizations', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on organizations', pol.policyname;
    END LOOP;

    -- Drop all policies on projects
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'projects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on projects', pol.policyname;
    END LOOP;

    -- Drop all policies on candidates
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'candidates'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON candidates', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on candidates', pol.policyname;
    END LOOP;

    -- Drop all policies on usage_counters
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'usage_counters'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON usage_counters', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on usage_counters', pol.policyname;
    END LOOP;

    -- Drop all policies on subscriptions
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'subscriptions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON subscriptions', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on subscriptions', pol.policyname;
    END LOOP;

    -- Drop all policies on leads
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'leads'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
        RAISE NOTICE 'Dropped policy: % on leads', pol.policyname;
    END LOOP;

    RAISE NOTICE '✅ All existing policies dropped';
END $$;

-- Drop old helper functions
DROP FUNCTION IF EXISTS public.is_org_member(UUID);
DROP FUNCTION IF EXISTS public.is_org_admin(UUID);
DROP FUNCTION IF EXISTS auth.is_org_member(UUID);
DROP FUNCTION IF EXISTS auth.is_org_admin(UUID);

-- Verify all policies are gone
SELECT
    'Remaining policies (should be none):' as info;

SELECT
    schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'organization_members', 'organizations', 'projects',
    'candidates', 'usage_counters', 'subscriptions', 'leads'
);

-- =============================================================================
-- ✅ DONE! Now run FIX_RLS_STEP2_CREATE.sql
-- =============================================================================
