-- ============================================================
-- SHARK HUNTER - Building Permits (Permis de Construire) Schema
-- ============================================================
--
-- This migration adds support for building permits:
-- - shark_building_permits: stores permit data from data.gouv/local sources
-- - shark_project_permits: links permits to Shark projects
--
-- The permits module:
-- 1. Fetches building permits from data.gouv open data
-- 2. Transforms permits into early-stage Shark Projects
-- 3. Links applicants (developers/promoters) to shark_organizations
-- 4. Enables very early project detection
--
-- This is an IDEMPOTENT migration - safe to run multiple times.
-- ============================================================


-- ============================================================
-- 1. CREATE shark_building_permits TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_building_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Multi-tenant isolation
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Permit identifiers
    external_id TEXT NOT NULL,            -- data.gouv / municipal ID
    reference TEXT,                        -- Official permit reference (PC-XXXXX)

    -- Permit type
    permit_type TEXT,                      -- PC, DP, PCMI, PA, etc.

    -- Status tracking
    status TEXT NOT NULL CHECK (status IN ('filed', 'accepted', 'refused', 'cancelled', 'unknown')) DEFAULT 'filed',

    -- Applicant information
    applicant_name TEXT,                   -- Name of applicant (person or company)

    -- Location
    project_address TEXT,
    city TEXT,
    postcode TEXT,
    region TEXT,
    country TEXT DEFAULT 'FR',

    -- Project description
    description TEXT,

    -- Estimated metrics
    estimated_surface NUMERIC,             -- Surface in m²
    estimated_units INTEGER,               -- Number of housing units

    -- Key dates
    submission_date TIMESTAMPTZ,           -- Date filed
    decision_date TIMESTAMPTZ,             -- Date of decision

    -- Raw data for debugging/reprocessing
    raw_data JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Unique constraint: one external_id per tenant
    CONSTRAINT uq_permit_external_id_tenant UNIQUE (tenant_id, external_id)
);

-- Add comments
COMMENT ON TABLE shark_building_permits IS 'Building permits from data.gouv and local sources';
COMMENT ON COLUMN shark_building_permits.permit_type IS 'Permit type: PC (Permis de Construire), DP (Declaration Prealable), PCMI, PA, etc.';
COMMENT ON COLUMN shark_building_permits.status IS 'Permit status: filed, accepted, refused, cancelled, unknown';
COMMENT ON COLUMN shark_building_permits.estimated_surface IS 'Estimated surface area in square meters';
COMMENT ON COLUMN shark_building_permits.estimated_units IS 'Number of housing units (for residential projects)';


-- ============================================================
-- 2. CREATE shark_project_permits LINKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_project_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    project_id UUID NOT NULL REFERENCES shark_projects(id) ON DELETE CASCADE,
    permit_id UUID NOT NULL REFERENCES shark_building_permits(id) ON DELETE CASCADE,

    -- Role of permit in project context
    role TEXT NOT NULL CHECK (role IN ('source', 'update')),

    -- Additional metadata
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Unique constraint: one project-permit-role combination
    CONSTRAINT uq_project_permit_role UNIQUE (project_id, permit_id, role)
);

COMMENT ON TABLE shark_project_permits IS 'Links building permits to Shark projects';
COMMENT ON COLUMN shark_project_permits.role IS 'source=permit created project, update=permit updated existing project';


-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS idx_shark_permits_tenant
ON shark_building_permits (tenant_id);

-- External ID lookup
CREATE INDEX IF NOT EXISTS idx_shark_permits_external_id
ON shark_building_permits (external_id);

-- City + postcode for geographic queries
CREATE INDEX IF NOT EXISTS idx_shark_permits_city_postcode
ON shark_building_permits (city, postcode);

-- Status filter
CREATE INDEX IF NOT EXISTS idx_shark_permits_status
ON shark_building_permits (tenant_id, status);

-- Submission date for recent queries
CREATE INDEX IF NOT EXISTS idx_shark_permits_submission
ON shark_building_permits (tenant_id, submission_date DESC)
WHERE submission_date IS NOT NULL;

-- Decision date for recent decisions
CREATE INDEX IF NOT EXISTS idx_shark_permits_decision
ON shark_building_permits (tenant_id, decision_date DESC)
WHERE decision_date IS NOT NULL;

-- Project-permit links
CREATE INDEX IF NOT EXISTS idx_shark_project_permits_project
ON shark_project_permits (project_id);

CREATE INDEX IF NOT EXISTS idx_shark_project_permits_permit
ON shark_project_permits (permit_id);


