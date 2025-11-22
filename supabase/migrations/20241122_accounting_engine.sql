-- =====================================================
-- MOTEUR COMPTABLE COREMATCH - Migration Complète
-- Conforme PCG français, extensible international
-- =====================================================

-- 1. PLAN COMPTABLE (Chart of Accounts)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  account_code VARCHAR(10) NOT NULL,           -- Ex: '411000', '512000', '706000'
  account_name VARCHAR(255) NOT NULL,          -- Ex: 'Clients', 'Banque', 'Ventes de marchandises'
  account_name_short VARCHAR(50),              -- Nom court pour affichage

  -- Classification PCG
  account_class CHAR(1) NOT NULL,              -- 1-7 (classe PCG)
  account_type VARCHAR(20) NOT NULL,           -- 'asset', 'liability', 'equity', 'income', 'expense'
  account_subtype VARCHAR(50),                 -- Pour sous-classification

  -- Comportement
  is_active BOOLEAN DEFAULT true,
  is_reconcilable BOOLEAN DEFAULT false,       -- Pour comptes tiers (411, 401)
  is_centralized BOOLEAN DEFAULT false,        -- Compte collectif centralisateur

  -- TVA associée (pour comptes de ventes/achats)
  default_vat_rate DECIMAL(5,2),
  vat_account_code VARCHAR(10),                -- Compte TVA lié

  -- Analytique
  requires_analytic BOOLEAN DEFAULT false,

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contraintes
  UNIQUE(org_id, account_code)
);

-- Index pour recherche rapide
CREATE INDEX idx_erp_accounts_org_class ON erp_accounts(org_id, account_class);
CREATE INDEX idx_erp_accounts_org_code ON erp_accounts(org_id, account_code);

-- 2. JOURNAUX COMPTABLES (Journals)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  journal_code VARCHAR(10) NOT NULL,           -- 'VE', 'AC', 'BQ', 'OD', 'AN'
  journal_name VARCHAR(100) NOT NULL,          -- 'Ventes', 'Achats', 'Banque', 'Opérations Diverses'
  journal_type VARCHAR(20) NOT NULL,           -- 'sale', 'purchase', 'bank', 'cash', 'misc', 'opening'

  -- Compte de contrepartie par défaut
  default_account_code VARCHAR(10),

  -- Numérotation
  sequence_prefix VARCHAR(20),                 -- Préfixe pour numéros d'écriture
  next_sequence_number INTEGER DEFAULT 1,

  -- État
  is_active BOOLEAN DEFAULT true,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, journal_code)
);

-- 3. PÉRIODES COMPTABLES (Fiscal Periods)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  period_name VARCHAR(50) NOT NULL,            -- 'Janvier 2024', 'Q1 2024'
  period_type VARCHAR(20) DEFAULT 'month',     -- 'month', 'quarter', 'year'

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- État de clôture
  status VARCHAR(20) DEFAULT 'open',           -- 'open', 'closing', 'closed', 'locked'
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),

  -- Exercice fiscal
  fiscal_year INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, start_date, end_date)
);

-- 4. ÉCRITURES COMPTABLES (Journal Entries)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  entry_number VARCHAR(50),                    -- Numéro d'écriture unique (généré)
  journal_id UUID NOT NULL REFERENCES erp_journals(id),

  -- Source de l'écriture (traçabilité)
  source_type VARCHAR(50) NOT NULL,            -- 'customer_invoice', 'supplier_invoice', 'payment_in', 'payment_out', 'expense', 'manual_adjustment', 'opening'
  source_id UUID,                              -- ID de la pièce source
  source_ref VARCHAR(100),                     -- Référence lisible (n° facture, etc.)

  -- Dates
  entry_date DATE NOT NULL,                    -- Date comptable
  document_date DATE,                          -- Date du document source

  -- Description
  description TEXT NOT NULL,

  -- Totaux (doivent être égaux pour équilibre)
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- État
  status VARCHAR(20) DEFAULT 'draft',          -- 'draft', 'posted', 'reversed', 'locked'

  -- Si écriture d'annulation
  reversal_of UUID REFERENCES erp_journal_entries(id),
  reversed_by UUID REFERENCES erp_journal_entries(id),
  reversal_date DATE,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,

  -- Contrainte d'équilibre (somme débits = somme crédits)
  CONSTRAINT chk_entry_balanced CHECK (total_debit = total_credit)
);

