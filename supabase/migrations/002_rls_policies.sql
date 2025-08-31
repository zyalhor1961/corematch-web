-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Organization admins can update their org" ON organizations
  FOR UPDATE USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- Organization members policies
CREATE POLICY "Members can view their org memberships" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage org members" ON organization_members
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

CREATE POLICY "Users can join organizations when invited" ON organization_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR 
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );

-- Subscriptions policies
CREATE POLICY "Users can view their org subscriptions" ON subscriptions
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage subscriptions" ON subscriptions
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- Projects policies
CREATE POLICY "Users can view their org projects" ON projects
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can create projects" ON projects
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
    AND created_by = auth.uid()
  );

CREATE POLICY "Managers can update projects" ON projects
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );

CREATE POLICY "Admins can delete projects" ON projects
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- Candidates policies
CREATE POLICY "Users can view their org candidates" ON candidates
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can manage candidates" ON candidates
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );

-- Documents policies
CREATE POLICY "Users can view their org documents" ON documents
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can create documents" ON documents
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
    AND created_by = auth.uid()
  );

CREATE POLICY "Managers can update documents" ON documents
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );

CREATE POLICY "Admins can delete documents" ON documents
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  );

-- Document pages policies
CREATE POLICY "Users can view their org document pages" ON document_pages
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can manage document pages" ON document_pages
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager')
      )
    )
  );

-- Document lines policies
CREATE POLICY "Users can view their org document lines" ON document_lines
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can manage document lines" ON document_lines
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager')
      )
    )
  );

-- Products policies
CREATE POLICY "Users can view their org products" ON products
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can manage products" ON products
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );

-- Jobs policies
CREATE POLICY "Users can view their org jobs" ON jobs
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can manage jobs" ON jobs
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager')
      )
    )
  );

-- Audit logs policies
CREATE POLICY "Users can view their org audit logs" ON audit_logs
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Leads policies
CREATE POLICY "Users can view their org leads" ON leads
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can manage leads" ON leads
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );

-- Usage counters policies
CREATE POLICY "Users can view their org usage" ON usage_counters
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "System can manage usage counters" ON usage_counters
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('org_admin', 'org_manager'))
  );