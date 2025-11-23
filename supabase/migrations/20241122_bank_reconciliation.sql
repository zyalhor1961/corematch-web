-- =====================================================
-- RAPPROCHEMENT BANCAIRE & LETTRAGE INTELLIGENT
-- Système 3 niveaux : Déterministe + Scoring + IA
-- =====================================================

-- 1. COMPTES BANCAIRES
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  label VARCHAR(100) NOT NULL,                    -- "Compte principal", "Compte épargne"
  bank_name VARCHAR(100),                         -- "BNP Paribas", "Crédit Agricole"
  iban VARCHAR(34),
  bic VARCHAR(11),
  account_number VARCHAR(50),

  -- Comptabilité
  account_code VARCHAR(10) DEFAULT '512000',      -- Compte PCG associé (512xxx)

  -- Configuration
  currency VARCHAR(3) DEFAULT 'EUR',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Soldes (mis à jour lors des imports)
  last_balance DECIMAL(15,2),
  last_balance_date DATE,

  -- Sync externe (pour intégration bancaire future)
  external_provider VARCHAR(50),                   -- 'plaid', 'bridge', 'nordigen'
  external_account_id VARCHAR(255),
  last_sync_at TIMESTAMPTZ,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, iban)
);

CREATE INDEX idx_erp_bank_accounts_org ON erp_bank_accounts(org_id);

-- 2. RELEVÉS BANCAIRES (STATEMENTS)
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES erp_bank_accounts(id) ON DELETE CASCADE,

  -- Période
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  reference VARCHAR(100),                          -- Numéro de relevé

  -- Soldes
  opening_balance DECIMAL(15,2),
  closing_balance DECIMAL(15,2),

  -- Source
  source_type VARCHAR(20) DEFAULT 'manual',        -- 'manual', 'file_import', 'api_sync'
  source_file_url TEXT,                            -- URL fichier source (OFX, CSV, PDF)
  source_file_name VARCHAR(255),

  -- Statut
  status VARCHAR(20) DEFAULT 'imported',           -- 'imported', 'processing', 'reconciled', 'closed'
  transaction_count INTEGER DEFAULT 0,
  reconciled_count INTEGER DEFAULT 0,

  -- Métadonnées
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  reconciled_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_bank_statements_account ON erp_bank_statements(bank_account_id);
CREATE INDEX idx_erp_bank_statements_period ON erp_bank_statements(org_id, period_start, period_end);

-- 3. TRANSACTIONS BANCAIRES
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES erp_bank_accounts(id) ON DELETE CASCADE,
  bank_statement_id UUID REFERENCES erp_bank_statements(id) ON DELETE SET NULL,

  -- Dates
  operation_date DATE NOT NULL,                    -- Date d'opération
  value_date DATE,                                 -- Date de valeur

  -- Montant
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit', 'debit')),

  -- Libellés
  label_raw TEXT NOT NULL,                         -- Libellé brut bancaire
  label_clean TEXT,                                -- Libellé nettoyé/normalisé
  label_category VARCHAR(50),                      -- Catégorie détectée (virement, prélèvement, CB, etc.)

  -- Références bancaires
  bank_reference VARCHAR(100),                     -- Référence unique banque
  counterparty_name VARCHAR(255),                  -- Nom du tiers détecté
  counterparty_iban VARCHAR(34),                   -- IBAN du tiers (si virement SEPA)
  counterparty_bic VARCHAR(11),
  check_number VARCHAR(20),                        -- N° de chèque si applicable
  card_last_digits VARCHAR(4),                     -- 4 derniers chiffres CB

  -- Extraction IA (rempli par le Niveau 3)
  ai_extracted_invoice_ref VARCHAR(100),           -- Référence facture détectée
  ai_extracted_client_name VARCHAR(255),           -- Nom client détecté
  ai_extracted_supplier_name VARCHAR(255),         -- Nom fournisseur détecté
  ai_operation_type VARCHAR(50),                   -- Type détecté par IA
  ai_confidence DECIMAL(3,2),                      -- Score confiance IA (0-1)
  ai_extracted_at TIMESTAMPTZ,

  -- Statut rapprochement
  reconciliation_status VARCHAR(20) DEFAULT 'unmatched'
    CHECK (reconciliation_status IN ('unmatched', 'suggested', 'matched', 'suspicious', 'ignored')),
  reconciliation_score DECIMAL(3,2),               -- Score de confiance du match (0-1)

  -- Métadonnées
  external_id VARCHAR(255),                        -- ID externe (sync bancaire)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_bank_transactions_account ON erp_bank_transactions(bank_account_id);
