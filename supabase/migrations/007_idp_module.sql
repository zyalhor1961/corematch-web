-- 007_idp_module.sql
-- Intelligent Document Processing (IDP) Module
-- Accounting-grade document management with Azure Document Intelligence integration

BEGIN;

-- =============================================================================
-- IDP DOCUMENTS TABLE
-- Core table for all processed documents with full audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Document Identity
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,

    -- Storage
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'idp-documents',
    storage_path TEXT NOT NULL,
    storage_url TEXT, -- Signed URL for viewing

    -- Document Classification
    document_type VARCHAR(100) NOT NULL CHECK (document_type IN (
        'invoice',
        'receipt',
        'delivery_note',
        'purchase_order',
        'contract',
        'tax_document',
        'business_card',
        'id_document',
        'bank_statement',
        'customs_declaration',
        'general'
    )),
    document_category VARCHAR(50) DEFAULT 'financial', -- financial, legal, identity, customs, general

    -- Processing Status
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (status IN (
        'uploaded',           -- Initial upload
        'queued',            -- Queued for processing
        'processing',        -- Currently processing
        'processed',         -- Successfully processed
        'needs_validation',  -- Requires human validation
        'validated',         -- Human validated
        'approved',          -- Approved for export
        'exported',          -- Exported to accounting system
        'archived',          -- Archived
        'failed',            -- Processing failed
        'rejected'           -- Rejected by user
    )),

    -- Azure Document Intelligence
    azure_model_id VARCHAR(100), -- Which Azure model was used
    azure_operation_id VARCHAR(255), -- Azure operation tracking
    azure_analyzed_at TIMESTAMP WITH TIME ZONE,

    -- Quality Metrics
    overall_confidence DECIMAL(5,4), -- 0.0000 to 1.0000 for precision
    page_count INTEGER DEFAULT 1,
    field_count INTEGER DEFAULT 0,
    validation_errors_count INTEGER DEFAULT 0,

    -- Financial Data (for quick filtering/reporting)
    currency_code CHAR(3), -- ISO 4217
    total_amount DECIMAL(15,4), -- High precision for accounting
    tax_amount DECIMAL(15,4),
    net_amount DECIMAL(15,4),
    document_date DATE,
    due_date DATE,

    -- Supplier/Vendor Info (extracted)
    vendor_name VARCHAR(255),
    vendor_vat VARCHAR(50),
    vendor_country CHAR(2), -- ISO 3166-1 alpha-2

    -- Customer Info (if applicable)
    customer_name VARCHAR(255),
    customer_vat VARCHAR(50),

    -- Reference Numbers
    invoice_number VARCHAR(100),
    po_number VARCHAR(100),

    -- Audit Trail
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    processed_at TIMESTAMP WITH TIME ZONE,
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    exported_by UUID REFERENCES auth.users(id),
    exported_at TIMESTAMP WITH TIME ZONE,

    -- Metadata & Notes
    metadata JSONB DEFAULT '{}'::jsonb,
    processing_notes TEXT,
    validation_notes TEXT,
    tags TEXT[], -- For categorization

    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- IDP EXTRACTED FIELDS TABLE