-- ============================================================
-- 4. ENABLE RLS (Row Level Security)
-- ============================================================

ALTER TABLE shark_building_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_project_permits ENABLE ROW LEVEL SECURITY;

-- RLS Policy for shark_building_permits
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'shark_building_permits'
        AND policyname = 'tenant_isolation_permits'
    ) THEN
        CREATE POLICY tenant_isolation_permits ON shark_building_permits
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
END $$;

-- RLS Policy for shark_project_permits (via project's tenant)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'shark_project_permits'
        AND policyname = 'tenant_isolation_project_permits'
    ) THEN
        CREATE POLICY tenant_isolation_project_permits ON shark_project_permits
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM shark_projects p
                    WHERE p.id = project_id
                    AND p.tenant_id = current_setting('app.tenant_id', true)::uuid
                )
            );
    END IF;
END $$;


-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Function to get recent permits with project links
CREATE OR REPLACE FUNCTION get_recent_permits(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    permit_id UUID,
    external_id TEXT,
    reference TEXT,
    permit_type TEXT,
    status TEXT,
    applicant_name TEXT,
    city TEXT,
    postcode TEXT,
    description TEXT,
    estimated_surface NUMERIC,
    estimated_units INTEGER,
    submission_date TIMESTAMPTZ,
    decision_date TIMESTAMPTZ,
    project_id UUID,
    project_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS permit_id,
        p.external_id,
        p.reference,
        p.permit_type,
        p.status,
        p.applicant_name,
        p.city,
        p.postcode,
        p.description,
        p.estimated_surface,
        p.estimated_units,
        p.submission_date,
        p.decision_date,
        pp.project_id,
        proj.name AS project_name
    FROM shark_building_permits p
    LEFT JOIN shark_project_permits pp ON pp.permit_id = p.id
    LEFT JOIN shark_projects proj ON proj.id = pp.project_id
    WHERE p.tenant_id = p_tenant_id
      AND (
          p.submission_date >= NOW() - (p_days || ' days')::INTERVAL
          OR p.decision_date >= NOW() - (p_days || ' days')::INTERVAL
      )
    ORDER BY COALESCE(p.decision_date, p.submission_date) DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_recent_permits(UUID, INTEGER, INTEGER)
IS 'Get recent permits with optional project links';


-- Function to get permits for a specific city
CREATE OR REPLACE FUNCTION get_permits_by_city(
    p_tenant_id UUID,
    p_city TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    permit_id UUID,
    external_id TEXT,
    permit_type TEXT,
    status TEXT,
    applicant_name TEXT,
    description TEXT,
    estimated_surface NUMERIC,
    submission_date TIMESTAMPTZ,
    decision_date TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS permit_id,
        p.external_id,
        p.permit_type,
        p.status,
        p.applicant_name,
        p.description,
        p.estimated_surface,
        p.submission_date,
        p.decision_date
    FROM shark_building_permits p
    WHERE p.tenant_id = p_tenant_id
      AND LOWER(p.city) = LOWER(p_city)
    ORDER BY p.submission_date DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_permits_by_city(UUID, TEXT, INTEGER)
IS 'Get permits for a specific city';


-- ============================================================
-- 6. UPDATE shark_projects FOR PERMIT SUPPORT
-- ============================================================

-- Add permit-specific columns to shark_projects if not exist
DO $$
BEGIN
    -- is_from_permit: flag to indicate project comes from building permit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'shark_projects' AND column_name = 'is_from_permit') THEN
        ALTER TABLE shark_projects ADD COLUMN is_from_permit BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN shark_projects.is_from_permit IS 'True if project originates from a building permit';
    END IF;

    -- permit_status: status of linked permit (filed, accepted, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'shark_projects' AND column_name = 'permit_status') THEN
        ALTER TABLE shark_projects ADD COLUMN permit_status TEXT;
        COMMENT ON COLUMN shark_projects.permit_status IS 'Status of linked permit: filed, accepted, refused, etc.';
    END IF;

    -- estimated_surface_m2: surface from permit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'shark_projects' AND column_name = 'estimated_surface_m2') THEN
        ALTER TABLE shark_projects ADD COLUMN estimated_surface_m2 NUMERIC;
        COMMENT ON COLUMN shark_projects.estimated_surface_m2 IS 'Estimated surface area from permit in m²';
    END IF;
END $$;

-- Index for permit-based projects
CREATE INDEX IF NOT EXISTS idx_shark_projects_from_permit
ON shark_projects (tenant_id, is_from_permit)
WHERE is_from_permit = TRUE;
