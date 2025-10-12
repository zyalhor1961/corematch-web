-- 008_deb_business_logic.sql
-- DEB Business Logic: Auto-Learning Reference, VAT Controls, HS Code Enrichment

BEGIN;

-- =============================================================================
-- DEB ARTICLE REFERENCE TABLE (Auto-Learning)
-- =============================================================================
CREATE TABLE IF NOT EXISTS deb_article_reference (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Article Identification
    description TEXT NOT NULL,
    description_normalized TEXT NOT NULL, -- Lowercased, trimmed for matching
    sku VARCHAR(100), -- Optional SKU reference

    -- DEB Data
    hs_code CHAR(8) NOT NULL, -- 8-digit HS/NC code
    weight_net_kg DECIMAL(10,3) NOT NULL, -- Net weight per unit in kg
    country_of_origin CHAR(2), -- ISO 3166-1 alpha-2

    -- Confidence & Learning
    confidence_score DECIMAL(5,4) DEFAULT 1.0000 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    validation_count INTEGER DEFAULT 1, -- How many times validated
    last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),

    -- Source Tracking
    source VARCHAR(50) DEFAULT 'user_validated' CHECK (source IN (
        'user_validated',
        'openai_suggested',
        'manual_entry',
        'imported'
    )),

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),

    -- Unique constraint on normalized description per organization
    UNIQUE(org_id, description_normalized)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deb_article_org_description ON deb_article_reference(org_id, description_normalized);
CREATE INDEX IF NOT EXISTS idx_deb_article_hs_code ON deb_article_reference(hs_code);
CREATE INDEX IF NOT EXISTS idx_deb_article_confidence ON deb_article_reference(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_deb_article_org_id ON deb_article_reference(org_id);

-- =============================================================================
-- VAT CONTROLS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS deb_vat_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,

    -- Control Results
    control_type VARCHAR(50) NOT NULL CHECK (control_type IN (
        'arithmetic_ttc',
        'intra_eu_classification',
        'vat_zero_verification'
    )),

    status VARCHAR(50) NOT NULL CHECK (status IN (
        'passed',
        'warning',
        'failed'
    )),

    -- Values
    expected_value DECIMAL(15,4),
    actual_value DECIMAL(15,4),
    difference DECIMAL(15,4),
    tolerance DECIMAL(15,4),

    -- Details
    message TEXT,
    severity VARCHAR(50) CHECK (severity IN ('info', 'warning', 'error', 'critical')),

    -- Metadata
    auto_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_deb_vat_controls_document ON deb_vat_controls(document_id);
CREATE INDEX IF NOT EXISTS idx_deb_vat_controls_status ON deb_vat_controls(status);
CREATE INDEX IF NOT EXISTS idx_deb_vat_controls_type ON deb_vat_controls(control_type);

-- =============================================================================
-- ENHANCE IDP_DOCUMENTS WITH VAT FIELDS
-- =============================================================================
ALTER TABLE idp_documents
ADD COLUMN IF NOT EXISTS vat_control_status VARCHAR(50) CHECK (vat_control_status IN (
    'pending',
    'passed',
    'warning',
    'failed',
    'manual_review'
)),
ADD COLUMN IF NOT EXISTS vat_control_results JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_intra_eu BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vat_regime VARCHAR(50) CHECK (vat_regime IN (
    'standard',
    'reverse_charge',
    'exempted',
    'not_applicable'
));

-- Index for filtering by VAT status
CREATE INDEX IF NOT EXISTS idx_idp_documents_vat_status ON idp_documents(vat_control_status);
CREATE INDEX IF NOT EXISTS idx_idp_documents_is_intra_eu ON idp_documents(is_intra_eu);

-- =============================================================================
-- ENHANCE IDP_EXTRACTED_FIELDS WITH HS CODE ENRICHMENT
-- =============================================================================
ALTER TABLE idp_extracted_fields
ADD COLUMN IF NOT EXISTS hs_code_suggested CHAR(8),
ADD COLUMN IF NOT EXISTS hs_code_confidence DECIMAL(5,4) CHECK (hs_code_confidence >= 0 AND hs_code_confidence <= 1),
ADD COLUMN IF NOT EXISTS hs_code_source VARCHAR(50) CHECK (hs_code_source IN (
    'reference_db',
    'openai',
    'user_corrected',
    'azure_extracted'
)),
ADD COLUMN IF NOT EXISTS weight_kg_suggested DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS weight_source VARCHAR(50) CHECK (weight_source IN (
    'reference_db',
    'rule_of_three',
    'openai_estimated',
    'user_entered',
    'delivery_note'
));

-- Indexes for HS code enrichment
CREATE INDEX IF NOT EXISTS idx_idp_fields_hs_suggested ON idp_extracted_fields(hs_code_suggested);
CREATE INDEX IF NOT EXISTS idx_idp_fields_hs_source ON idp_extracted_fields(hs_code_source);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-increment validation count and confidence on updates
CREATE OR REPLACE FUNCTION increment_validation_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id IS NOT NULL AND NEW.source = 'user_validated' THEN
        -- Update existing record: increment count and boost confidence
        NEW.validation_count = OLD.validation_count + 1;
        NEW.confidence_score = LEAST(1.0, OLD.confidence_score + 0.05);
        NEW.last_validated_at = timezone('utc', now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_validation
BEFORE UPDATE ON deb_article_reference
FOR EACH ROW EXECUTE FUNCTION increment_validation_count();

-- Auto-update updated_at timestamp
CREATE TRIGGER trg_deb_article_set_updated_at
BEFORE UPDATE ON deb_article_reference
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE deb_article_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE deb_vat_controls ENABLE ROW LEVEL SECURITY;

-- DEB Article Reference: Members can view, Managers can manage
CREATE POLICY "Members view deb article reference" ON deb_article_reference
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers manage deb article reference" ON deb_article_reference
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('org_admin', 'org_manager')
        )
    );

