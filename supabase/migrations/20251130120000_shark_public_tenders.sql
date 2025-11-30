-- ============================================================
-- SHARK HUNTER - Public Tenders (BOAMP) Schema
-- ============================================================
--
-- This migration adds support for public procurement tenders:
-- - shark_public_tenders: stores tender data from BOAMP/data.gouv
-- - shark_project_tenders: links tenders to Shark projects
--
-- The tender module:
-- 1. Fetches public tenders from BOAMP API
-- 2. Transforms tenders into enriched Shark Projects
-- 3. Links MOA and awarded contractors to shark_organizations
-- 4. Improves scoring based on deadline urgency
--
-- This is an IDEMPOTENT migration - safe to run multiple times.
-- ============================================================


-- ============================================================
-- 1. CREATE shark_public_tenders TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_public_tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Multi-tenant isolation
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- BOAMP identifiers
    external_id TEXT NOT NULL,           -- BOAMP ID (e.g., "24-123456")
    reference TEXT,                       -- Official tender reference

    -- Tender content
    title TEXT,
    description TEXT,
    procedure_type TEXT,                  -- Open, restricted, negotiated, etc.
    cpv_codes JSONB DEFAULT '[]'::JSONB,  -- CPV codes (e.g., ["45000000", "45210000"])

    -- Key dates
    published_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,

    -- Status tracking
    status TEXT CHECK (status IN ('published', 'awarded', 'closed', 'cancelled')) DEFAULT 'published',

    -- Location (extracted from tender)
    location_city TEXT,
    location_region TEXT,
    location_department TEXT,

    -- MOA / Buyer information
    buyer_name TEXT,
    buyer_siret TEXT,

    -- Award information (when status = 'awarded')
    awarded_at TIMESTAMPTZ,
    awarded_amount NUMERIC,
    awarded_currency TEXT DEFAULT 'EUR',

    -- Raw API response for debugging/reprocessing
    raw_data JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Unique constraint: one external_id per tenant
    CONSTRAINT uq_tender_external_id_tenant UNIQUE (tenant_id, external_id)
);

-- Add comments
COMMENT ON TABLE shark_public_tenders IS 'Public procurement tenders from BOAMP and other sources';
COMMENT ON COLUMN shark_public_tenders.external_id IS 'BOAMP identifier (e.g., 24-123456)';
COMMENT ON COLUMN shark_public_tenders.cpv_codes IS 'CPV codes as JSON array (e.g., ["45000000"])';
COMMENT ON COLUMN shark_public_tenders.procedure_type IS 'Procurement procedure type';
COMMENT ON COLUMN shark_public_tenders.status IS 'Tender status: published, awarded, closed, cancelled';


-- ============================================================
-- 2. CREATE shark_project_tenders LINKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_project_tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    project_id UUID NOT NULL REFERENCES shark_projects(id) ON DELETE CASCADE,
    tender_id UUID NOT NULL REFERENCES shark_public_tenders(id) ON DELETE CASCADE,

    -- Role of tender in project context
    role TEXT NOT NULL CHECK (role IN ('source', 'update', 'award_info')),

    -- Additional metadata
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Unique constraint: one project-tender-role combination
    CONSTRAINT uq_project_tender_role UNIQUE (project_id, tender_id, role)
);

COMMENT ON TABLE shark_project_tenders IS 'Links public tenders to Shark projects';
COMMENT ON COLUMN shark_project_tenders.role IS 'source=tender created project, update=tender updated project, award_info=award notification';


-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS idx_shark_tenders_tenant
ON shark_public_tenders (tenant_id);

-- External ID lookup
CREATE INDEX IF NOT EXISTS idx_shark_tenders_external_id
ON shark_public_tenders (external_id);

-- Deadline for urgency queries
CREATE INDEX IF NOT EXISTS idx_shark_tenders_deadline
ON shark_public_tenders (deadline_at)
WHERE deadline_at IS NOT NULL;

-- Status filter
CREATE INDEX IF NOT EXISTS idx_shark_tenders_status
ON shark_public_tenders (tenant_id, status);

-- Published date for recent queries
CREATE INDEX IF NOT EXISTS idx_shark_tenders_published
ON shark_public_tenders (tenant_id, published_at DESC);

-- Project-tender links
CREATE INDEX IF NOT EXISTS idx_shark_project_tenders_project
ON shark_project_tenders (project_id);