CREATE INDEX idx_erp_bank_transactions_date ON erp_bank_transactions(org_id, operation_date);
CREATE INDEX idx_erp_bank_transactions_status ON erp_bank_transactions(org_id, reconciliation_status);
CREATE INDEX idx_erp_bank_transactions_amount ON erp_bank_transactions(org_id, amount);

-- 4. MATCHES DE RÉCONCILIATION
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES erp_bank_transactions(id) ON DELETE CASCADE,

  -- Type de match
  match_type VARCHAR(30) NOT NULL CHECK (match_type IN (
    'customer_invoice',      -- Encaissement facture client
    'supplier_invoice',      -- Paiement facture fournisseur
    'customer_payment',      -- Paiement client (sans facture directe)
    'supplier_payment',      -- Décaissement fournisseur
    'expense',               -- Dépense/frais
    'bank_fee',              -- Frais bancaires
    'salary',                -- Salaire
    'tax',                   -- Impôts/taxes
    'transfer',              -- Virement interne
    'loan',                  -- Prêt/emprunt
    'other',                 -- Autre
    'unknown'                -- Non identifié
  )),

  -- Références aux entités matchées (une seule active par type)
  matched_invoice_id UUID,                          -- Facture client matchée
  matched_supplier_invoice_id UUID,                 -- Facture fournisseur matchée
  matched_payment_id UUID,                          -- Paiement matchée (erp_payments)
  matched_supplier_payment_id UUID,                 -- Paiement fournisseur (erp_supplier_payments)
  matched_expense_id UUID,                          -- Dépense matchée
  matched_journal_entry_id UUID,                    -- Écriture comptable liée

  -- Multi-factures (lettrage groupé)
  matched_invoice_ids UUID[],                       -- Array de factures pour paiement groupé
  matched_supplier_invoice_ids UUID[],              -- Array de factures fournisseur

  -- Montants
  matched_amount DECIMAL(15,2) NOT NULL,            -- Montant rapproché
  remaining_amount DECIMAL(15,2) DEFAULT 0,         -- Reste à rapprocher (si partiel)

  -- Scoring
  match_rule VARCHAR(50),                           -- Règle utilisée ('exact_amount', 'invoice_ref', 'iban_match', etc.)
  confidence_score DECIMAL(3,2) NOT NULL,           -- Score de confiance (0-1)
  is_auto_match BOOLEAN DEFAULT false,              -- Match automatique (score >= 0.9)

  -- Validation
  status VARCHAR(20) DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected', 'modified')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_reconciliation_matches_transaction ON erp_reconciliation_matches(bank_transaction_id);
CREATE INDEX idx_erp_reconciliation_matches_status ON erp_reconciliation_matches(org_id, status);
CREATE INDEX idx_erp_reconciliation_matches_invoice ON erp_reconciliation_matches(matched_invoice_id) WHERE matched_invoice_id IS NOT NULL;

-- 5. LETTRAGE COMPTABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_account_lettrage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Compte concerné
  account_code VARCHAR(10) NOT NULL,                -- 411xxx (clients) ou 401xxx (fournisseurs)
  partner_type VARCHAR(20) NOT NULL CHECK (partner_type IN ('client', 'supplier')),
  partner_id UUID,                                   -- ID client ou fournisseur

  -- Lettre
  lettrage_code VARCHAR(10) NOT NULL,               -- Code lettre (A, B, C, AA, AB...)
  lettrage_date DATE NOT NULL,

  -- Montant lettré
  total_debit DECIMAL(15,2) DEFAULT 0,
  total_credit DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,                   -- Doit être 0 si lettrage équilibré

  -- Statut
  status VARCHAR(20) DEFAULT 'partial' CHECK (status IN ('partial', 'balanced', 'cancelled')),

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, lettrage_code)
);

CREATE INDEX idx_erp_account_lettrage_account ON erp_account_lettrage(org_id, account_code);
CREATE INDEX idx_erp_account_lettrage_partner ON erp_account_lettrage(org_id, partner_type, partner_id);

-- 6. LIGNES DE LETTRAGE
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_account_lettrage_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lettrage_id UUID NOT NULL REFERENCES erp_account_lettrage(id) ON DELETE CASCADE,

  -- Écriture concernée
  journal_entry_id UUID NOT NULL REFERENCES erp_journal_entries(id) ON DELETE CASCADE,
  journal_line_id UUID NOT NULL REFERENCES erp_journal_lines(id) ON DELETE CASCADE,

  -- Montant lettré (peut être partiel)
  lettered_amount DECIMAL(15,2) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_lettrage_lines_lettrage ON erp_account_lettrage_lines(lettrage_id);
