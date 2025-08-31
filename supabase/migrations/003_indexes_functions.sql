-- Indexes for performance
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON organization_members(org_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);

CREATE INDEX idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_created_at ON projects(created_at);

CREATE INDEX idx_candidates_project_id ON candidates(project_id);
CREATE INDEX idx_candidates_org_id ON candidates(org_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_shortlisted ON candidates(shortlisted);
CREATE INDEX idx_candidates_created_at ON candidates(created_at);

CREATE INDEX idx_documents_org_id ON documents(org_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_supplier ON documents(supplier_name, supplier_vat);

CREATE INDEX idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX idx_document_pages_type ON document_pages(type);

CREATE INDEX idx_document_lines_document_id ON document_lines(document_id);
CREATE INDEX idx_document_lines_sku ON document_lines(sku);
CREATE INDEX idx_document_lines_hs_code ON document_lines(hs_code);

CREATE INDEX idx_products_org_id ON products(org_id);
CREATE INDEX idx_products_sku ON products(org_id, sku);

CREATE INDEX idx_jobs_document_id ON jobs(document_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_stage ON jobs(stage);

CREATE INDEX idx_audit_logs_document_id ON audit_logs(document_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_leads_org_id ON leads(org_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_owner ON leads(owner);

CREATE INDEX idx_usage_counters_org_period ON usage_counters(org_id, period_month);

-- Function to get current usage period
CREATE OR REPLACE FUNCTION get_current_period()
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(NOW(), 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- Function to increment CV usage
CREATE OR REPLACE FUNCTION increment_cv_usage(org_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_counters (org_id, period_month, cv_count, deb_pages_count)
  VALUES (org_uuid, get_current_period(), 1, 0)
  ON CONFLICT (org_id, period_month)
  DO UPDATE SET 
    cv_count = usage_counters.cv_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment DEB pages usage
CREATE OR REPLACE FUNCTION increment_deb_usage(org_uuid UUID, pages_count INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_counters (org_id, period_month, cv_count, deb_pages_count)
  VALUES (org_uuid, get_current_period(), 0, pages_count)
  ON CONFLICT (org_id, period_month)
  DO UPDATE SET 
    deb_pages_count = usage_counters.deb_pages_count + pages_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get organization quota limits
CREATE OR REPLACE FUNCTION get_org_quotas(org_uuid UUID)
RETURNS TABLE(
  cv_monthly_quota INTEGER,
  deb_pages_quota INTEGER,
  multi_entities BOOLEAN
) AS $$
DECLARE
  org_plan TEXT;
BEGIN
  SELECT plan INTO org_plan FROM organizations WHERE id = org_uuid;
  
  CASE org_plan
    WHEN 'starter' THEN
      RETURN QUERY SELECT 200, 200, false;
    WHEN 'pro' THEN
      RETURN QUERY SELECT 1000, 1500, false;
    WHEN 'scale' THEN
      RETURN QUERY SELECT 999999, 10000, true;
    ELSE
      RETURN QUERY SELECT 50, 50, false; -- trial limits
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if organization can use feature
CREATE OR REPLACE FUNCTION can_use_feature(org_uuid UUID, feature TEXT, quantity INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  quota_limit INTEGER;
  org_status TEXT;
BEGIN
  -- Check org status first
  SELECT status INTO org_status FROM organizations WHERE id = org_uuid;
  
  -- Allow trial and active organizations
  IF org_status NOT IN ('trial', 'active') THEN
    RETURN FALSE;
  END IF;
  
  -- Get current usage for this month
  SELECT 
    CASE feature
      WHEN 'cv' THEN COALESCE(cv_count, 0)
      WHEN 'deb' THEN COALESCE(deb_pages_count, 0)
      ELSE 0
    END
  INTO current_usage
  FROM usage_counters 
  WHERE org_id = org_uuid AND period_month = get_current_period();
  
  -- Get quota limit based on plan
  SELECT 
    CASE feature
      WHEN 'cv' THEN cv_monthly_quota
      WHEN 'deb' THEN deb_pages_quota
      ELSE 0
    END
  INTO quota_limit
  FROM get_org_quotas(org_uuid);
  
  -- Check if usage + new quantity would exceed quota
  RETURN (COALESCE(current_usage, 0) + quantity) <= quota_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update leads updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for leads table
CREATE TRIGGER update_leads_updated_at 
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create organization with admin user
CREATE OR REPLACE FUNCTION create_organization_with_admin(
  org_name TEXT,
  admin_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Insert organization
  INSERT INTO organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;
  
  -- Add user as admin
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (new_org_id, admin_user_id, 'org_admin');
  
  RETURN new_org_id;
END;
$$ LANGUAGE plpgsql;