-- ============================================================
-- SHARK TENANT SETTINGS
-- ============================================================
-- Configuration par tenant pour Shark Hunter :
-- - Zone geographique de veille
-- - Parametres de scan
-- - Tracking du Welcome Scan
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_tenant_settings (
    -- Primary key = tenant/org
    tenant_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

    -- Geographic zone
    city TEXT,
    region TEXT,
    country TEXT DEFAULT 'FR',
    lat NUMERIC(10, 6),
    lon NUMERIC(10, 6),
    search_radius_km INTEGER DEFAULT 50,

    -- Shark module settings
    shark_enabled BOOLEAN DEFAULT true,
    daily_url_limit INTEGER DEFAULT 10,  -- Max URLs per daily run

    -- Welcome Scan tracking
    welcome_scan_done_at TIMESTAMPTZ,
    welcome_scan_projects_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shark_tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Org members can view their org's Shark settings
CREATE POLICY "Members can view their org shark settings" ON shark_tenant_settings
    FOR SELECT USING (
        tenant_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
    );

-- INSERT: Only org_admin can create Shark settings
CREATE POLICY "Admins can create shark settings" ON shark_tenant_settings
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
    );

-- UPDATE: Only org_admin can update Shark settings
CREATE POLICY "Admins can update shark settings" ON shark_tenant_settings
    FOR UPDATE USING (
        tenant_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
    );

-- DELETE: Only org_admin can delete Shark settings
CREATE POLICY "Admins can delete shark settings" ON shark_tenant_settings
    FOR DELETE USING (
        tenant_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
    );

-- Service role bypass (for Python backend)
CREATE POLICY "Service role full access" ON shark_tenant_settings
    FOR ALL USING (auth.role() = 'service_role');

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_shark_tenant_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shark_tenant_settings_updated_at
    BEFORE UPDATE ON shark_tenant_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_shark_tenant_settings_timestamp();

-- Indexes
CREATE INDEX idx_shark_tenant_settings_enabled ON shark_tenant_settings(shark_enabled) WHERE shark_enabled = true;
CREATE INDEX idx_shark_tenant_settings_city ON shark_tenant_settings(city) WHERE city IS NOT NULL;
CREATE INDEX idx_shark_tenant_settings_region ON shark_tenant_settings(region) WHERE region IS NOT NULL;

-- Comments
COMMENT ON TABLE shark_tenant_settings IS 'Per-tenant configuration for Shark Hunter module';
COMMENT ON COLUMN shark_tenant_settings.city IS 'Target city for BTP project discovery';
COMMENT ON COLUMN shark_tenant_settings.region IS 'Target region for BTP project discovery';
COMMENT ON COLUMN shark_tenant_settings.search_radius_km IS 'Search radius around city/coordinates in km';
COMMENT ON COLUMN shark_tenant_settings.shark_enabled IS 'Whether Shark Hunter is enabled for this tenant';
COMMENT ON COLUMN shark_tenant_settings.daily_url_limit IS 'Max URLs to process per daily run';
COMMENT ON COLUMN shark_tenant_settings.welcome_scan_done_at IS 'Timestamp of completed welcome scan';
COMMENT ON COLUMN shark_tenant_settings.welcome_scan_projects_count IS 'Number of projects created during welcome scan';
