-- Create insights_queries table for query history and analytics
CREATE TABLE IF NOT EXISTS insights_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    query TEXT NOT NULL,
    result_type VARCHAR(50),
    execution_time_ms INTEGER,
    language VARCHAR(2) DEFAULT 'fr',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT fk_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_insights_queries_org_id ON insights_queries(organization_id);
CREATE INDEX IF NOT EXISTS idx_insights_queries_created_at ON insights_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_queries_query ON insights_queries(query);

-- Enable RLS (Row Level Security)
ALTER TABLE insights_queries ENABLE ROW LEVEL SECURITY;

-- Create policy for organizations to see only their queries
CREATE POLICY insights_queries_org_policy ON insights_queries
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

COMMENT ON TABLE insights_queries IS 'Stores history of all insights queries for analytics and popular query suggestions';
COMMENT ON COLUMN insights_queries.query IS 'The natural language question asked by the user';
COMMENT ON COLUMN insights_queries.result_type IS 'Type of visualization: table, bar_chart, line_chart, pie_chart, metric';
COMMENT ON COLUMN insights_queries.execution_time_ms IS 'Query execution time in milliseconds';
COMMENT ON COLUMN insights_queries.language IS 'Language of the query: fr or en';