CREATE INDEX idx_erp_lettrage_lines_entry ON erp_account_lettrage_lines(journal_entry_id);

-- 7. RÈGLES DE MATCHING
-- =====================================================
CREATE TABLE IF NOT EXISTS erp_reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Type de règle
  rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('deterministic', 'scoring', 'ai')),
  match_level INTEGER DEFAULT 1,                     -- 1=déterministe, 2=scoring, 3=IA

  -- Conditions (JSON)
  conditions JSONB NOT NULL,
  /* Exemple conditions:
    {
      "amount_tolerance": 0,
      "date_window_days": 5,
      "require_iban_match": true,
      "require_invoice_ref": false,
      "label_patterns": ["FAC-", "FACTURE"]
    }
  */

  -- Scoring (pour règles niveau 2)
  score_weights JSONB,
  /* Exemple weights:
    {
      "exact_amount": 0.3,
      "date_proximity": 0.2,
      "name_similarity": 0.2,
      "iban_match": 0.2,
      "invoice_ref_found": 0.1
    }
  */

  -- Action
  auto_match_threshold DECIMAL(3,2) DEFAULT 0.9,     -- Score min pour auto-match
  suggestion_threshold DECIMAL(3,2) DEFAULT 0.6,     -- Score min pour suggestion

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,                       -- Plus petit = plus prioritaire

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, rule_code)
);

-- 8. FONCTIONS UTILITAIRES
-- =====================================================

-- Génération du prochain code lettre
CREATE OR REPLACE FUNCTION generate_next_lettrage_code(p_org_id UUID)
RETURNS VARCHAR(10) AS $$
DECLARE
  v_last_code VARCHAR(10);
  v_next_code VARCHAR(10);
BEGIN
  SELECT lettrage_code INTO v_last_code
  FROM erp_account_lettrage
  WHERE org_id = p_org_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_code IS NULL THEN
    RETURN 'A';
  END IF;

  -- Logique d'incrémentation: A->B->...->Z->AA->AB->...
  IF LENGTH(v_last_code) = 1 THEN
    IF v_last_code = 'Z' THEN
      RETURN 'AA';
    ELSE
      RETURN CHR(ASCII(v_last_code) + 1);
    END IF;
  ELSE
    -- Pour codes multi-caractères, incrémenter le dernier
    IF SUBSTRING(v_last_code, LENGTH(v_last_code), 1) = 'Z' THEN
      RETURN v_last_code || 'A';
    ELSE
      RETURN SUBSTRING(v_last_code, 1, LENGTH(v_last_code) - 1) ||
             CHR(ASCII(SUBSTRING(v_last_code, LENGTH(v_last_code), 1)) + 1);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Calcul de similarité de texte (pour scoring)
CREATE OR REPLACE FUNCTION text_similarity_score(text1 TEXT, text2 TEXT)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  v_text1 TEXT;
  v_text2 TEXT;
  v_common INTEGER := 0;
  v_total INTEGER;
  v_word TEXT;
BEGIN
  IF text1 IS NULL OR text2 IS NULL THEN
    RETURN 0;
  END IF;

  v_text1 := UPPER(TRIM(text1));
  v_text2 := UPPER(TRIM(text2));

  IF v_text1 = v_text2 THEN
    RETURN 1.0;
  END IF;

  -- Compter les mots communs
  v_total := 0;
  FOR v_word IN SELECT UNNEST(STRING_TO_ARRAY(v_text1, ' ')) LOOP
    IF LENGTH(v_word) > 2 THEN
      v_total := v_total + 1;
      IF POSITION(v_word IN v_text2) > 0 THEN
        v_common := v_common + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_total = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND(v_common::DECIMAL / v_total, 2);
END;
$$ LANGUAGE plpgsql;