CREATE INDEX IF NOT EXISTS idx_shark_project_tenders_tender
ON shark_project_tenders (tender_id);


-- ============================================================
-- 4. ENABLE RLS (Row Level Security)
-- ============================================================

ALTER TABLE shark_public_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_project_tenders ENABLE ROW LEVEL SECURITY;

-- RLS Policy for shark_public_tenders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'shark_public_tenders'
        AND policyname = 'tenant_isolation_tenders'
    ) THEN
        CREATE POLICY tenant_isolation_tenders ON shark_public_tenders
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    END IF;
END $$;

-- RLS Policy for shark_project_tenders (via project's tenant)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'shark_project_tenders'
        AND policyname = 'tenant_isolation_project_tenders'
    ) THEN
        CREATE POLICY tenant_isolation_project_tenders ON shark_project_tenders
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

-- Function to get tenders with approaching deadlines
CREATE OR REPLACE FUNCTION get_urgent_tenders(
    p_tenant_id UUID,
    p_days_ahead INTEGER DEFAULT 14
)
RETURNS TABLE (
    tender_id UUID,
    external_id TEXT,
    title TEXT,
    deadline_at TIMESTAMPTZ,
    days_until_deadline INTEGER,
    project_id UUID,
    project_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id AS tender_id,
        t.external_id,
        t.title,
        t.deadline_at,
        EXTRACT(DAY FROM (t.deadline_at - NOW()))::INTEGER AS days_until_deadline,
        pt.project_id,
        p.name AS project_name
    FROM shark_public_tenders t
    LEFT JOIN shark_project_tenders pt ON pt.tender_id = t.id
    LEFT JOIN shark_projects p ON p.id = pt.project_id
    WHERE t.tenant_id = p_tenant_id
      AND t.status = 'published'
      AND t.deadline_at IS NOT NULL
      AND t.deadline_at > NOW()
      AND t.deadline_at <= NOW() + (p_days_ahead || ' days')::INTERVAL
    ORDER BY t.deadline_at ASC;
END;
$$;

COMMENT ON FUNCTION get_urgent_tenders(UUID, INTEGER)
IS 'Get tenders with deadlines in the next N days';


-- Function to get tenders needing project creation
CREATE OR REPLACE FUNCTION get_unlinked_tenders(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    tender_id UUID,
    external_id TEXT,
    title TEXT,
    published_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    cpv_codes JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id AS tender_id,
        t.external_id,
        t.title,
        t.published_at,
        t.deadline_at,
        t.cpv_codes
    FROM shark_public_tenders t
    LEFT JOIN shark_project_tenders pt ON pt.tender_id = t.id
    WHERE t.tenant_id = p_tenant_id
      AND pt.id IS NULL  -- No project linked
      AND t.status = 'published'
    ORDER BY t.published_at DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_unlinked_tenders(UUID, INTEGER)
IS 'Get tenders that are not yet linked to any project';


-- ============================================================
-- 6. UPDATE shark_projects FOR TENDER SUPPORT
-- ============================================================

-- Add tender-specific columns to shark_projects if not exist
DO $$
BEGIN
    -- is_public_tender: flag to indicate project comes from tender
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'shark_projects' AND column_name = 'is_public_tender') THEN
        ALTER TABLE shark_projects ADD COLUMN is_public_tender BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN shark_projects.is_public_tender IS 'True if project originates from a public tender';
    END IF;

    -- tender_deadline: deadline from linked tender (for scoring)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'shark_projects' AND column_name = 'tender_deadline') THEN
        ALTER TABLE shark_projects ADD COLUMN tender_deadline TIMESTAMPTZ;
        COMMENT ON COLUMN shark_projects.tender_deadline IS 'Deadline from linked public tender';
    END IF;

    -- tender_procedure_type: procedure type from tender
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'shark_projects' AND column_name = 'tender_procedure_type') THEN
        ALTER TABLE shark_projects ADD COLUMN tender_procedure_type TEXT;
        COMMENT ON COLUMN shark_projects.tender_procedure_type IS 'Procedure type from public tender';
    END IF;
END $$;

-- Index for public tender projects
CREATE INDEX IF NOT EXISTS idx_shark_projects_public_tender
ON shark_projects (tenant_id, is_public_tender)
WHERE is_public_tender = TRUE;
