-- ============================================================================
-- PHASE 1: Admin Graph Management - Database Schema
-- ============================================================================
-- Created: 2025-01-20
-- Purpose: Admin orchestrator for graph workflows, nodes, configs, and executions
-- ============================================================================

-- ============================================================================
-- 1. GRAPHS TABLE
-- ============================================================================
-- Stores workflow definitions (e.g., "CV Analysis Workflow", "Document Processing")
CREATE TABLE IF NOT EXISTS graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  graph_type TEXT NOT NULL, -- 'cv_analysis' | 'document_processing' | 'custom'

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
  is_default BOOLEAN DEFAULT false, -- Is this the default graph for this type?

  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID, -- Link to organization if multi-tenant

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT graphs_name_unique UNIQUE (name),
  CONSTRAINT graphs_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_graphs_type ON graphs(graph_type);
CREATE INDEX IF NOT EXISTS idx_graphs_status ON graphs(status);
CREATE INDEX IF NOT EXISTS idx_graphs_created_by ON graphs(created_by);
CREATE INDEX IF NOT EXISTS idx_graphs_organization ON graphs(organization_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_graphs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER graphs_updated_at
  BEFORE UPDATE ON graphs
  FOR EACH ROW
  EXECUTE FUNCTION update_graphs_updated_at();

COMMENT ON TABLE graphs IS 'Workflow definitions for graph orchestration';
COMMENT ON COLUMN graphs.is_default IS 'Only one graph per type can be default';
COMMENT ON COLUMN graphs.metadata IS 'Flexible metadata (author, version, changelog, etc.)';

-- ============================================================================
-- 2. GRAPH_NODES TABLE
-- ============================================================================
-- Stores individual nodes in a graph (e.g., "extract", "analyze", "consensus")
CREATE TABLE IF NOT EXISTS graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,

  -- Identity
  node_key TEXT NOT NULL, -- Unique key within graph (e.g., "extract", "analyze")
  node_name TEXT NOT NULL, -- Human-readable name
  node_type TEXT NOT NULL, -- 'start' | 'end' | 'process' | 'decision' | 'conditional'

  -- Implementation
  handler_function TEXT NOT NULL, -- Function reference (e.g., "extractCV", "analyzeCV")
  config JSONB DEFAULT '{}', -- Node-specific configuration

  -- Visualization
  position_x INTEGER DEFAULT 0, -- For UI graph visualization
  position_y INTEGER DEFAULT 0,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT graph_nodes_key_unique UNIQUE (graph_id, node_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph ON graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(node_type);

-- Updated timestamp trigger
CREATE TRIGGER graph_nodes_updated_at
  BEFORE UPDATE ON graph_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_graphs_updated_at();

COMMENT ON TABLE graph_nodes IS 'Individual nodes within graph workflows';
COMMENT ON COLUMN graph_nodes.node_key IS 'Unique identifier within graph (used in code)';
COMMENT ON COLUMN graph_nodes.handler_function IS 'Reference to actual implementation function';
COMMENT ON COLUMN graph_nodes.config IS 'Node-specific settings (providers, timeouts, etc.)';

-- ============================================================================
-- 3. GRAPH_EDGES TABLE
-- ============================================================================
-- Stores connections between nodes (defines workflow execution order)
CREATE TABLE IF NOT EXISTS graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,

  -- Conditional routing
  condition_type TEXT DEFAULT 'always', -- 'always' | 'conditional' | 'on_success' | 'on_error'
  condition_expression TEXT, -- JavaScript expression for conditional routing

  -- Priority (for multiple edges from same node)
  priority INTEGER DEFAULT 0,

  -- Metadata
  label TEXT, -- Edge label for visualization
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT graph_edges_no_self_reference CHECK (source_node_id != target_node_id),
  CONSTRAINT graph_edges_condition_check CHECK (
    condition_type IN ('always', 'conditional', 'on_success', 'on_error')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_graph_edges_graph ON graph_edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_node_id);

COMMENT ON TABLE graph_edges IS 'Connections between nodes defining workflow execution order';
COMMENT ON COLUMN graph_edges.condition_expression IS 'JS expression evaluated at runtime (e.g., "state.data.score > 80")';
COMMENT ON COLUMN graph_edges.priority IS 'Higher priority edges evaluated first';

-- ============================================================================
-- 4. GRAPH_CONFIGS TABLE
-- ============================================================================
-- Stores versioned configurations for graphs (providers, budgets, etc.)
CREATE TABLE IF NOT EXISTS graph_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,

  -- Versioning
  version_number INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT false, -- Only one active version per graph

  -- Configuration
  config_json JSONB NOT NULL, -- Complete graph configuration

  -- Changelog
  change_description TEXT,
  changed_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT graph_configs_version_unique UNIQUE (graph_id, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_graph_configs_graph ON graph_configs(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_configs_active ON graph_configs(graph_id, is_active);

COMMENT ON TABLE graph_configs IS 'Versioned configurations for graphs';
COMMENT ON COLUMN graph_configs.config_json IS 'Complete config (providers, budgets, monitoring, etc.)';
COMMENT ON COLUMN graph_configs.is_active IS 'Only one config version can be active per graph';

-- ============================================================================
-- 5. GRAPH_EXECUTIONS TABLE
-- ============================================================================
-- Stores execution history with config snapshots (CRITICAL for reproducibility)
CREATE TABLE IF NOT EXISTS graph_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  graph_id UUID NOT NULL REFERENCES graphs(id),
  config_id UUID REFERENCES graph_configs(id),

  -- Execution context
  execution_mode TEXT NOT NULL, -- 'balanced' | 'cost_optimized' | 'quality_optimized' | 'premium'
  triggered_by TEXT NOT NULL, -- 'api' | 'admin_test' | 'scheduled' | 'webhook'
  triggered_by_user_id UUID REFERENCES auth.users(id),

  -- Input/Output
  input_data JSONB NOT NULL, -- Input passed to graph
  result_data JSONB, -- Final result

  -- Config Snapshots (CRITICAL - freeze at execution time!)
  config_snapshot JSONB NOT NULL, -- Exact config used
  nodes_snapshot JSONB NOT NULL, -- All nodes at execution time
  edges_snapshot JSONB NOT NULL, -- All edges at execution time

  -- Status
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed' | 'cancelled'
  error_message TEXT,
  error_details JSONB,

  -- Metrics
  cost_usd DECIMAL(10, 6), -- Total cost from MonitoringReport
  quality_score DECIMAL(5, 4), -- Overall confidence score
  execution_time_ms INTEGER, -- Total duration
  nodes_executed INTEGER, -- Count of nodes executed

  -- Monitoring Report (from Phase 4)
  monitoring_report JSONB, -- Complete MonitoringReport

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT graph_executions_status_check CHECK (
    status IN ('running', 'completed', 'failed', 'cancelled')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_graph_executions_graph ON graph_executions(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_executions_status ON graph_executions(status);
CREATE INDEX IF NOT EXISTS idx_graph_executions_triggered_by ON graph_executions(triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_graph_executions_started ON graph_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_executions_cost ON graph_executions(cost_usd);

COMMENT ON TABLE graph_executions IS 'Execution history with frozen config snapshots for reproducibility';
COMMENT ON COLUMN graph_executions.config_snapshot IS 'CRITICAL: Frozen config prevents race conditions';
COMMENT ON COLUMN graph_executions.nodes_snapshot IS 'Frozen nodes at execution time';
COMMENT ON COLUMN graph_executions.edges_snapshot IS 'Frozen edges at execution time';
COMMENT ON COLUMN graph_executions.monitoring_report IS 'Complete Phase 4 MonitoringReport JSON';

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get active config for a graph
CREATE OR REPLACE FUNCTION get_active_graph_config(p_graph_id UUID)
RETURNS JSONB AS $$
  SELECT config_json
  FROM graph_configs
  WHERE graph_id = p_graph_id AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_active_graph_config IS 'Returns active config JSON for a graph';

-- Function to create config snapshot for execution
CREATE OR REPLACE FUNCTION create_graph_execution_snapshot(p_graph_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  SELECT jsonb_build_object(
    'graph', (SELECT row_to_json(g) FROM graphs g WHERE g.id = p_graph_id),
    'nodes', (SELECT jsonb_agg(row_to_json(n)) FROM graph_nodes n WHERE n.graph_id = p_graph_id),
    'edges', (SELECT jsonb_agg(row_to_json(e)) FROM graph_edges e WHERE e.graph_id = p_graph_id),
    'config', (SELECT config_json FROM graph_configs WHERE graph_id = p_graph_id AND is_active = true LIMIT 1),
    'snapshot_at', NOW()
  ) INTO v_snapshot;

  RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_graph_execution_snapshot IS 'Creates complete frozen snapshot for execution';

-- ============================================================================
-- 7. SEED DATA
-- ============================================================================
-- Insert default CV Analysis graph

INSERT INTO graphs (id, name, description, graph_type, status, is_default)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'CV Analysis (Multi-Provider)',
  'Production CV analysis workflow with multi-provider consensus',
  'cv_analysis',
  'active',
  true
) ON CONFLICT (name) DO NOTHING;

-- Insert nodes for CV Analysis graph
INSERT INTO graph_nodes (graph_id, node_key, node_name, node_type, handler_function, position_x, position_y, description)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'init', 'Initialize', 'start', 'initializeState', 0, 0, 'Initialize graph state'),
  ('550e8400-e29b-41d4-a716-446655440000', 'cacheCheck', 'Cache Check', 'decision', 'checkCache', 200, 0, 'Check if result is cached'),
  ('550e8400-e29b-41d4-a716-446655440000', 'extract', 'Extract CV', 'process', 'extractCV', 400, 0, 'Extract structured data from CV'),
  ('550e8400-e29b-41d4-a716-446655440000', 'prefilter', 'Prefilter', 'decision', 'prefilterCV', 600, 0, 'Quick relevance check'),
  ('550e8400-e29b-41d4-a716-446655440000', 'analyze', 'Analyze', 'process', 'analyzeCV', 800, 0, 'Multi-provider analysis'),
  ('550e8400-e29b-41d4-a716-446655440000', 'consensus', 'Consensus', 'process', 'buildConsensus', 1000, 0, 'Build consensus from providers'),
  ('550e8400-e29b-41d4-a716-446655440000', 'arbiter', 'Arbiter', 'process', 'arbiterDecision', 1000, 200, 'Arbiter resolves disagreements'),
  ('550e8400-e29b-41d4-a716-446655440000', 'finalize', 'Finalize', 'process', 'finalizeResult', 1200, 0, 'Finalize result'),
  ('550e8400-e29b-41d4-a716-446655440000', 'end', 'End', 'end', 'endState', 1400, 0, 'Complete execution')
ON CONFLICT (graph_id, node_key) DO NOTHING;

-- Insert edges for CV Analysis graph (simplified for now)
WITH node_ids AS (
  SELECT node_key, id FROM graph_nodes WHERE graph_id = '550e8400-e29b-41d4-a716-446655440000'
)
INSERT INTO graph_edges (graph_id, source_node_id, target_node_id, condition_type, priority)
SELECT
  '550e8400-e29b-41d4-a716-446655440000',
  s.id,
  t.id,
  'always',
  0
FROM (VALUES
  ('init', 'cacheCheck'),
  ('cacheCheck', 'extract'),
  ('extract', 'prefilter'),
  ('prefilter', 'analyze'),
  ('analyze', 'consensus'),
  ('consensus', 'finalize'),
  ('finalize', 'end')
) AS edges(source_key, target_key)
JOIN node_ids s ON s.node_key = edges.source_key
JOIN node_ids t ON t.node_key = edges.target_key
ON CONFLICT DO NOTHING;

-- Insert default config
INSERT INTO graph_configs (graph_id, version_number, is_active, config_json, change_description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  true,
  '{
    "providers": {
      "primary": "openai",
      "fallback": ["gemini", "claude"]
    },
    "monitoring": {
      "cost_optimization": {
        "enabled": true,
        "budget": {
          "max_cost_usd": 0.10,
          "warn_threshold_pct": 0.80,
          "mode": "flexible"
        },
        "strategy": {
          "mode": "balanced",
          "fallback_enabled": true
        }
      },
      "quality_assurance": {
        "enabled": true,
        "min_confidence": 0.65,
        "strict_validation": false,
        "auto_flag_low_quality": true
      },
      "performance": {
        "enabled": true,
        "max_duration_ms": 60000,
        "alert_on_slow_node_ms": 10000
      }
    },
    "cache": {
      "enabled": true,
      "ttl_seconds": 3600
    }
  }',
  'Initial production configuration'
) ON CONFLICT (graph_id, version_number) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