-- Index pour recherche
CREATE INDEX idx_erp_journal_entries_org ON erp_journal_entries(org_id);
CREATE INDEX idx_erp_journal_entries_date ON erp_journal_entries(org_id, entry_date);
CREATE INDEX idx_erp_journal_entries_source ON erp_journal_entries(org_id, source_type, source_id);
CREATE INDEX idx_erp_journal_entries_journal ON erp_journal_entries(journal_id);
CREATE INDEX idx_erp_journal_entries_status ON erp_journal_entries(org_id, status);

-- 5. LIGNES D'ÉCRITURES (Journal Lines)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES erp_journal_entries(id) ON DELETE CASCADE,

  -- Compte
  account_id UUID REFERENCES erp_accounts(id),
  account_code VARCHAR(10) NOT NULL,           -- Dénormalisé pour rapidité

  -- Montants (un seul non nul par ligne)
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,

  -- Description de la ligne
  description TEXT,

  -- Tiers associé (pour comptes 411/401)
  partner_type VARCHAR(20),                    -- 'client', 'supplier', 'employee'
  partner_id UUID,
  partner_name VARCHAR(255),                   -- Dénormalisé

  -- Analytique (optionnel)
  analytic_account VARCHAR(50),
  analytic_axis VARCHAR(50),

  -- Lettrage (pour rapprochement)
  reconcile_ref VARCHAR(50),
  reconciled_at TIMESTAMPTZ,

  -- Position dans l'écriture
  line_number INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte : débit ou crédit, pas les deux
  CONSTRAINT chk_debit_xor_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

-- Index
CREATE INDEX idx_erp_journal_lines_entry ON erp_journal_lines(entry_id);
CREATE INDEX idx_erp_journal_lines_account ON erp_journal_lines(account_code);
CREATE INDEX idx_erp_journal_lines_partner ON erp_journal_lines(partner_type, partner_id);
CREATE INDEX idx_erp_journal_lines_reconcile ON erp_journal_lines(reconcile_ref) WHERE reconcile_ref IS NOT NULL;

-- 6. RÈGLES DE COMPTABILISATION (Accounting Rules / Templates)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_accounting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  rule_code VARCHAR(50) NOT NULL,              -- 'CUSTOMER_INVOICE_POST', 'PAYMENT_IN', etc.
  rule_name VARCHAR(255) NOT NULL,

  -- Événement déclencheur
  event_type VARCHAR(50) NOT NULL,             -- 'customer_invoice_validated', 'supplier_invoice_validated', 'payment_received', 'payment_sent', 'expense_recorded'

  -- Journal cible
  journal_code VARCHAR(10) NOT NULL,           -- 'VE', 'AC', 'BQ'

  -- Templates de lignes (JSON array)
  -- Chaque élément: { account_expression, debit_expression, credit_expression, description_template, partner_expression }
  line_templates JSONB NOT NULL DEFAULT '[]',

  -- Conditions d'application (optionnel)
  conditions JSONB,                            -- Ex: { "vat_rate": "20", "country": "FR" }

  -- Priorité (si plusieurs règles matchent)
  priority INTEGER DEFAULT 100,

  -- État
  is_active BOOLEAN DEFAULT true,

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, rule_code)
);

