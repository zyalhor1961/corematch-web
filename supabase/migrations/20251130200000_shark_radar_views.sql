-- ============================================================
-- Shark Radar Views - Saved filter configurations
-- ============================================================
-- Allows users to save their favorite filter combinations
-- and set a default view that loads automatically.
-- ============================================================

-- Create the shark_radar_views table
CREATE TABLE IF NOT EXISTS shark_radar_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,  -- Supabase Auth user ID
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- filters structure:
    -- {
    --   "search_text": "string",
    --   "phases": ["etude", "consultation", "appel_offres", "travaux", "termine"],
    --   "scales": ["Mini", "Small", "Medium", "Large", "Mega"],
    --   "priorities": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    --   "regions": ["Occitanie", "Ile-de-France"],
    --   "cities": ["Toulouse", "Paris"],
    --   "departments": ["31", "75"],
    --   "min_score": 70
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_shark_radar_views_tenant_user
    ON shark_radar_views(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_shark_radar_views_default
    ON shark_radar_views(tenant_id, user_id, is_default)
    WHERE is_default = TRUE;

-- Function to ensure only one default view per user
CREATE OR REPLACE FUNCTION ensure_single_default_radar_view()
RETURNS TRIGGER AS $$
BEGIN
    -- If the new/updated row is being set as default
    IF NEW.is_default = TRUE THEN
        -- Unset any existing default for this tenant+user
        UPDATE shark_radar_views
        SET is_default = FALSE, updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id
          AND user_id = NEW.user_id
          AND id != NEW.id
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for single default enforcement
DROP TRIGGER IF EXISTS trigger_single_default_radar_view ON shark_radar_views;
CREATE TRIGGER trigger_single_default_radar_view
    BEFORE INSERT OR UPDATE OF is_default ON shark_radar_views
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_radar_view();

-- RLS Policies
ALTER TABLE shark_radar_views ENABLE ROW LEVEL SECURITY;

-- Users can only see their own views within their tenant
CREATE POLICY shark_radar_views_select ON shark_radar_views
    FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Users can only insert views for themselves
CREATE POLICY shark_radar_views_insert ON shark_radar_views
    FOR INSERT
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Users can only update their own views
CREATE POLICY shark_radar_views_update ON shark_radar_views
    FOR UPDATE
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Users can only delete their own views
CREATE POLICY shark_radar_views_delete ON shark_radar_views
    FOR DELETE
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Grant service role full access (for backend API)
GRANT ALL ON shark_radar_views TO service_role;

-- Comments
COMMENT ON TABLE shark_radar_views IS 'Saved radar filter configurations per user';
COMMENT ON COLUMN shark_radar_views.filters IS 'JSON object containing filter settings: phases, scales, priorities, regions, cities, min_score, search_text';
COMMENT ON COLUMN shark_radar_views.is_default IS 'Only one view per tenant+user can be default (enforced by trigger)';
