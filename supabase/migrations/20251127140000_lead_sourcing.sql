-- ============================================================
-- Lead Sourcing Tables
-- Stores Exa search results to avoid duplicate API costs
-- ============================================================

-- 1. L'Historique des Recherches (Le dossier)
CREATE TABLE IF NOT EXISTS lead_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,  -- "Hôtels à Toulouse"
    location TEXT,
    results_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Les Prospects Bruts (Le contenu du dossier)
CREATE TABLE IF NOT EXISTS sourced_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID REFERENCES lead_searches(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Données Exa (Pas chères)
    company_name TEXT NOT NULL,
    url TEXT,
    exa_summary TEXT,
    exa_score NUMERIC,

    -- Statut
    is_enriched BOOLEAN DEFAULT FALSE,  -- A-t-on lancé Firecrawl ?
    is_converted_to_lead BOOLEAN DEFAULT FALSE,  -- Est-il dans le CRM ?
    lead_id UUID REFERENCES leads(id),  -- Lien vers le vrai lead si converti

    -- Données d'enrichissement (rempli après Firecrawl)
    enrichment_data JSONB,
    enriched_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour la performance
CREATE INDEX IF NOT EXISTS idx_lead_searches_org ON lead_searches(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_searches_created ON lead_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sourced_leads_search ON sourced_leads(search_id);
CREATE INDEX IF NOT EXISTS idx_sourced_leads_org ON sourced_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_sourced_leads_url ON sourced_leads(url);

-- RLS Policies
ALTER TABLE lead_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourced_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Users can view own org searches" ON lead_searches;
DROP POLICY IF EXISTS "Users can insert own org searches" ON lead_searches;
DROP POLICY IF EXISTS "Users can view own org sourced leads" ON sourced_leads;
DROP POLICY IF EXISTS "Users can insert own org sourced leads" ON sourced_leads;
DROP POLICY IF EXISTS "Users can update own org sourced leads" ON sourced_leads;
DROP POLICY IF EXISTS "Service role full access lead_searches" ON lead_searches;
DROP POLICY IF EXISTS "Service role full access sourced_leads" ON sourced_leads;

-- Policies pour lead_searches
CREATE POLICY "Users can view own org searches"
    ON lead_searches FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own org searches"
    ON lead_searches FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Policies pour sourced_leads
CREATE POLICY "Users can view own org sourced leads"
    ON sourced_leads FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own org sourced leads"
    ON sourced_leads FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own org sourced leads"
    ON sourced_leads FOR UPDATE
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Service role bypass pour le backend Python
CREATE POLICY "Service role full access lead_searches"
    ON lead_searches FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access sourced_leads"
    ON sourced_leads FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Active le Realtime pour voir les résultats arriver en direct
ALTER PUBLICATION supabase_realtime ADD TABLE lead_searches;
ALTER PUBLICATION supabase_realtime ADD TABLE sourced_leads;
