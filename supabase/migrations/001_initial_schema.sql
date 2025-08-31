-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS
ALTER DATABASE postgres SET row_security = on;

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) UNIQUE,
  plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'scale')),
  status VARCHAR(50) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled')),
  trial_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization members table
CREATE TABLE organization_members (
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'org_viewer' CHECK (role IN ('org_admin', 'org_manager', 'org_viewer')),
  invited_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('starter', 'pro', 'scale')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid')),
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table (CV Screening)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  job_title VARCHAR(255),
  requirements TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates table (CV Screening)
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  source VARCHAR(100),
  cv_url TEXT,
  cv_filename VARCHAR(255),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  explanation TEXT,
  shortlisted BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (DEB Assistant)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) DEFAULT 'mixed' CHECK (doc_type IN ('invoice', 'delivery_note', 'mixed')),
  file_path TEXT,
  filename VARCHAR(255),
  supplier_name VARCHAR(255),
  supplier_vat VARCHAR(50),
  supplier_country VARCHAR(2),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  currency VARCHAR(3) DEFAULT 'EUR',
  incoterm VARCHAR(10),
  total_ht DECIMAL(12,2),
  shipping_total DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'parsed', 'enriched', 'needs_review', 'approved', 'exported', 'error')),
  export_url TEXT,
  pages_count INTEGER DEFAULT 0,
  confidence_avg DECIMAL(3,2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document pages table
CREATE TABLE document_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL,
  type VARCHAR(50) CHECK (type IN ('invoice', 'delivery_note', 'other')),
  confidence DECIMAL(3,2),
  raw_ocr_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document lines table (extracted product lines)
CREATE TABLE document_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  description VARCHAR(500),
  sku VARCHAR(100),
  qty DECIMAL(10,3),
  unit VARCHAR(20),
  unit_price DECIMAL(10,4),
  line_amount DECIMAL(12,2),
  hs_code VARCHAR(20),
  country_of_origin VARCHAR(2),
  net_mass_kg DECIMAL(10,3),
  shipping_allocated DECIMAL(10,2),
  customs_value_line DECIMAL(12,2),
  source_weight VARCHAR(50), -- 'bl_mapped', 'ai_estimated', 'manual'
  source_hs VARCHAR(50), -- 'product_db', 'ai_classified', 'manual'
  bl_links TEXT[], -- array of BL identifiers that contributed weight
  pages_source INTEGER[], -- array of page numbers this line came from
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table (reference data per organization)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  default_hs_code VARCHAR(20),
  default_net_mass_kg DECIMAL(10,3),
  default_unit VARCHAR(20),
  description VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, sku)
);

-- Jobs table (background processing tracking)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL CHECK (stage IN ('ocr', 'classification', 'extraction', 'enrichment', 'export')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  message TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  actor UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  before JSONB,
  after JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table (optional marketing/sales tracking)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  company VARCHAR(255),
  source VARCHAR(100),
  stage VARCHAR(50) DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'qualified', 'demo', 'proposal', 'won', 'lost')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  owner UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage counters table (for quota management)
CREATE TABLE usage_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period_month VARCHAR(7) NOT NULL, -- format: 'YYYY-MM'
  cv_count INTEGER DEFAULT 0,
  deb_pages_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, period_month)
);

-- Helper view for organization membership
CREATE VIEW my_orgs AS
SELECT 
  om.org_id,
  om.user_id,
  om.role,
  o.name as org_name,
  o.plan,
  o.status,
  o.trial_end_date
FROM organization_members om
JOIN organizations o ON om.org_id = o.id
WHERE om.user_id = auth.uid();