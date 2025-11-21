-- Organization AI Settings table
-- Allows org admins to define custom AI instructions that are injected into prompts at runtime

CREATE TABLE org_ai_settings (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- General instructions applied to all AI interactions
  general_instructions TEXT,

  -- Domain-specific instructions
  -- DAF = Dossier d'Appel de Fonds (funding application analysis)
  daf_instructions TEXT,

  -- CV = Curriculum Vitae (candidate screening)
  cv_instructions TEXT,

  -- DEB = Declaration d'Echanges de Biens (customs/trade document processing)
  deb_instructions TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE org_ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only org admins can read/write their org's AI settings

-- SELECT: All org members can view AI settings (needed for prompt injection at runtime)
CREATE POLICY "Members can view their org AI settings" ON org_ai_settings
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

-- INSERT: Only org_admin can create AI settings
CREATE POLICY "Admins can create org AI settings" ON org_ai_settings
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- UPDATE: Only org_admin can update AI settings
CREATE POLICY "Admins can update org AI settings" ON org_ai_settings
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- DELETE: Only org_admin can delete AI settings
CREATE POLICY "Admins can delete org AI settings" ON org_ai_settings
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_org_ai_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_ai_settings_updated_at
  BEFORE UPDATE ON org_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_org_ai_settings_updated_at();

-- Index for faster lookups (though org_id is already PK)
CREATE INDEX idx_org_ai_settings_org_id ON org_ai_settings(org_id);

-- Add comment for documentation
COMMENT ON TABLE org_ai_settings IS 'Per-organization AI instruction customization. Instructions are injected into LLM prompts at runtime.';
COMMENT ON COLUMN org_ai_settings.general_instructions IS 'Applied to all AI interactions when no domain-specific instruction exists';
COMMENT ON COLUMN org_ai_settings.daf_instructions IS 'Applied to DAF (funding application) analysis prompts';
COMMENT ON COLUMN org_ai_settings.cv_instructions IS 'Applied to CV screening and candidate analysis prompts';
COMMENT ON COLUMN org_ai_settings.deb_instructions IS 'Applied to DEB (customs declaration) document processing prompts';
