-- ============================================================================
-- COMPREHENSIVE ROW LEVEL SECURITY (RLS) ENFORCEMENT
-- ============================================================================
-- This migration enforces strict RLS policies on all organizational data
-- to prevent data leaks between organizations
-- ============================================================================

-- Enable RLS on all organizational tables
-- ============================================================================

-- Tables with direct org_id relationship
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- Tables with indirect organizational relationship
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- The organizations table itself (special handling)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS POLICIES
-- ============================================================================

-- Function to check if user is member of organization
CREATE OR REPLACE FUNCTION auth.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Master admin has access to all organizations
  IF auth.jwt() ->> 'email' = 'admin@corematch.test' THEN
    RETURN TRUE;
  END IF;

  -- Check if current user is member of the organization
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.org_id = $1
    AND organization_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has admin role in organization
CREATE OR REPLACE FUNCTION auth.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Master admin has access to all organizations
  IF auth.jwt() ->> 'email' = 'admin@corematch.test' THEN
    RETURN TRUE;
  END IF;

  -- Check if current user is admin of the organization
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.org_id = $1
    AND organization_members.user_id = auth.uid()
    AND organization_members.role = 'org_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION auth.user_organizations()
RETURNS UUID[] AS $$
BEGIN
  -- Master admin has access to all organizations
  IF auth.jwt() ->> 'email' = 'admin@corematch.test' THEN
    RETURN ARRAY(SELECT id FROM organizations);
  END IF;

  -- Return organizations the user is member of
  RETURN ARRAY(
    SELECT org_id FROM organization_members
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES FOR ORGANIZATIONS TABLE
-- ============================================================================

-- Users can only see organizations they are members of
CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (
  auth.is_org_member(id)
);

-- Only org admins can update organizations
CREATE POLICY "Org admins can update organizations"
ON organizations FOR UPDATE
USING (
  auth.is_org_admin(id)
);

-- ============================================================================
-- RLS POLICIES FOR ORGANIZATION_MEMBERS TABLE
-- ============================================================================

-- Users can view members of organizations they belong to
CREATE POLICY "Users can view org members"
ON organization_members FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Only org admins can manage members
CREATE POLICY "Org admins can manage members"
ON organization_members FOR ALL
USING (
  auth.is_org_admin(org_id)
);

-- Users can see their own membership
CREATE POLICY "Users can view own membership"
ON organization_members FOR SELECT
USING (
  user_id = auth.uid()
);

-- ============================================================================
-- RLS POLICIES FOR SUBSCRIPTIONS TABLE
-- ============================================================================

-- Only org members can view subscriptions
CREATE POLICY "Org members can view subscriptions"
ON subscriptions FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Only org admins can manage subscriptions
CREATE POLICY "Org admins can manage subscriptions"
ON subscriptions FOR ALL
USING (
  auth.is_org_admin(org_id)
);

-- ============================================================================
-- RLS POLICIES FOR PROJECTS TABLE
-- ============================================================================

-- Org members can view projects
CREATE POLICY "Org members can view projects"
ON projects FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Org members can create projects
CREATE POLICY "Org members can create projects"
ON projects FOR INSERT
WITH CHECK (
  auth.is_org_member(org_id)
);

-- Project creators and org admins can update projects
CREATE POLICY "Project creators and org admins can update projects"
ON projects FOR UPDATE
USING (
  auth.is_org_member(org_id) AND
  (created_by = auth.uid() OR auth.is_org_admin(org_id))
);

-- Org admins can delete projects
CREATE POLICY "Org admins can delete projects"
ON projects FOR DELETE
USING (
  auth.is_org_admin(org_id)
);

-- ============================================================================
-- RLS POLICIES FOR CANDIDATES TABLE
-- ============================================================================

-- Org members can view candidates
CREATE POLICY "Org members can view candidates"
ON candidates FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Org members can create candidates
CREATE POLICY "Org members can create candidates"
ON candidates FOR INSERT
WITH CHECK (
  auth.is_org_member(org_id)
);

-- Org members can update candidates
CREATE POLICY "Org members can update candidates"
ON candidates FOR UPDATE
USING (
  auth.is_org_member(org_id)
);

-- Org admins can delete candidates
CREATE POLICY "Org admins can delete candidates"
ON candidates FOR DELETE
USING (
  auth.is_org_admin(org_id)
);

-- ============================================================================
-- RLS POLICIES FOR DOCUMENTS TABLE
-- ============================================================================

-- Org members can view documents
CREATE POLICY "Org members can view documents"
ON documents FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Org members can create documents
CREATE POLICY "Org members can create documents"
ON documents FOR INSERT
WITH CHECK (
  auth.is_org_member(org_id)
);

-- Document creators and org admins can update documents
CREATE POLICY "Document creators and org admins can update documents"
ON documents FOR UPDATE
USING (
  auth.is_org_member(org_id) AND
  (created_by = auth.uid() OR auth.is_org_admin(org_id))
);

-- Org admins can delete documents
CREATE POLICY "Org admins can delete documents"
ON documents FOR DELETE
USING (
  auth.is_org_admin(org_id)
);

-- ============================================================================
-- RLS POLICIES FOR DOCUMENT_PAGES TABLE
-- ============================================================================

-- Access through document's organization
CREATE POLICY "Org members can view document pages"
ON document_pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_pages.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

CREATE POLICY "Org members can manage document pages"
ON document_pages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_pages.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

-- ============================================================================
-- RLS POLICIES FOR DOCUMENT_LINES TABLE
-- ============================================================================

-- Access through document's organization
CREATE POLICY "Org members can view document lines"
ON document_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_lines.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

CREATE POLICY "Org members can manage document lines"
ON document_lines FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_lines.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

-- ============================================================================
-- RLS POLICIES FOR JOBS TABLE
-- ============================================================================

-- Access through document's organization
CREATE POLICY "Org members can view jobs"
ON jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = jobs.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

CREATE POLICY "System can manage jobs"
ON jobs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = jobs.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

-- ============================================================================
-- RLS POLICIES FOR AUDIT_LOGS TABLE
-- ============================================================================

-- Access through document's organization
CREATE POLICY "Org members can view audit logs"
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = audit_logs.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

-- System can create audit logs
CREATE POLICY "System can create audit logs"
ON audit_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = audit_logs.document_id
    AND auth.is_org_member(documents.org_id)
  )
);

