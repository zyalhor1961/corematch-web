-- =============================================================================
-- ⚠️  CRITICAL SECURITY FIX - RUN THIS IN SUPABASE SQL EDITOR
-- =============================================================================
-- VERSION 2: Fixed to work with SQL Editor permissions
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- IDP tables
ALTER TABLE IF EXISTS idp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idp_extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idp_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idp_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idp_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idp_export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idp_export_batch_items ENABLE ROW LEVEL SECURITY;

-- DEB tables (if they exist)
ALTER TABLE IF EXISTS deb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deb_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deb_batch_documents ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 2: CREATE/FIX PROFILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new policies
CREATE POLICY "Users can view all profiles"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- =============================================================================
-- STEP 3: FIX SECURITY DEFINER VIEW
-- =============================================================================

DROP VIEW IF EXISTS deb_article_learning_stats;

CREATE OR REPLACE VIEW deb_article_learning_stats AS
SELECT
    dl.sku,
    dl.description,
    COUNT(*) as occurrence_count,
    MODE() WITHIN GROUP (ORDER BY dl.hs_code) as most_common_hs_code,
    AVG(dl.net_mass_kg) as avg_net_mass_kg,
    MODE() WITHIN GROUP (ORDER BY dl.unit) as most_common_unit
FROM document_lines dl
WHERE dl.hs_code IS NOT NULL
  AND dl.net_mass_kg IS NOT NULL
GROUP BY dl.sku, dl.description
HAVING COUNT(*) >= 2;

GRANT SELECT ON deb_article_learning_stats TO authenticated;

-- =============================================================================
-- STEP 4: DROP OLD CONFLICTING POLICIES
-- =============================================================================

-- Organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Organization admins can update their org" ON organizations;
DROP POLICY IF EXISTS "Org admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Users access their organizations" ON organizations;
DROP POLICY IF EXISTS "Admins update organizations" ON organizations;

-- Projects
DROP POLICY IF EXISTS "Users can view their org projects" ON projects;
DROP POLICY IF EXISTS "Managers can create projects" ON projects;
DROP POLICY IF EXISTS "Managers can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Org members can view projects" ON projects;
DROP POLICY IF EXISTS "Org members can create projects" ON projects;
DROP POLICY IF EXISTS "Project creators and org admins can update projects" ON projects;
DROP POLICY IF EXISTS "Org admins can delete projects" ON projects;
DROP POLICY IF EXISTS "Members view projects" ON projects;
DROP POLICY IF EXISTS "Members create projects" ON projects;
DROP POLICY IF EXISTS "Members update projects" ON projects;
DROP POLICY IF EXISTS "Admins delete projects" ON projects;

-- Candidates
DROP POLICY IF EXISTS "Users can view their org candidates" ON candidates;
DROP POLICY IF EXISTS "Managers can manage candidates" ON candidates;
DROP POLICY IF EXISTS "Org members can view candidates" ON candidates;
DROP POLICY IF EXISTS "Org members can create candidates" ON candidates;
DROP POLICY IF EXISTS "Org members can update candidates" ON candidates;
DROP POLICY IF EXISTS "Org admins can delete candidates" ON candidates;
DROP POLICY IF EXISTS "Members view candidates" ON candidates;
DROP POLICY IF EXISTS "Members create candidates" ON candidates;
DROP POLICY IF EXISTS "Members update candidates" ON candidates;
DROP POLICY IF EXISTS "Admins delete candidates" ON candidates;
DROP POLICY IF EXISTS "Users can access candidates from their org" ON candidates;
DROP POLICY IF EXISTS "Users can manage their organization candidates" ON candidates;

-- Usage counters
DROP POLICY IF EXISTS "Users can view their org usage" ON usage_counters;
DROP POLICY IF EXISTS "System can manage usage counters" ON usage_counters;
DROP POLICY IF EXISTS "Org members can view usage counters" ON usage_counters;
DROP POLICY IF EXISTS "Members view usage" ON usage_counters;
DROP POLICY IF EXISTS "Members manage usage" ON usage_counters;
DROP POLICY IF EXISTS "Users can access usage counters from their org" ON usage_counters;

-- Subscriptions
DROP POLICY IF EXISTS "Users can view their org subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can manage subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Org members can view subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Org admins can manage subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Members view subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions" ON subscriptions;

-- Leads
DROP POLICY IF EXISTS "Users can view their org leads" ON leads;
DROP POLICY IF EXISTS "Managers can manage leads" ON leads;
DROP POLICY IF EXISTS "Org members can view leads" ON leads;
DROP POLICY IF EXISTS "Org members can manage leads" ON leads;
DROP POLICY IF EXISTS "Members view leads" ON leads;
DROP POLICY IF EXISTS "Members manage leads" ON leads;

-- Organization members
DROP POLICY IF EXISTS "Members can view their org memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage org members" ON organization_members;
DROP POLICY IF EXISTS "Users can join organizations when invited" ON organization_members;
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Org admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Members view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins manage org members" ON organization_members;

-- =============================================================================
-- STEP 5: CREATE NEW RLS POLICIES (Using inline checks, no auth.* functions)
-- =============================================================================

-- Organizations policies
-- Users can see organizations they're members of
CREATE POLICY "org_members_select"
    ON organizations FOR SELECT
    USING (
        id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Org admins can update
CREATE POLICY "org_admins_update"
    ON organizations FOR UPDATE
    USING (
        id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Organization members policies
CREATE POLICY "view_org_members"
    ON organization_members FOR SELECT
    USING (
        user_id = auth.uid() OR
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "manage_org_members"
    ON organization_members FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Projects policies
CREATE POLICY "view_projects"
    ON projects FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "create_projects"
    ON projects FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "update_projects"
    ON projects FOR UPDATE
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        ) AND (
            created_by = auth.uid() OR
            org_id IN (
                SELECT org_id FROM organization_members
                WHERE user_id = auth.uid() AND role = 'org_admin'
            )
        )
    );

CREATE POLICY "delete_projects"
    ON projects FOR DELETE
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Candidates policies
CREATE POLICY "view_candidates"
    ON candidates FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "create_candidates"
    ON candidates FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "update_candidates"
    ON candidates FOR UPDATE
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "delete_candidates"
    ON candidates FOR DELETE
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Usage counters policies
CREATE POLICY "view_usage"
    ON usage_counters FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "manage_usage"
    ON usage_counters FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Subscriptions policies
CREATE POLICY "view_subscriptions"
    ON subscriptions FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "manage_subscriptions"
    ON subscriptions FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid() AND role = 'org_admin'
        )
    );

-- Leads policies
CREATE POLICY "view_leads"
    ON leads FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "manage_leads"
    ON leads FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

COMMIT;

-- =============================================================================
-- VERIFICATION - Check RLS status
-- =============================================================================

SELECT
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN (
    'organizations', 'organization_members', 'profiles',
    'projects', 'candidates', 'subscriptions', 'leads',
    'usage_counters', 'documents', 'idp_documents'
)
ORDER BY tablename;

-- =============================================================================
-- ✅ DONE! All tables should show rls_enabled = true
-- =============================================================================
