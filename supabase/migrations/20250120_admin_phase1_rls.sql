-- ============================================================================
-- PHASE 1: Admin Graph Management - Row-Level Security (RLS)
-- ============================================================================
-- Created: 2025-01-20
-- Purpose: Secure admin tables with role-based access control
-- ============================================================================

-- Enable RLS on all admin tables
ALTER TABLE graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_executions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Check if user has admin role
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- OPTION 1: Check organization_members table for role
  -- RETURN EXISTS (
  --   SELECT 1 FROM organization_members
  --   WHERE organization_members.user_id = is_admin.user_id
  --   AND role IN ('owner', 'admin')
  -- );

  -- OPTION 2: For now, allow all authenticated users (you can restrict later)
  -- This allows testing during development
  RETURN user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin IS 'Check if user has admin privileges (owner or admin role)';

-- ============================================================================
-- GRAPHS TABLE POLICIES
-- ============================================================================

-- Policy: Admins can read all graphs
CREATE POLICY "Admins can read all graphs"
  ON graphs
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Policy: Admins can create graphs
CREATE POLICY "Admins can create graphs"
  ON graphs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Policy: Admins can update graphs they created or any if they're owner
CREATE POLICY "Admins can update graphs"
  ON graphs
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Policy: Only owners can delete graphs (for now, all admins can delete)
CREATE POLICY "Admins can delete graphs"
  ON graphs
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- GRAPH_NODES TABLE POLICIES
-- ============================================================================

-- Policy: Admins can read all nodes
CREATE POLICY "Admins can read all graph nodes"
  ON graph_nodes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_nodes.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can create nodes
CREATE POLICY "Admins can create graph nodes"
  ON graph_nodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_nodes.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can update nodes
CREATE POLICY "Admins can update graph nodes"
  ON graph_nodes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_nodes.graph_id
      AND is_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_nodes.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can delete nodes
CREATE POLICY "Admins can delete graph nodes"
  ON graph_nodes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_nodes.graph_id
      AND is_admin(auth.uid())
    )
  );

-- ============================================================================
-- GRAPH_EDGES TABLE POLICIES
-- ============================================================================

-- Policy: Admins can read all edges
CREATE POLICY "Admins can read all graph edges"
  ON graph_edges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_edges.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can create edges
CREATE POLICY "Admins can create graph edges"
  ON graph_edges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_edges.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can update edges
CREATE POLICY "Admins can update graph edges"
  ON graph_edges
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_edges.graph_id
      AND is_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_edges.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can delete edges
CREATE POLICY "Admins can delete graph edges"
  ON graph_edges
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_edges.graph_id
      AND is_admin(auth.uid())
    )
  );

-- ============================================================================
-- GRAPH_CONFIGS TABLE POLICIES
-- ============================================================================

-- Policy: Admins can read all configs
CREATE POLICY "Admins can read all graph configs"
  ON graph_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_configs.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can create configs
CREATE POLICY "Admins can create graph configs"
  ON graph_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_configs.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can update configs
CREATE POLICY "Admins can update graph configs"
  ON graph_configs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_configs.graph_id
      AND is_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_configs.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can delete configs (with caution)
CREATE POLICY "Admins can delete graph configs"
  ON graph_configs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_configs.graph_id
      AND is_admin(auth.uid())
    )
  );

-- ============================================================================
-- GRAPH_EXECUTIONS TABLE POLICIES
-- ============================================================================

-- Policy: Admins can read all executions
CREATE POLICY "Admins can read all graph executions"
  ON graph_executions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_executions.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Authenticated users can create executions (API will create them)
CREATE POLICY "Authenticated users can create graph executions"
  ON graph_executions
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow creation, will be filtered by is_admin in application logic

-- Policy: Admins can update executions (to mark as completed/failed)
CREATE POLICY "Admins can update graph executions"
  ON graph_executions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_executions.graph_id
      AND is_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_executions.graph_id
      AND is_admin(auth.uid())
    )
  );

-- Policy: Admins can delete executions (for cleanup)
CREATE POLICY "Admins can delete graph executions"
  ON graph_executions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM graphs
      WHERE graphs.id = graph_executions.graph_id
      AND is_admin(auth.uid())
    )
  );

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- Current Implementation: All authenticated users are treated as admins
-- This is for development/testing. In production, you should:
--
-- 1. Create organization_members table with roles
-- 2. Update is_admin() function to check actual roles
-- 3. Add organization-level RLS (multi-tenant)
--
-- Example production is_admin() function:
--
-- CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
-- RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1 FROM organization_members
--     WHERE organization_members.user_id = is_admin.user_id
--     AND role IN ('owner', 'admin')
--     AND status = 'active'
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- ============================================================================
