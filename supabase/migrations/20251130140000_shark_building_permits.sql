-- ============================================================
-- SHARK BUILDING PERMITS - OSINT Permis de Construire
-- ============================================================
-- This migration adds support for building permits (permis de construire)
-- as an OSINT source for early detection of construction/BTP projects.
--
-- Tables:
--   - shark_building_permits: Stores permit data from open data sources
--   - shark_project_permits: Links permits to shark projects
-- ============================================================

-- ============================================================
-- TABLE: shark_building_permits
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_building_permits (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,

    -- External identification
    external_id         text NOT NULL,              -- ID from open data source (e.g., data.gouv)
    reference           text NULL,                  -- Permit reference number (e.g., "PC 075 123 45 67890")

    -- Permit type and status
    permit_type         text NULL,                  -- "PC" (Permis de Construire), "DP" (Declaration Prealable), "PCMI" (PC Maison Individuelle), "PA" (Permis d'Amenager)
    status              text NOT NULL DEFAULT 'filed'
                        CHECK (status IN ('filed', 'accepted', 'refused', 'cancelled', 'unknown')),

    -- Applicant info
    applicant_name      text NULL,                  -- Name of applicant (person, company, municipality...)

    -- Location
    project_address     text NULL,
    city                text NULL,
    postcode            text NULL,
    region              text NULL,
    country             text NOT NULL DEFAULT 'FR',

    -- Project details
    description         text NULL,                  -- Nature of the project
    estimated_surface   numeric NULL,               -- Surface in m²
    estimated_units     integer NULL,               -- Number of housing units if available

    -- Dates
    submission_date     timestamptz NULL,           -- Date de depot
    decision_date       timestamptz NULL,           -- Date de decision (acceptation/refus)

    -- Raw data storage
    raw_data            jsonb NULL,                 -- Full raw record from source

    -- Timestamps
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE shark_building_permits IS 'Building permits (permis de construire) from open data sources for OSINT project detection';
COMMENT ON COLUMN shark_building_permits.permit_type IS 'PC=Permis de Construire, DP=Declaration Prealable, PCMI=PC Maison Individuelle, PA=Permis Amenager';
COMMENT ON COLUMN shark_building_permits.status IS 'filed=deposé, accepted=accordé, refused=refusé, cancelled=annulé, unknown=inconnu';

-- ============================================================
-- INDEXES for shark_building_permits
-- ============================================================

-- Tenant index for RLS
CREATE INDEX IF NOT EXISTS idx_shark_building_permits_tenant
    ON shark_building_permits(tenant_id);

-- Unique constraint per tenant + external_id (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shark_building_permits_external_tenant
    ON shark_building_permits(tenant_id, external_id);

-- Location search indexes
CREATE INDEX IF NOT EXISTS idx_shark_building_permits_city_postcode
    ON shark_building_permits(city, postcode);

CREATE INDEX IF NOT EXISTS idx_shark_building_permits_region
    ON shark_building_permits(region);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_shark_building_permits_status
    ON shark_building_permits(status);

-- Date filtering
CREATE INDEX IF NOT EXISTS idx_shark_building_permits_submission_date
    ON shark_building_permits(submission_date DESC);

CREATE INDEX IF NOT EXISTS idx_shark_building_permits_decision_date
    ON shark_building_permits(decision_date DESC);

-- ============================================================
-- TABLE: shark_project_permits (liaison table)
-- ============================================================

CREATE TABLE IF NOT EXISTS shark_project_permits (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES shark_projects(id) ON DELETE CASCADE,
    permit_id   uuid NOT NULL REFERENCES shark_building_permits(id) ON DELETE CASCADE,

    -- Role of the permit in relation to the project
    role        text NOT NULL CHECK (role IN ('source', 'update')),
                -- 'source' = permit triggered project creation
                -- 'update' = permit was matched to existing project

    -- Additional metadata about the link
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE shark_project_permits IS 'Links building permits to shark projects';
COMMENT ON COLUMN shark_project_permits.role IS 'source=permit created the project, update=permit matched to existing project';

-- ============================================================
-- INDEXES for shark_project_permits
-- ============================================================

-- Project lookup
CREATE INDEX IF NOT EXISTS idx_shark_project_permits_project
    ON shark_project_permits(project_id);

-- Permit lookup
CREATE INDEX IF NOT EXISTS idx_shark_project_permits_permit
    ON shark_project_permits(permit_id);

-- Prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_shark_project_permits_unique
    ON shark_project_permits(project_id, permit_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE shark_building_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_project_permits ENABLE ROW LEVEL SECURITY;

-- Policies for shark_building_permits
CREATE POLICY "shark_building_permits_tenant_isolation"
    ON shark_building_permits
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Policies for shark_project_permits (inherit from project's tenant)
CREATE POLICY "shark_project_permits_tenant_isolation"
    ON shark_project_permits
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM shark_projects p
            WHERE p.id = shark_project_permits.project_id
            AND p.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
    );

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

-- Function (reuse if exists)
CREATE OR REPLACE FUNCTION update_shark_building_permits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_shark_building_permits_updated_at ON shark_building_permits;
CREATE TRIGGER trigger_shark_building_permits_updated_at
    BEFORE UPDATE ON shark_building_permits
    FOR EACH ROW
    EXECUTE FUNCTION update_shark_building_permits_updated_at();

-- ============================================================
-- DONE
-- ============================================================