-- VAT Controls: Linked to documents
CREATE POLICY "Members view vat controls" ON deb_vat_controls
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM idp_documents WHERE org_id IN (
                SELECT org_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System insert vat controls" ON deb_vat_controls
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Managers manage vat controls" ON deb_vat_controls
    FOR ALL USING (
        document_id IN (
            SELECT id FROM idp_documents WHERE org_id IN (
                SELECT org_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('org_admin', 'org_manager')
            )
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to search for article in reference database
CREATE OR REPLACE FUNCTION search_article_reference(
    p_org_id UUID,
    p_description TEXT
)
RETURNS TABLE (
    id UUID,
    hs_code CHAR(8),
    weight_net_kg DECIMAL(10,3),
    confidence_score DECIMAL(5,4),
    source VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ar.id,
        ar.hs_code,
        ar.weight_net_kg,
        ar.confidence_score,
        ar.source
    FROM deb_article_reference ar
    WHERE ar.org_id = p_org_id
    AND ar.description_normalized = LOWER(TRIM(p_description))
    ORDER BY ar.confidence_score DESC, ar.validation_count DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get VAT control summary for a document
CREATE OR REPLACE FUNCTION get_vat_control_summary(p_document_id UUID)
RETURNS TABLE (
    control_type VARCHAR(50),
    status VARCHAR(50),
    message TEXT,
    difference DECIMAL(15,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vc.control_type,
        vc.status,
        vc.message,
        vc.difference
    FROM deb_vat_controls vc
    WHERE vc.document_id = p_document_id
    ORDER BY
        CASE vc.status
            WHEN 'failed' THEN 1
            WHEN 'warning' THEN 2
            WHEN 'passed' THEN 3
        END,
        vc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SEED DATA: EU Countries
-- =============================================================================
CREATE TABLE IF NOT EXISTS deb_eu_countries (
    country_code CHAR(2) PRIMARY KEY,
    country_name VARCHAR(100) NOT NULL,
    is_eurozone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

INSERT INTO deb_eu_countries (country_code, country_name, is_eurozone) VALUES
('AT', 'Austria', TRUE),
('BE', 'Belgium', TRUE),
('BG', 'Bulgaria', FALSE),
('HR', 'Croatia', TRUE),
('CY', 'Cyprus', TRUE),
('CZ', 'Czech Republic', FALSE),
('DK', 'Denmark', FALSE),
('EE', 'Estonia', TRUE),
('FI', 'Finland', TRUE),
('FR', 'France', TRUE),
('DE', 'Germany', TRUE),
('GR', 'Greece', TRUE),
('HU', 'Hungary', FALSE),
('IE', 'Ireland', TRUE),
('IT', 'Italy', TRUE),
('LV', 'Latvia', TRUE),
('LT', 'Lithuania', TRUE),
('LU', 'Luxembourg', TRUE),
('MT', 'Malta', TRUE),
('NL', 'Netherlands', TRUE),
('PL', 'Poland', FALSE),
('PT', 'Portugal', TRUE),
('RO', 'Romania', FALSE),
('SK', 'Slovakia', TRUE),
('SI', 'Slovenia', TRUE),
('ES', 'Spain', TRUE),
('SE', 'Sweden', FALSE)
ON CONFLICT (country_code) DO NOTHING;

-- Make EU countries table public (read-only)
ALTER TABLE deb_eu_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view EU countries" ON deb_eu_countries
    FOR SELECT USING (true);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View for article reference with learning metrics
CREATE OR REPLACE VIEW deb_article_learning_stats AS
SELECT
    org_id,
    COUNT(*) as total_articles,
    COUNT(CASE WHEN source = 'user_validated' THEN 1 END) as user_validated_count,
    COUNT(CASE WHEN source = 'openai_suggested' THEN 1 END) as ai_suggested_count,
    AVG(confidence_score) as avg_confidence,
    SUM(validation_count) as total_validations
FROM deb_article_reference
GROUP BY org_id;

COMMIT;