-- 7. AUDIT LOG COMPTABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,

  -- Référence
  entry_id UUID REFERENCES erp_journal_entries(id),
  line_id UUID REFERENCES erp_journal_lines(id),

  -- Action
  action VARCHAR(50) NOT NULL,                 -- 'created', 'posted', 'modified', 'reversed', 'locked'

  -- Détails du changement
  old_values JSONB,
  new_values JSONB,

  -- Audit
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_erp_accounting_audit_org ON erp_accounting_audit_log(org_id);
CREATE INDEX idx_erp_accounting_audit_entry ON erp_accounting_audit_log(entry_id);

-- 8. SOLDES DE COMPTES (Vue matérialisée pour performance)
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS erp_account_balances AS
SELECT
  a.org_id,
  a.account_code,
  a.account_name,
  a.account_class,
  a.account_type,
  COALESCE(SUM(l.debit), 0) as total_debit,
  COALESCE(SUM(l.credit), 0) as total_credit,
  COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as balance,
  MAX(e.entry_date) as last_movement_date
FROM erp_accounts a
LEFT JOIN erp_journal_lines l ON l.account_code = a.account_code
LEFT JOIN erp_journal_entries e ON e.id = l.entry_id
  AND e.org_id = a.org_id
  AND e.status = 'posted'
GROUP BY a.org_id, a.account_code, a.account_name, a.account_class, a.account_type;

CREATE UNIQUE INDEX idx_erp_account_balances_pk ON erp_account_balances(org_id, account_code);

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour générer le numéro d'écriture
CREATE OR REPLACE FUNCTION generate_entry_number(p_org_id UUID, p_journal_code VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_journal_id UUID;
  v_prefix VARCHAR;
  v_seq INTEGER;
  v_year VARCHAR;
BEGIN
  SELECT id, sequence_prefix, next_sequence_number
  INTO v_journal_id, v_prefix, v_seq
  FROM erp_journals
  WHERE org_id = p_org_id AND journal_code = p_journal_code
  FOR UPDATE;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Journal % not found for org %', p_journal_code, p_org_id;
  END IF;

  -- Incrémenter le numéro
  UPDATE erp_journals SET next_sequence_number = v_seq + 1 WHERE id = v_journal_id;

  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_prefix := COALESCE(v_prefix, p_journal_code);

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider l'équilibre d'une écriture
CREATE OR REPLACE FUNCTION validate_entry_balance(p_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total_debit DECIMAL(15,2);
  v_total_credit DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM erp_journal_lines
  WHERE entry_id = p_entry_id;

  RETURN v_total_debit = v_total_credit AND v_total_debit > 0;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les totaux d'une écriture
CREATE OR REPLACE FUNCTION update_entry_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE erp_journal_entries
  SET
    total_debit = (SELECT COALESCE(SUM(debit), 0) FROM erp_journal_lines WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id)),
    total_credit = (SELECT COALESCE(SUM(credit), 0) FROM erp_journal_lines WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id))
  WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_entry_totals
AFTER INSERT OR UPDATE OR DELETE ON erp_journal_lines
FOR EACH ROW EXECUTE FUNCTION update_entry_totals();