-- All fields extracted from documents with full lineage
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_extracted_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES idp_documents(id) ON DELETE CASCADE,

    -- Field Identity
    field_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(100) NOT NULL, -- string, number, date, address, amount, etc.
    field_category VARCHAR(100), -- Auto-detected: amount, date, address, phone, email, etc.

    -- Extracted Value
    value_text TEXT, -- Original extracted text
    value_normalized TEXT, -- Normalized/cleaned value
    value_number DECIMAL(20,6), -- If numeric
    value_date DATE, -- If date
    value_json JSONB, -- For complex structures

    -- Quality & Confidence
    confidence DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000

    -- Location in Document
    page_number INTEGER NOT NULL DEFAULT 1,
    bounding_box JSONB, -- Polygon coordinates [{x, y}, ...]

    -- Validation
    is_validated BOOLEAN DEFAULT FALSE,
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMP WITH TIME ZONE,
    original_value TEXT, -- If corrected by user
    validation_status VARCHAR(50) CHECK (validation_status IN (
        'pending',
        'confirmed',
        'corrected',
        'rejected'
    )),

    -- Metadata
    extraction_method VARCHAR(50) DEFAULT 'azure', -- azure, manual, hybrid
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =============================================================================
-- IDP VALIDATION RULES TABLE
-- Define validation rules for different document types and fields
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_validation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Rule Identity
    rule_name VARCHAR(255) NOT NULL,
    rule_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,

    -- Applicability
    document_types TEXT[], -- Which document types this applies to
    field_names TEXT[], -- Which fields this applies to

    -- Rule Type
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
        'required_field',    -- Field must be present
        'min_confidence',    -- Minimum confidence threshold
        'format_validation', -- Regex or format check
        'range_validation',  -- Numeric range
        'cross_field',       -- Compare with other fields
        'business_logic'     -- Custom business rules
    )),

    -- Rule Configuration
    rule_config JSONB NOT NULL, -- Rule-specific parameters

    -- Severity
    severity VARCHAR(50) DEFAULT 'error' CHECK (severity IN (
        'info',
        'warning',
        'error',
        'critical'
    )),

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =============================================================================
-- IDP VALIDATION RESULTS TABLE
-- Track validation results for each document
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES idp_documents(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES idp_validation_rules(id) ON DELETE SET NULL,
    field_id UUID REFERENCES idp_extracted_fields(id) ON DELETE CASCADE,

    -- Result
    is_valid BOOLEAN NOT NULL,
    severity VARCHAR(50) NOT NULL,
    error_message TEXT,
    suggested_correction TEXT,

    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =============================================================================
-- IDP AUDIT LOG TABLE
-- Complete audit trail for all operations
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID REFERENCES idp_documents(id) ON DELETE SET NULL,

    -- Action
    action VARCHAR(100) NOT NULL, -- uploaded, processed, validated, approved, exported, etc.
    action_category VARCHAR(50) NOT NULL, -- document, field, validation, export, system

    -- Actor
    user_id UUID REFERENCES auth.users(id),
    user_email VARCHAR(255),
    user_role VARCHAR(50),

    -- Details
    changes JSONB, -- Before/after values
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =============================================================================
-- IDP EXPORT BATCHES TABLE
-- Track exports to accounting systems
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_export_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Batch Info
    batch_name VARCHAR(255) NOT NULL,
    export_format VARCHAR(50) NOT NULL CHECK (export_format IN (
        'csv',
        'excel',
        'json',
        'xml',
        'sage',
        'quickbooks',
        'xero',
        'custom'
    )),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'completed',
        'failed'
    )),

    -- Export Details
    document_count INTEGER DEFAULT 0,
    total_amount DECIMAL(15,4),
    export_file_path TEXT,
    export_file_url TEXT,

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- =============================================================================
-- IDP EXPORT BATCH ITEMS TABLE
-- Link documents to export batches
-- =============================================================================
CREATE TABLE IF NOT EXISTS idp_export_batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES idp_export_batches(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES idp_documents(id) ON DELETE CASCADE,

    -- Item Status
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Documents
CREATE INDEX idx_idp_documents_org_id ON idp_documents(org_id);
CREATE INDEX idx_idp_documents_status ON idp_documents(status);
CREATE INDEX idx_idp_documents_document_type ON idp_documents(document_type);
CREATE INDEX idx_idp_documents_created_at ON idp_documents(created_at DESC);
CREATE INDEX idx_idp_documents_document_date ON idp_documents(document_date);
CREATE INDEX idx_idp_documents_vendor_name ON idp_documents(vendor_name);
CREATE INDEX idx_idp_documents_invoice_number ON idp_documents(invoice_number);
CREATE INDEX idx_idp_documents_deleted_at ON idp_documents(deleted_at) WHERE deleted_at IS NULL;

-- Fields
CREATE INDEX idx_idp_fields_document_id ON idp_extracted_fields(document_id);
CREATE INDEX idx_idp_fields_field_name ON idp_extracted_fields(field_name);
CREATE INDEX idx_idp_fields_confidence ON idp_extracted_fields(confidence);
CREATE INDEX idx_idp_fields_validation_status ON idp_extracted_fields(validation_status);

-- Validation Results
CREATE INDEX idx_idp_validation_document_id ON idp_validation_results(document_id);
CREATE INDEX idx_idp_validation_is_resolved ON idp_validation_results(is_resolved);

-- Audit Log
CREATE INDEX idx_idp_audit_org_id ON idp_audit_log(org_id);
CREATE INDEX idx_idp_audit_document_id ON idp_audit_log(document_id);
CREATE INDEX idx_idp_audit_created_at ON idp_audit_log(created_at DESC);
CREATE INDEX idx_idp_audit_action ON idp_audit_log(action);

-- Export Batches
CREATE INDEX idx_idp_export_batches_org_id ON idp_export_batches(org_id);
CREATE INDEX idx_idp_export_batches_status ON idp_export_batches(status);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamps
CREATE TRIGGER trg_idp_documents_set_updated_at
BEFORE UPDATE ON idp_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_idp_validation_rules_set_updated_at
BEFORE UPDATE ON idp_validation_rules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE idp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_export_batch_items ENABLE ROW LEVEL SECURITY;

-- Documents: Members can view, Managers can manage
CREATE POLICY "Members view idp documents" ON idp_documents
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
        AND deleted_at IS NULL
    );

CREATE POLICY "Managers manage idp documents" ON idp_documents
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('org_admin', 'org_manager')
        )
    );

-- Extracted Fields: Linked to documents
CREATE POLICY "Members view idp fields" ON idp_extracted_fields
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM idp_documents WHERE org_id IN (
                SELECT org_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Managers manage idp fields" ON idp_extracted_fields
    FOR ALL USING (
        document_id IN (
            SELECT id FROM idp_documents WHERE org_id IN (
                SELECT org_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('org_admin', 'org_manager')
            )
        )
    );

-- Validation Rules: Org-specific
CREATE POLICY "Members view validation rules" ON idp_validation_rules
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins manage validation rules" ON idp_validation_rules
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
            AND role = 'org_admin'
        )
    );

-- Validation Results: Linked to documents
CREATE POLICY "Members view validation results" ON idp_validation_results
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM idp_documents WHERE org_id IN (
                SELECT org_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Managers manage validation results" ON idp_validation_results
    FOR ALL USING (
        document_id IN (
            SELECT id FROM idp_documents WHERE org_id IN (
                SELECT org_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('org_admin', 'org_manager')
            )
        )
    );

-- Audit Log: View only
CREATE POLICY "Members view audit log" ON idp_audit_log
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System insert audit log" ON idp_audit_log
    FOR INSERT WITH CHECK (true);

-- Export Batches
CREATE POLICY "Members view export batches" ON idp_export_batches
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers manage export batches" ON idp_export_batches
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('org_admin', 'org_manager')
        )
    );

-- Export Batch Items
CREATE POLICY "Members view export batch items" ON idp_export_batch_items
    FOR SELECT USING (
        batch_id IN (
            SELECT id FROM idp_export_batches WHERE org_id IN (
                SELECT org_id FROM organization_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Managers manage export batch items" ON idp_export_batch_items
    FOR ALL USING (
        batch_id IN (
            SELECT id FROM idp_export_batches WHERE org_id IN (
                SELECT org_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('org_admin', 'org_manager')
            )
        )
    );

COMMIT;
