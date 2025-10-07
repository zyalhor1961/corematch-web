-- 006_deb_module.sql
-- Foundational schema for DEB Assistant batches and metadata

BEGIN;

CREATE TABLE IF NOT EXISTS deb_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    source_filename TEXT NOT NULL,
    storage_object_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','needs_review','ready','exported','failed')),
    total_documents INTEGER DEFAULT 0,
    processed_documents INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_deb_batches_org_id ON deb_batches(org_id);
CREATE INDEX IF NOT EXISTS idx_deb_batches_status ON deb_batches(status);

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES deb_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS storage_object_path TEXT,
    ADD COLUMN IF NOT EXISTS delivery_note_number TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

ALTER TABLE document_lines
    ADD COLUMN IF NOT EXISTS hs_confidence DECIMAL(4,2),
    ADD COLUMN IF NOT EXISTS weight_confidence DECIMAL(4,2),
    ADD COLUMN IF NOT EXISTS country_destination CHAR(2),
    ADD COLUMN IF NOT EXISTS enrichment_notes TEXT,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS hs_code_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID NOT NULL REFERENCES document_lines(id) ON DELETE CASCADE,
    suggested_code TEXT NOT NULL,
    confidence DECIMAL(4,2),
    model TEXT,
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_hs_code_suggestions_line_id ON hs_code_suggestions(line_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deb_batches_set_updated_at
BEFORE UPDATE ON deb_batches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deb_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_code_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view deb batches" ON deb_batches
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers manage deb batches" ON deb_batches
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin','org_manager')
        )
    )
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin','org_manager')
        )
    );

CREATE POLICY "Members view hs suggestions" ON hs_code_suggestions
    FOR SELECT USING (
        line_id IN (
            SELECT id FROM document_lines WHERE document_id IN (
                SELECT id FROM documents WHERE org_id IN (
                    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Managers manage hs suggestions" ON hs_code_suggestions
    FOR ALL USING (
        line_id IN (
            SELECT id FROM document_lines WHERE document_id IN (
                SELECT id FROM documents WHERE org_id IN (
                    SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin','org_manager')
                )
            )
        )
    )
    WITH CHECK (
        line_id IN (
            SELECT id FROM document_lines WHERE document_id IN (
                SELECT id FROM documents WHERE org_id IN (
                    SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin','org_manager')
                )
            )
        )
    );

COMMIT;