-- Fonction pour vérifier si une période est ouverte
CREATE OR REPLACE FUNCTION is_period_open(p_org_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_status VARCHAR;
BEGIN
  SELECT status INTO v_status
  FROM erp_fiscal_periods
  WHERE org_id = p_org_id
    AND p_date BETWEEN start_date AND end_date
  ORDER BY start_date DESC
  LIMIT 1;

  -- Si pas de période définie, considérer comme ouverte
  IF v_status IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_status IN ('open', 'closing');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DONNÉES INITIALES - PLAN COMPTABLE PCG SIMPLIFIÉ
-- =====================================================

-- Fonction pour initialiser le plan comptable d'une organisation
CREATE OR REPLACE FUNCTION init_pcg_accounts(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Classe 1 : Comptes de capitaux
  INSERT INTO erp_accounts (org_id, account_code, account_name, account_class, account_type) VALUES
    (p_org_id, '101000', 'Capital social', '1', 'equity'),
    (p_org_id, '108000', 'Compte de l''exploitant', '1', 'equity'),
    (p_org_id, '110000', 'Report à nouveau', '1', 'equity'),
    (p_org_id, '120000', 'Résultat de l''exercice (bénéfice)', '1', 'equity'),
    (p_org_id, '129000', 'Résultat de l''exercice (perte)', '1', 'equity')
  ON CONFLICT (org_id, account_code) DO NOTHING;

  -- Classe 2 : Comptes d'immobilisations
  INSERT INTO erp_accounts (org_id, account_code, account_name, account_class, account_type) VALUES
    (p_org_id, '211000', 'Terrains', '2', 'asset'),
    (p_org_id, '213000', 'Constructions', '2', 'asset'),
    (p_org_id, '215000', 'Installations techniques', '2', 'asset'),
    (p_org_id, '218100', 'Mobilier', '2', 'asset'),
    (p_org_id, '218300', 'Matériel informatique', '2', 'asset')
  ON CONFLICT (org_id, account_code) DO NOTHING;

  -- Classe 4 : Comptes de tiers
  INSERT INTO erp_accounts (org_id, account_code, account_name, account_class, account_type, is_reconcilable) VALUES
    (p_org_id, '401000', 'Fournisseurs', '4', 'liability', true),
    (p_org_id, '411000', 'Clients', '4', 'asset', true),
    (p_org_id, '421000', 'Personnel - Rémunérations dues', '4', 'liability', true),
    (p_org_id, '431000', 'Sécurité sociale', '4', 'liability', false),
    (p_org_id, '445500', 'TVA à décaisser', '4', 'liability', false),
    (p_org_id, '445660', 'TVA déductible sur biens et services', '4', 'asset', false),
    (p_org_id, '445710', 'TVA collectée', '4', 'liability', false),
    (p_org_id, '445800', 'TVA à régulariser', '4', 'liability', false),
    (p_org_id, '467000', 'Autres comptes débiteurs ou créditeurs', '4', 'asset', false)
  ON CONFLICT (org_id, account_code) DO NOTHING;

  -- Classe 5 : Comptes financiers
  INSERT INTO erp_accounts (org_id, account_code, account_name, account_class, account_type, is_reconcilable) VALUES
    (p_org_id, '512000', 'Banque', '5', 'asset', true),
    (p_org_id, '512100', 'Banque - Compte principal', '5', 'asset', true),
    (p_org_id, '530000', 'Caisse', '5', 'asset', true),
    (p_org_id, '580000', 'Virements internes', '5', 'asset', false)
  ON CONFLICT (org_id, account_code) DO NOTHING;

  -- Classe 6 : Comptes de charges
  INSERT INTO erp_accounts (org_id, account_code, account_name, account_class, account_type, default_vat_rate) VALUES
    (p_org_id, '601000', 'Achats de matières premières', '6', 'expense', 20),
    (p_org_id, '602000', 'Achats d''approvisionnements', '6', 'expense', 20),
    (p_org_id, '604000', 'Achats d''études et prestations', '6', 'expense', 20),
    (p_org_id, '606100', 'Fournitures non stockables (eau, énergie)', '6', 'expense', 20),
    (p_org_id, '606300', 'Fournitures d''entretien', '6', 'expense', 20),
    (p_org_id, '606400', 'Fournitures administratives', '6', 'expense', 20),
    (p_org_id, '607000', 'Achats de marchandises', '6', 'expense', 20),
    (p_org_id, '613200', 'Locations immobilières', '6', 'expense', 20),
    (p_org_id, '615000', 'Entretien et réparations', '6', 'expense', 20),
    (p_org_id, '616000', 'Primes d''assurance', '6', 'expense', 20),
    (p_org_id, '622600', 'Honoraires', '6', 'expense', 20),
    (p_org_id, '623000', 'Publicité, publications', '6', 'expense', 20),
    (p_org_id, '625100', 'Voyages et déplacements', '6', 'expense', 20),
    (p_org_id, '625600', 'Missions', '6', 'expense', 20),
    (p_org_id, '625700', 'Réceptions', '6', 'expense', 10),
    (p_org_id, '626000', 'Frais postaux et télécom', '6', 'expense', 20),
    (p_org_id, '627000', 'Services bancaires', '6', 'expense', 0),
    (p_org_id, '641000', 'Rémunérations du personnel', '6', 'expense', NULL),
    (p_org_id, '645000', 'Charges de sécurité sociale', '6', 'expense', NULL),
    (p_org_id, '671000', 'Charges exceptionnelles', '6', 'expense', 20)
  ON CONFLICT (org_id, account_code) DO NOTHING;

  -- Classe 7 : Comptes de produits
  INSERT INTO erp_accounts (org_id, account_code, account_name, account_class, account_type, default_vat_rate) VALUES
    (p_org_id, '701000', 'Ventes de produits finis', '7', 'income', 20),
    (p_org_id, '706000', 'Prestations de services', '7', 'income', 20),
    (p_org_id, '707000', 'Ventes de marchandises', '7', 'income', 20),
    (p_org_id, '708500', 'Ports et frais accessoires facturés', '7', 'income', 20),
    (p_org_id, '758000', 'Produits divers de gestion courante', '7', 'income', 20),
    (p_org_id, '771000', 'Produits exceptionnels', '7', 'income', 20)
  ON CONFLICT (org_id, account_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour initialiser les journaux d'une organisation
CREATE OR REPLACE FUNCTION init_journals(p_org_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO erp_journals (org_id, journal_code, journal_name, journal_type, default_account_code, sequence_prefix) VALUES
    (p_org_id, 'VE', 'Journal des Ventes', 'sale', '411000', 'VE'),
    (p_org_id, 'AC', 'Journal des Achats', 'purchase', '401000', 'AC'),
    (p_org_id, 'BQ', 'Journal de Banque', 'bank', '512000', 'BQ'),
    (p_org_id, 'CA', 'Journal de Caisse', 'cash', '530000', 'CA'),
    (p_org_id, 'OD', 'Opérations Diverses', 'misc', NULL, 'OD'),
    (p_org_id, 'AN', 'À Nouveaux', 'opening', NULL, 'AN')
  ON CONFLICT (org_id, journal_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour initialiser les règles de comptabilisation
CREATE OR REPLACE FUNCTION init_accounting_rules(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Règle 1: Facturation client (vente TTC)
  INSERT INTO erp_accounting_rules (org_id, rule_code, rule_name, event_type, journal_code, line_templates, priority)
  VALUES (
    p_org_id,
    'CUSTOMER_INVOICE_POST',
    'Comptabilisation facture client',
    'customer_invoice_validated',
    'VE',
    '[
      {
        "account_expression": "411000",
        "debit_expression": "source.total_ttc",
        "credit_expression": "0",
        "description_template": "Client {partner_name} - Facture {source_ref}",
        "partner_expression": "source.client_id"
      },
      {
        "account_expression": "706000",
        "debit_expression": "0",
        "credit_expression": "source.total_ht",
        "description_template": "Ventes - Facture {source_ref}",
        "partner_expression": null
      },
      {
        "account_expression": "445710",
        "debit_expression": "0",
        "credit_expression": "source.total_tva",
        "description_template": "TVA collectée - Facture {source_ref}",
        "partner_expression": null
      }
    ]'::jsonb,
    100
  )
  ON CONFLICT (org_id, rule_code) DO UPDATE SET line_templates = EXCLUDED.line_templates;

  -- Règle 2: Facture fournisseur (achat TTC)
  INSERT INTO erp_accounting_rules (org_id, rule_code, rule_name, event_type, journal_code, line_templates, priority)
  VALUES (
    p_org_id,
    'SUPPLIER_INVOICE_POST',
    'Comptabilisation facture fournisseur',
    'supplier_invoice_validated',
    'AC',
    '[
      {
        "account_expression": "expense_account",
        "debit_expression": "source.total_ht",
        "credit_expression": "0",
        "description_template": "{supplier_name} - Facture {source_ref}",
        "partner_expression": null
      },
      {
        "account_expression": "445660",
        "debit_expression": "source.total_tva",
        "credit_expression": "0",
        "description_template": "TVA déductible - Facture {source_ref}",
        "partner_expression": null
      },
      {
        "account_expression": "401000",
        "debit_expression": "0",
        "credit_expression": "source.total_ttc",
        "description_template": "Fournisseur {partner_name} - Facture {source_ref}",
        "partner_expression": "source.supplier_id"
      }
    ]'::jsonb,
    100
  )
  ON CONFLICT (org_id, rule_code) DO UPDATE SET line_templates = EXCLUDED.line_templates;

  -- Règle 3: Encaissement client
  INSERT INTO erp_accounting_rules (org_id, rule_code, rule_name, event_type, journal_code, line_templates, priority)
  VALUES (
    p_org_id,
    'PAYMENT_IN',
    'Encaissement client',
    'payment_received',
    'BQ',
    '[
      {
        "account_expression": "512000",
        "debit_expression": "source.amount",
        "credit_expression": "0",
        "description_template": "Encaissement {partner_name} - {source_ref}",
        "partner_expression": null
      },
      {
        "account_expression": "411000",
        "debit_expression": "0",
        "credit_expression": "source.amount",
        "description_template": "Règlement client {partner_name}",
        "partner_expression": "source.client_id"
      }
    ]'::jsonb,
    100
  )
  ON CONFLICT (org_id, rule_code) DO UPDATE SET line_templates = EXCLUDED.line_templates;

  -- Règle 4: Décaissement fournisseur
  INSERT INTO erp_accounting_rules (org_id, rule_code, rule_name, event_type, journal_code, line_templates, priority)
  VALUES (
    p_org_id,
    'PAYMENT_OUT',
    'Décaissement fournisseur',
    'payment_sent',
    'BQ',
    '[
      {
        "account_expression": "401000",
        "debit_expression": "source.amount",
        "credit_expression": "0",
        "description_template": "Règlement fournisseur {partner_name}",
        "partner_expression": "source.supplier_id"
      },
      {
        "account_expression": "512000",
        "debit_expression": "0",
        "credit_expression": "source.amount",
        "description_template": "Décaissement {partner_name} - {source_ref}",
        "partner_expression": null
      }
    ]'::jsonb,
    100
  )
  ON CONFLICT (org_id, rule_code) DO UPDATE SET line_templates = EXCLUDED.line_templates;

  -- Règle 5: Note de frais / dépense
  INSERT INTO erp_accounting_rules (org_id, rule_code, rule_name, event_type, journal_code, line_templates, priority)
  VALUES (
    p_org_id,
    'EXPENSE_RECORD',
    'Enregistrement dépense',
    'expense_recorded',
    'AC',
    '[
      {
        "account_expression": "expense_account",
        "debit_expression": "source.amount_ht",
        "credit_expression": "0",
        "description_template": "{description}",
        "partner_expression": null
      },
      {
        "account_expression": "445660",
        "debit_expression": "source.vat_amount",
        "credit_expression": "0",
        "description_template": "TVA déductible - {description}",
        "partner_expression": null
      },
      {
        "account_expression": "512000",
        "debit_expression": "0",
        "credit_expression": "source.amount",
        "description_template": "Paiement - {description}",
        "partner_expression": null
      }
    ]'::jsonb,
    100
  )
  ON CONFLICT (org_id, rule_code) DO UPDATE SET line_templates = EXCLUDED.line_templates;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MAPPING CATÉGORIES -> COMPTES DE CHARGES
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_expense_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  expense_category VARCHAR(50) NOT NULL,       -- 'office', 'travel', 'meals', etc.
  account_code VARCHAR(10) NOT NULL,           -- '606400', '625100', etc.

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, expense_category)
);

