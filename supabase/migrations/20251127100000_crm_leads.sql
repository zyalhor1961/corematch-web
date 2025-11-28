-- CRM Leads Kanban + Organizations Status
-- Migration: 20251127100000_crm_leads.sql

-- =====================================================
-- 1. Add status column to organizations table
-- =====================================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add check constraint separately (if not exists pattern)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organizations_status_check'
    ) THEN
        ALTER TABLE organizations
        ADD CONSTRAINT organizations_status_check
        CHECK (status IN ('active', 'trial', 'suspended', 'cancelled'));
    END IF;
END $$;

-- Update existing rows to have a default status based on plan
UPDATE organizations
SET status = CASE
    WHEN plan = 'trial' THEN 'trial'
    ELSE 'active'
END
WHERE status IS NULL;

COMMENT ON COLUMN organizations.status IS 'Organization status: active, trial, suspended, cancelled';

-- =====================================================
-- 2. Leads table (CRM Pipeline)
-- =====================================================

CREATE TABLE IF NOT EXISTS leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    company_name text NOT NULL,
    website text,
    logo_url text,
    contact_name text,
    contact_email text,
    contact_phone text,
    status text DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
    potential_value numeric DEFAULT 0,
    probability int DEFAULT 20 CHECK (probability >= 0 AND probability <= 100),
    currency text DEFAULT 'EUR',
    ai_summary text,
    ai_next_action text,
    last_activity_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- 3. Lead activities table (timeline/history)
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_activities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
    activity_type text NOT NULL CHECK (activity_type IN ('note', 'email', 'call', 'meeting', 'status_change')),
    content text NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- 4. Indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);

-- =====================================================
-- 5. Triggers
-- =====================================================

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_updated_at();

-- Trigger to update last_activity_at when activity is added
CREATE OR REPLACE FUNCTION update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE leads
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.lead_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_activity_update_last_activity ON lead_activities;
CREATE TRIGGER lead_activity_update_last_activity
    AFTER INSERT ON lead_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_last_activity();

-- Trigger to log status changes automatically
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO lead_activities (lead_id, activity_type, content, created_by)
        VALUES (
            NEW.id,
            'status_change',
            'Statut changé de ' || COALESCE(OLD.status, 'nouveau') || ' à ' || NEW.status,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_status_change_log ON leads;
CREATE TRIGGER lead_status_change_log
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION log_lead_status_change();

-- =====================================================
-- 6. RLS Policies
-- =====================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS leads_org_access ON leads;
DROP POLICY IF EXISTS lead_activities_access ON lead_activities;

-- Leads: Users can only access leads from their organization
CREATE POLICY leads_org_access ON leads
    FOR ALL
    USING (
        org_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Lead activities: Access through lead ownership
CREATE POLICY lead_activities_access ON lead_activities
    FOR ALL
    USING (
        lead_id IN (
            SELECT l.id FROM leads l
            WHERE l.org_id IN (
                SELECT om.organization_id
                FROM organization_members om
                WHERE om.user_id = auth.uid()
            )
        )
    );

-- =====================================================
-- 7. Comments
-- =====================================================

COMMENT ON TABLE leads IS 'CRM leads/prospects for sales pipeline';
COMMENT ON TABLE lead_activities IS 'Activity timeline for leads (notes, calls, emails, status changes)';
COMMENT ON COLUMN leads.status IS 'Pipeline stage: new, qualified, proposal, negotiation, won, lost';
COMMENT ON COLUMN leads.probability IS 'Win probability percentage (0-100)';
COMMENT ON COLUMN leads.ai_summary IS 'AI-generated summary of the lead';
COMMENT ON COLUMN leads.ai_next_action IS 'AI-suggested next action';