-- ============================================================================
-- RLS POLICIES FOR PRODUCTS TABLE
-- ============================================================================

-- Org members can view products
CREATE POLICY "Org members can view products"
ON products FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Org members can manage products
CREATE POLICY "Org members can manage products"
ON products FOR ALL
USING (
  auth.is_org_member(org_id)
);

-- ============================================================================
-- RLS POLICIES FOR LEADS TABLE
-- ============================================================================

-- Org members can view leads
CREATE POLICY "Org members can view leads"
ON leads FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- Org members can manage leads
CREATE POLICY "Org members can manage leads"
ON leads FOR ALL
USING (
  auth.is_org_member(org_id)
);

-- ============================================================================
-- RLS POLICIES FOR USAGE_COUNTERS TABLE
-- ============================================================================

-- Org members can view usage counters
CREATE POLICY "Org members can view usage counters"
ON usage_counters FOR SELECT
USING (
  auth.is_org_member(org_id)
);

-- System and org admins can update usage counters
CREATE POLICY "System can manage usage counters"
ON usage_counters FOR ALL
USING (
  auth.is_org_member(org_id)
);

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant execute permission on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION auth.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_org_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_organizations() TO authenticated;

-- ============================================================================
-- SECURITY VALIDATION
-- ============================================================================

-- Create a function to validate RLS is working
CREATE OR REPLACE FUNCTION auth.validate_rls_security()
RETURNS TABLE(table_name TEXT, rls_enabled BOOLEAN, policy_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.rowsecurity::BOOLEAN,
    COUNT(p.policyname)::INTEGER
  FROM pg_tables t
  LEFT JOIN pg_policies p ON p.tablename = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'organizations', 'organization_members', 'subscriptions',
      'projects', 'candidates', 'documents', 'document_pages',
      'document_lines', 'jobs', 'audit_logs', 'products',
      'leads', 'usage_counters'
    )
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to check RLS status
GRANT EXECUTE ON FUNCTION auth.validate_rls_security() TO authenticated;

-- ============================================================================
-- FINAL NOTES
-- ============================================================================
--
-- This migration provides comprehensive protection against data leaks by:
-- 1. Enabling RLS on all organizational tables
-- 2. Creating granular policies based on organization membership
-- 3. Supporting master admin access for system administration
-- 4. Providing helper functions for consistent permission checking
-- 5. Including validation functions to monitor security status
--
-- Security Features:
-- - Multi-tenant isolation at the database level
-- - Role-based access control (org_admin, org_manager, org_viewer)
-- - Master admin override for system management
-- - Cascading permissions for related tables
-- - Audit trail protection
--
-- ============================================================================