-- Fonction pour initialiser le mapping
CREATE OR REPLACE FUNCTION init_expense_mapping(p_org_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO erp_expense_account_mapping (org_id, expense_category, account_code) VALUES
    (p_org_id, 'office', '606400'),
    (p_org_id, 'travel', '625100'),
    (p_org_id, 'meals', '625700'),
    (p_org_id, 'software', '626000'),
    (p_org_id, 'marketing', '623000'),
    (p_org_id, 'telecom', '626000'),
    (p_org_id, 'rent', '613200'),
    (p_org_id, 'insurance', '616000'),
    (p_org_id, 'maintenance', '615000'),
    (p_org_id, 'other', '671000')
  ON CONFLICT (org_id, expense_category) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TABLE: PAIEMENTS FOURNISSEURS
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_invoice_id UUID REFERENCES erp_supplier_invoices(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES erp_suppliers(id) ON DELETE SET NULL,

  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Method
  payment_method VARCHAR(30) DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'card', 'paypal', 'stripe', 'other')),
  reference VARCHAR(100),

  -- Notes
  notes TEXT,

  -- Accounting
  journal_entry_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_erp_supplier_payments_org ON erp_supplier_payments(org_id);
CREATE INDEX idx_erp_supplier_payments_supplier ON erp_supplier_payments(supplier_id);
CREATE INDEX idx_erp_supplier_payments_invoice ON erp_supplier_payments(supplier_invoice_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Activer RLS
ALTER TABLE erp_supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_accounting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_accounting_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_expense_account_mapping ENABLE ROW LEVEL SECURITY;

-- Policies pour erp_accounts
CREATE POLICY "Users can view their org accounts" ON erp_accounts
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage accounts" ON erp_accounts
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policies pour erp_journal_entries
CREATE POLICY "Users can view their org entries" ON erp_journal_entries
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage entries" ON erp_journal_entries
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policies pour erp_journal_lines (via entry)
CREATE POLICY "Users can view lines via entry" ON erp_journal_lines
  FOR SELECT USING (
    entry_id IN (
      SELECT id FROM erp_journal_entries
      WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage lines" ON erp_journal_lines
  FOR ALL USING (
    entry_id IN (
      SELECT id FROM erp_journal_entries
      WHERE org_id IN (
        SELECT org_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Policies similaires pour les autres tables
CREATE POLICY "Users can view journals" ON erp_journals
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage journals" ON erp_journals
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can view periods" ON erp_fiscal_periods
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage periods" ON erp_fiscal_periods
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can view rules" ON erp_accounting_rules
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage rules" ON erp_accounting_rules
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can view expense mapping" ON erp_expense_account_mapping
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage expense mapping" ON erp_expense_account_mapping
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can view audit log" ON erp_accounting_audit_log
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view supplier payments" ON erp_supplier_payments
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage supplier payments" ON erp_supplier_payments
  FOR ALL USING (
    org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON TABLE erp_accounts IS 'Plan comptable (Chart of Accounts) - PCG français';
COMMENT ON TABLE erp_journals IS 'Journaux comptables (Ventes, Achats, Banque, OD)';
COMMENT ON TABLE erp_journal_entries IS 'Écritures comptables avec traçabilité source';
COMMENT ON TABLE erp_journal_lines IS 'Lignes d''écritures en partie double';
COMMENT ON TABLE erp_accounting_rules IS 'Templates de génération automatique d''écritures';
COMMENT ON TABLE erp_fiscal_periods IS 'Périodes comptables avec gestion des clôtures';
COMMENT ON TABLE erp_expense_account_mapping IS 'Correspondance catégories de dépenses -> comptes PCG';