-- 9. INITIALISATION DES RÈGLES PAR DÉFAUT
-- =====================================================
CREATE OR REPLACE FUNCTION init_reconciliation_rules(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Règle 1: Match exact montant + IBAN (Niveau 1)
  INSERT INTO erp_reconciliation_rules (org_id, rule_code, rule_name, rule_type, match_level, conditions, priority)
  VALUES (
    p_org_id,
    'EXACT_AMOUNT_IBAN',
    'Montant exact + même IBAN',
    'deterministic',
    1,
    '{"amount_tolerance": 0, "require_iban_match": true, "date_window_days": 10}'::jsonb,
    10
  ) ON CONFLICT (org_id, rule_code) DO NOTHING;

  -- Règle 2: Référence facture dans libellé (Niveau 1)
  INSERT INTO erp_reconciliation_rules (org_id, rule_code, rule_name, rule_type, match_level, conditions, priority)
  VALUES (
    p_org_id,
    'INVOICE_REF_IN_LABEL',
    'Référence facture dans libellé',
    'deterministic',
    1,
    '{"require_invoice_ref": true, "amount_tolerance": 0.01}'::jsonb,
    20
  ) ON CONFLICT (org_id, rule_code) DO NOTHING;

  -- Règle 3: Match exact montant + nom client (Niveau 1)
  INSERT INTO erp_reconciliation_rules (org_id, rule_code, rule_name, rule_type, match_level, conditions, priority)
  VALUES (
    p_org_id,
    'EXACT_AMOUNT_NAME',
    'Montant exact + nom client/fournisseur',
    'deterministic',
    1,
    '{"amount_tolerance": 0, "require_name_match": true, "name_similarity_min": 0.8, "date_window_days": 15}'::jsonb,
    30
  ) ON CONFLICT (org_id, rule_code) DO NOTHING;

  -- Règle 4: Scoring multi-critères (Niveau 2)
  INSERT INTO erp_reconciliation_rules (org_id, rule_code, rule_name, rule_type, match_level, conditions, score_weights, priority)
  VALUES (
    p_org_id,
    'MULTI_CRITERIA_SCORING',
    'Scoring multi-critères',
    'scoring',
    2,
    '{"date_window_days": 30, "amount_tolerance": 0.05}'::jsonb,
    '{"exact_amount": 0.35, "date_proximity": 0.15, "name_similarity": 0.25, "iban_match": 0.15, "invoice_ref_found": 0.10}'::jsonb,
    100
  ) ON CONFLICT (org_id, rule_code) DO NOTHING;

  -- Règle 5: Extraction IA libellé (Niveau 3)
  INSERT INTO erp_reconciliation_rules (org_id, rule_code, rule_name, rule_type, match_level, conditions, priority)
  VALUES (
    p_org_id,
    'AI_LABEL_EXTRACTION',
    'Extraction IA du libellé bancaire',
    'ai',
    3,
    '{"use_llm": true, "extract_fields": ["invoice_ref", "client_name", "supplier_name", "operation_type"]}'::jsonb,
    200
  ) ON CONFLICT (org_id, rule_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 10. RLS POLICIES
-- =====================================================
ALTER TABLE erp_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_account_lettrage ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_account_lettrage_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_reconciliation_rules ENABLE ROW LEVEL SECURITY;

-- Policies pour bank_accounts
CREATE POLICY "Users can view their org bank accounts" ON erp_bank_accounts
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage bank accounts" ON erp_bank_accounts
  FOR ALL USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Policies pour bank_statements
CREATE POLICY "Users can view their org bank statements" ON erp_bank_statements
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage bank statements" ON erp_bank_statements
  FOR ALL USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Policies pour bank_transactions
CREATE POLICY "Users can view their org bank transactions" ON erp_bank_transactions
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage bank transactions" ON erp_bank_transactions
  FOR ALL USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Policies pour reconciliation_matches
CREATE POLICY "Users can view their org reconciliation matches" ON erp_reconciliation_matches
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage reconciliation matches" ON erp_reconciliation_matches
  FOR ALL USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Policies pour lettrage
CREATE POLICY "Users can view their org lettrage" ON erp_account_lettrage
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage lettrage" ON erp_account_lettrage
  FOR ALL USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Users can view lettrage lines" ON erp_account_lettrage_lines
  FOR SELECT USING (lettrage_id IN (SELECT id FROM erp_account_lettrage WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY "Admins can manage lettrage lines" ON erp_account_lettrage_lines
  FOR ALL USING (lettrage_id IN (SELECT id FROM erp_account_lettrage WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))));

-- Policies pour rules
CREATE POLICY "Users can view reconciliation rules" ON erp_reconciliation_rules
  FOR SELECT USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage reconciliation rules" ON erp_reconciliation_rules
  FOR ALL USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- 11. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE erp_bank_accounts IS 'Comptes bancaires de l''organisation';
COMMENT ON TABLE erp_bank_statements IS 'Relevés bancaires importés';
COMMENT ON TABLE erp_bank_transactions IS 'Transactions bancaires avec statut de rapprochement';
COMMENT ON TABLE erp_reconciliation_matches IS 'Associations transaction bancaire ↔ facture/paiement';
COMMENT ON TABLE erp_account_lettrage IS 'Lettrage comptable des comptes tiers (411/401)';
COMMENT ON TABLE erp_reconciliation_rules IS 'Règles de matching configurables par niveau';
