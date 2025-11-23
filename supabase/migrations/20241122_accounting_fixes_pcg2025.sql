-- =============================================================================
-- MIGRATION: Corrections comptables + Plan Comptable Général 2025
-- Date: 2024-11-22
-- Description: Corrige le schéma de lettrage, ajoute les colonnes manquantes,
--              et initialise le PCG 2025 complet
-- =============================================================================

-- =============================================================================
-- 0. CORRECTIONS TABLE erp_expenses (colonnes manquantes)
-- =============================================================================

ALTER TABLE erp_expenses
ADD COLUMN IF NOT EXISTS reference VARCHAR(100);

ALTER TABLE erp_expenses
ADD COLUMN IF NOT EXISTS journal_entry_id UUID;

ALTER TABLE erp_expenses
ADD COLUMN IF NOT EXISTS amount_ht DECIMAL(15,2) DEFAULT 0;

ALTER TABLE erp_expenses
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20;

-- =============================================================================
-- 1. CORRECTIONS TABLE erp_journal_entries
-- Ajouter les colonnes manquantes pour le lettrage
-- =============================================================================

-- Colonnes pour le lettrage
ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS is_lettred BOOLEAN DEFAULT FALSE;

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS lettrage_code VARCHAR(20);

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS piece_number VARCHAR(50);

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS piece_date DATE;

-- Colonnes pour la référence tiers
ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(20); -- 'client', 'supplier', 'employee'

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Colonnes pour le compte
ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS account_code VARCHAR(20);

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS account_label VARCHAR(255);

-- Colonnes débit/crédit (si utilisation ligne par ligne)
ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS debit DECIMAL(15,2) DEFAULT 0;

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS credit DECIMAL(15,2) DEFAULT 0;

ALTER TABLE erp_journal_entries
ADD COLUMN IF NOT EXISTS label TEXT;

-- Index pour le lettrage
CREATE INDEX IF NOT EXISTS idx_journal_entries_lettrage
ON erp_journal_entries(org_id, account_code, is_lettred);

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference
ON erp_journal_entries(reference_type, reference_id);

-- =============================================================================
-- 2. TABLE erp_account_lettrage (si n'existe pas ou à corriger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS erp_account_lettrage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lettrage_code VARCHAR(20) NOT NULL,
  account_type VARCHAR(20) NOT NULL DEFAULT 'client', -- 'client' ou 'supplier'
  account_code VARCHAR(20),
  entity_id UUID, -- client_id ou supplier_id
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'balanced', -- 'partial', 'balanced', 'cancelled'
  is_auto BOOLEAN DEFAULT FALSE,
  lettrage_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(org_id, lettrage_code)
);

-- Ajouter colonnes manquantes si table existe déjà
ALTER TABLE erp_account_lettrage
ADD COLUMN IF NOT EXISTS account_code VARCHAR(20);

ALTER TABLE erp_account_lettrage
ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT FALSE;

ALTER TABLE erp_account_lettrage
ADD COLUMN IF NOT EXISTS lettrage_date DATE DEFAULT CURRENT_DATE;

-- =============================================================================
-- 3. TABLE erp_account_lettrage_lines
-- =============================================================================

CREATE TABLE IF NOT EXISTS erp_account_lettrage_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lettrage_id UUID NOT NULL REFERENCES erp_account_lettrage(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES erp_journal_entries(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(lettrage_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_lettrage_lines_entry
ON erp_account_lettrage_lines(entry_id);

-- =============================================================================
-- 4. FONCTION: Générer le prochain code de lettrage
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_next_lettrage_code(
  p_org_id UUID,
  p_account_type VARCHAR DEFAULT 'client'
)
RETURNS VARCHAR AS $$
DECLARE
  v_count INTEGER;
  v_code VARCHAR(20);
  v_prefix VARCHAR(1);
  v_num INTEGER;
BEGIN
  -- Compter les lettrages existants pour cette org/type
  SELECT COUNT(*) INTO v_count
  FROM erp_account_lettrage
  WHERE org_id = p_org_id AND account_type = p_account_type;

  v_num := v_count + 1;

  -- Générer le code: A, B, ..., Z, AA, AB, ...
  IF v_num <= 26 THEN
    v_code := CHR(64 + v_num);
  ELSE
    v_code := CHR(64 + ((v_num - 1) / 26)) || CHR(65 + ((v_num - 1) % 26));
  END IF;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. TABLE erp_fiscal_periods (Périodes fiscales)
-- =============================================================================

CREATE TABLE IF NOT EXISTS erp_fiscal_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  period_number INTEGER NOT NULL, -- 1-12 pour mensuel, 1-4 pour trimestriel
  period_type VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'quarterly', 'annual'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'closing', 'closed', 'locked'
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID REFERENCES auth.users(id),
  opening_balance DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(org_id, fiscal_year, period_number, period_type)
);

-- =============================================================================
-- 6. TABLE erp_closing_entries (Écritures de clôture)
-- =============================================================================

CREATE TABLE IF NOT EXISTS erp_closing_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_period_id UUID NOT NULL REFERENCES erp_fiscal_periods(id),
  closing_type VARCHAR(30) NOT NULL, -- 'income_expense', 'retained_earnings', 'opening'
  journal_entry_id UUID REFERENCES erp_journal_entries(id),
  total_amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 7. PLAN COMPTABLE GÉNÉRAL 2025 (PCG France)
-- Table mise à jour avec le plan complet
-- =============================================================================

-- Supprimer les anciens comptes système pour les remplacer
DELETE FROM erp_chart_of_accounts WHERE is_system = TRUE;

-- Fonction pour initialiser le PCG 2025 complet
CREATE OR REPLACE FUNCTION init_pcg_2025(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Vérifier si déjà initialisé
  IF EXISTS (SELECT 1 FROM erp_chart_of_accounts WHERE org_id = p_org_id AND is_system = TRUE LIMIT 1) THEN
    RETURN 0;
  END IF;

  -- =========================================================================
  -- CLASSE 1 - COMPTES DE CAPITAUX
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  -- Capital
  (p_org_id, '10', 'Capital et réserves', 'equity', 'capital', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '101', 'Capital', 'equity', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '1011', 'Capital souscrit - non appelé', 'equity', 'capital', '101', 3, TRUE, 'PCG'),
  (p_org_id, '1012', 'Capital souscrit - appelé, non versé', 'equity', 'capital', '101', 3, TRUE, 'PCG'),
  (p_org_id, '1013', 'Capital souscrit - appelé, versé', 'equity', 'capital', '101', 3, TRUE, 'PCG'),
  (p_org_id, '104', 'Primes liées au capital social', 'equity', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '106', 'Réserves', 'equity', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '1061', 'Réserve légale', 'equity', 'capital', '106', 3, TRUE, 'PCG'),
  (p_org_id, '1063', 'Réserves statutaires', 'equity', 'capital', '106', 3, TRUE, 'PCG'),
  (p_org_id, '1064', 'Réserves réglementées', 'equity', 'capital', '106', 3, TRUE, 'PCG'),
  (p_org_id, '1068', 'Autres réserves', 'equity', 'capital', '106', 3, TRUE, 'PCG'),
  (p_org_id, '108', 'Compte de l''exploitant', 'equity', 'capital', '10', 2, TRUE, 'PCG'),

  -- Report à nouveau
  (p_org_id, '11', 'Report à nouveau', 'equity', 'retained_earnings', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '110', 'Report à nouveau (solde créditeur)', 'equity', 'retained_earnings', '11', 2, TRUE, 'PCG'),
  (p_org_id, '119', 'Report à nouveau (solde débiteur)', 'equity', 'retained_earnings', '11', 2, TRUE, 'PCG'),

  -- Résultat
  (p_org_id, '12', 'Résultat de l''exercice', 'equity', 'result', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '120', 'Résultat de l''exercice (bénéfice)', 'equity', 'result', '12', 2, TRUE, 'PCG'),
  (p_org_id, '129', 'Résultat de l''exercice (perte)', 'equity', 'result', '12', 2, TRUE, 'PCG'),

  -- Subventions
  (p_org_id, '13', 'Subventions d''investissement', 'equity', 'grants', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '131', 'Subventions d''équipement', 'equity', 'grants', '13', 2, TRUE, 'PCG'),

  -- Provisions réglementées
  (p_org_id, '14', 'Provisions réglementées', 'equity', 'provisions', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '142', 'Provisions réglementées relatives aux immobilisations', 'equity', 'provisions', '14', 2, TRUE, 'PCG'),
  (p_org_id, '145', 'Amortissements dérogatoires', 'equity', 'provisions', '14', 2, TRUE, 'PCG'),

  -- Provisions pour risques
  (p_org_id, '15', 'Provisions', 'liability', 'provisions', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '151', 'Provisions pour risques', 'liability', 'provisions', '15', 2, TRUE, 'PCG'),
  (p_org_id, '153', 'Provisions pour pensions', 'liability', 'provisions', '15', 2, TRUE, 'PCG'),
  (p_org_id, '155', 'Provisions pour impôts', 'liability', 'provisions', '15', 2, TRUE, 'PCG'),
  (p_org_id, '158', 'Autres provisions pour charges', 'liability', 'provisions', '15', 2, TRUE, 'PCG'),

  -- Emprunts
  (p_org_id, '16', 'Emprunts et dettes assimilées', 'liability', 'loans', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '161', 'Emprunts obligataires', 'liability', 'loans', '16', 2, TRUE, 'PCG'),
  (p_org_id, '164', 'Emprunts auprès des établissements de crédit', 'liability', 'loans', '16', 2, TRUE, 'PCG'),
  (p_org_id, '165', 'Dépôts et cautionnements reçus', 'liability', 'loans', '16', 2, TRUE, 'PCG'),
  (p_org_id, '167', 'Emprunts et dettes assortis de conditions particulières', 'liability', 'loans', '16', 2, TRUE, 'PCG'),
  (p_org_id, '168', 'Autres emprunts et dettes assimilées', 'liability', 'loans', '16', 2, TRUE, 'PCG'),

  -- Dettes rattachées
  (p_org_id, '17', 'Dettes rattachées à des participations', 'liability', 'loans', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '171', 'Dettes rattachées à des participations (groupe)', 'liability', 'loans', '17', 2, TRUE, 'PCG'),
  (p_org_id, '174', 'Dettes rattachées à des participations (hors groupe)', 'liability', 'loans', '17', 2, TRUE, 'PCG'),

  -- Comptes de liaison
  (p_org_id, '18', 'Comptes de liaison des établissements', 'equity', 'liaison', NULL, 1, TRUE, 'PCG');

  v_count := v_count + 35;

  -- =========================================================================
  -- CLASSE 2 - COMPTES D'IMMOBILISATIONS
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  -- Immobilisations incorporelles
  (p_org_id, '20', 'Immobilisations incorporelles', 'asset', 'fixed_assets', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '201', 'Frais d''établissement', 'asset', 'fixed_assets', '20', 2, TRUE, 'PCG'),
  (p_org_id, '203', 'Frais de recherche et de développement', 'asset', 'fixed_assets', '20', 2, TRUE, 'PCG'),
  (p_org_id, '205', 'Concessions et droits similaires', 'asset', 'fixed_assets', '20', 2, TRUE, 'PCG'),
  (p_org_id, '206', 'Droit au bail', 'asset', 'fixed_assets', '20', 2, TRUE, 'PCG'),
  (p_org_id, '207', 'Fonds commercial', 'asset', 'fixed_assets', '20', 2, TRUE, 'PCG'),
  (p_org_id, '208', 'Autres immobilisations incorporelles', 'asset', 'fixed_assets', '20', 2, TRUE, 'PCG'),

  -- Immobilisations corporelles
  (p_org_id, '21', 'Immobilisations corporelles', 'asset', 'fixed_assets', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '211', 'Terrains', 'asset', 'fixed_assets', '21', 2, TRUE, 'PCG'),
  (p_org_id, '212', 'Agencements et aménagements de terrains', 'asset', 'fixed_assets', '21', 2, TRUE, 'PCG'),
  (p_org_id, '213', 'Constructions', 'asset', 'fixed_assets', '21', 2, TRUE, 'PCG'),
  (p_org_id, '214', 'Constructions sur sol d''autrui', 'asset', 'fixed_assets', '21', 2, TRUE, 'PCG'),
  (p_org_id, '215', 'Installations techniques, matériel et outillage', 'asset', 'fixed_assets', '21', 2, TRUE, 'PCG'),
  (p_org_id, '218', 'Autres immobilisations corporelles', 'asset', 'fixed_assets', '21', 2, TRUE, 'PCG'),
  (p_org_id, '2181', 'Installations générales', 'asset', 'fixed_assets', '218', 3, TRUE, 'PCG'),
  (p_org_id, '2182', 'Matériel de transport', 'asset', 'fixed_assets', '218', 3, TRUE, 'PCG'),
  (p_org_id, '2183', 'Matériel de bureau et informatique', 'asset', 'fixed_assets', '218', 3, TRUE, 'PCG'),
  (p_org_id, '2184', 'Mobilier', 'asset', 'fixed_assets', '218', 3, TRUE, 'PCG'),

  -- Immobilisations en cours
  (p_org_id, '23', 'Immobilisations en cours', 'asset', 'fixed_assets', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '231', 'Immobilisations corporelles en cours', 'asset', 'fixed_assets', '23', 2, TRUE, 'PCG'),
  (p_org_id, '232', 'Immobilisations incorporelles en cours', 'asset', 'fixed_assets', '23', 2, TRUE, 'PCG'),

  -- Participations
  (p_org_id, '26', 'Participations et créances rattachées', 'asset', 'investments', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '261', 'Titres de participation', 'asset', 'investments', '26', 2, TRUE, 'PCG'),
  (p_org_id, '267', 'Créances rattachées à des participations', 'asset', 'investments', '26', 2, TRUE, 'PCG'),

  -- Autres immobilisations financières
  (p_org_id, '27', 'Autres immobilisations financières', 'asset', 'investments', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '271', 'Titres immobilisés', 'asset', 'investments', '27', 2, TRUE, 'PCG'),
  (p_org_id, '272', 'Titres immobilisés - droits de créance', 'asset', 'investments', '27', 2, TRUE, 'PCG'),
  (p_org_id, '274', 'Prêts', 'asset', 'investments', '27', 2, TRUE, 'PCG'),
  (p_org_id, '275', 'Dépôts et cautionnements versés', 'asset', 'investments', '27', 2, TRUE, 'PCG'),

  -- Amortissements des immobilisations
  (p_org_id, '28', 'Amortissements des immobilisations', 'asset', 'depreciation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '280', 'Amortissements des immobilisations incorporelles', 'asset', 'depreciation', '28', 2, TRUE, 'PCG'),
  (p_org_id, '281', 'Amortissements des immobilisations corporelles', 'asset', 'depreciation', '28', 2, TRUE, 'PCG'),
  (p_org_id, '2811', 'Amortissements des terrains', 'asset', 'depreciation', '281', 3, TRUE, 'PCG'),
  (p_org_id, '2813', 'Amortissements des constructions', 'asset', 'depreciation', '281', 3, TRUE, 'PCG'),
  (p_org_id, '2815', 'Amortissements des installations techniques', 'asset', 'depreciation', '281', 3, TRUE, 'PCG'),
  (p_org_id, '2818', 'Amortissements des autres immobilisations', 'asset', 'depreciation', '281', 3, TRUE, 'PCG'),

  -- Dépréciations
  (p_org_id, '29', 'Dépréciations des immobilisations', 'asset', 'depreciation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '290', 'Dépréciations des immobilisations incorporelles', 'asset', 'depreciation', '29', 2, TRUE, 'PCG'),
  (p_org_id, '291', 'Dépréciations des immobilisations corporelles', 'asset', 'depreciation', '29', 2, TRUE, 'PCG'),
  (p_org_id, '296', 'Dépréciations des participations', 'asset', 'depreciation', '29', 2, TRUE, 'PCG'),
  (p_org_id, '297', 'Dépréciations des autres immobilisations financières', 'asset', 'depreciation', '29', 2, TRUE, 'PCG');

  v_count := v_count + 42;

  -- =========================================================================
  -- CLASSE 3 - COMPTES DE STOCKS ET EN-COURS
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  (p_org_id, '31', 'Matières premières', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '311', 'Matières premières (A)', 'asset', 'inventory', '31', 2, TRUE, 'PCG'),
  (p_org_id, '312', 'Matières premières (B)', 'asset', 'inventory', '31', 2, TRUE, 'PCG'),

  (p_org_id, '32', 'Autres approvisionnements', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '321', 'Matières consommables', 'asset', 'inventory', '32', 2, TRUE, 'PCG'),
  (p_org_id, '322', 'Fournitures consommables', 'asset', 'inventory', '32', 2, TRUE, 'PCG'),
  (p_org_id, '326', 'Emballages', 'asset', 'inventory', '32', 2, TRUE, 'PCG'),

  (p_org_id, '33', 'En-cours de production de biens', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '331', 'Produits en cours', 'asset', 'inventory', '33', 2, TRUE, 'PCG'),
  (p_org_id, '335', 'Travaux en cours', 'asset', 'inventory', '33', 2, TRUE, 'PCG'),

  (p_org_id, '34', 'En-cours de production de services', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '341', 'Études en cours', 'asset', 'inventory', '34', 2, TRUE, 'PCG'),
  (p_org_id, '345', 'Prestations de services en cours', 'asset', 'inventory', '34', 2, TRUE, 'PCG'),

  (p_org_id, '35', 'Stocks de produits', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '351', 'Produits intermédiaires', 'asset', 'inventory', '35', 2, TRUE, 'PCG'),
  (p_org_id, '355', 'Produits finis', 'asset', 'inventory', '35', 2, TRUE, 'PCG'),
  (p_org_id, '358', 'Produits résiduels', 'asset', 'inventory', '35', 2, TRUE, 'PCG'),

  (p_org_id, '37', 'Stocks de marchandises', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '371', 'Marchandises (A)', 'asset', 'inventory', '37', 2, TRUE, 'PCG'),

  (p_org_id, '39', 'Dépréciations des stocks', 'asset', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '391', 'Dépréciations des matières premières', 'asset', 'inventory', '39', 2, TRUE, 'PCG'),
  (p_org_id, '395', 'Dépréciations des stocks de produits', 'asset', 'inventory', '39', 2, TRUE, 'PCG'),
  (p_org_id, '397', 'Dépréciations des stocks de marchandises', 'asset', 'inventory', '39', 2, TRUE, 'PCG');

  v_count := v_count + 23;

  -- =========================================================================
  -- CLASSE 4 - COMPTES DE TIERS
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  -- Fournisseurs
  (p_org_id, '40', 'Fournisseurs et comptes rattachés', 'liability', 'payables', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '401', 'Fournisseurs', 'liability', 'payables', '40', 2, TRUE, 'PCG'),
  (p_org_id, '4011', 'Fournisseurs - Achats de biens et services', 'liability', 'payables', '401', 3, TRUE, 'PCG'),
  (p_org_id, '4017', 'Fournisseurs - Retenues de garantie', 'liability', 'payables', '401', 3, TRUE, 'PCG'),
  (p_org_id, '403', 'Fournisseurs - Effets à payer', 'liability', 'payables', '40', 2, TRUE, 'PCG'),
  (p_org_id, '404', 'Fournisseurs d''immobilisations', 'liability', 'payables', '40', 2, TRUE, 'PCG'),
  (p_org_id, '405', 'Fournisseurs d''immobilisations - Effets à payer', 'liability', 'payables', '40', 2, TRUE, 'PCG'),
  (p_org_id, '408', 'Fournisseurs - Factures non parvenues', 'liability', 'payables', '40', 2, TRUE, 'PCG'),
  (p_org_id, '409', 'Fournisseurs débiteurs', 'asset', 'payables', '40', 2, TRUE, 'PCG'),
  (p_org_id, '4091', 'Fournisseurs - Avances et acomptes versés', 'asset', 'payables', '409', 3, TRUE, 'PCG'),
  (p_org_id, '4096', 'Fournisseurs - Créances pour emballages', 'asset', 'payables', '409', 3, TRUE, 'PCG'),
  (p_org_id, '4098', 'RRR à obtenir et autres avoirs non encore reçus', 'asset', 'payables', '409', 3, TRUE, 'PCG'),

  -- Clients
  (p_org_id, '41', 'Clients et comptes rattachés', 'asset', 'receivables', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '411', 'Clients', 'asset', 'receivables', '41', 2, TRUE, 'PCG'),
  (p_org_id, '4111', 'Clients - Ventes de biens ou services', 'asset', 'receivables', '411', 3, TRUE, 'PCG'),
  (p_org_id, '4117', 'Clients - Retenues de garantie', 'asset', 'receivables', '411', 3, TRUE, 'PCG'),
  (p_org_id, '413', 'Clients - Effets à recevoir', 'asset', 'receivables', '41', 2, TRUE, 'PCG'),
  (p_org_id, '416', 'Clients douteux ou litigieux', 'asset', 'receivables', '41', 2, TRUE, 'PCG'),
  (p_org_id, '418', 'Clients - Produits non encore facturés', 'asset', 'receivables', '41', 2, TRUE, 'PCG'),
  (p_org_id, '419', 'Clients créditeurs', 'liability', 'receivables', '41', 2, TRUE, 'PCG'),
  (p_org_id, '4191', 'Clients - Avances et acomptes reçus', 'liability', 'receivables', '419', 3, TRUE, 'PCG'),
  (p_org_id, '4196', 'Clients - Dettes pour emballages', 'liability', 'receivables', '419', 3, TRUE, 'PCG'),
  (p_org_id, '4198', 'RRR à accorder et autres avoirs à établir', 'liability', 'receivables', '419', 3, TRUE, 'PCG'),

  -- Personnel
  (p_org_id, '42', 'Personnel et comptes rattachés', 'liability', 'personnel', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '421', 'Personnel - Rémunérations dues', 'liability', 'personnel', '42', 2, TRUE, 'PCG'),
  (p_org_id, '422', 'Comités d''entreprise', 'liability', 'personnel', '42', 2, TRUE, 'PCG'),
  (p_org_id, '424', 'Participation des salariés aux résultats', 'liability', 'personnel', '42', 2, TRUE, 'PCG'),
  (p_org_id, '425', 'Personnel - Avances et acomptes', 'asset', 'personnel', '42', 2, TRUE, 'PCG'),
  (p_org_id, '427', 'Personnel - Oppositions', 'liability', 'personnel', '42', 2, TRUE, 'PCG'),
  (p_org_id, '428', 'Personnel - Charges à payer et produits à recevoir', 'liability', 'personnel', '42', 2, TRUE, 'PCG'),

  -- Organismes sociaux
  (p_org_id, '43', 'Sécurité sociale et autres organismes sociaux', 'liability', 'social', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '431', 'Sécurité sociale', 'liability', 'social', '43', 2, TRUE, 'PCG'),
  (p_org_id, '437', 'Autres organismes sociaux', 'liability', 'social', '43', 2, TRUE, 'PCG'),
  (p_org_id, '438', 'Organismes sociaux - Charges à payer', 'liability', 'social', '43', 2, TRUE, 'PCG'),

  -- État et collectivités
  (p_org_id, '44', 'État et autres collectivités publiques', 'liability', 'taxes', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '441', 'État - Subventions à recevoir', 'asset', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '442', 'État - Impôts et taxes recouvrables sur des tiers', 'asset', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '443', 'Opérations particulières avec l''État', 'liability', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '444', 'État - Impôts sur les bénéfices', 'liability', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '445', 'État - Taxes sur le chiffre d''affaires', 'liability', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '4452', 'TVA due intracommunautaire', 'liability', 'taxes', '445', 3, TRUE, 'PCG'),
  (p_org_id, '4455', 'Taxes sur le chiffre d''affaires à décaisser', 'liability', 'taxes', '445', 3, TRUE, 'PCG'),
  (p_org_id, '4456', 'Taxes sur le CA déductibles', 'asset', 'taxes', '445', 3, TRUE, 'PCG'),
  (p_org_id, '44562', 'TVA sur immobilisations', 'asset', 'taxes', '4456', 4, TRUE, 'PCG'),
  (p_org_id, '44566', 'TVA sur autres biens et services', 'asset', 'taxes', '4456', 4, TRUE, 'PCG'),
  (p_org_id, '44567', 'Crédit de TVA à reporter', 'asset', 'taxes', '4456', 4, TRUE, 'PCG'),
  (p_org_id, '4457', 'Taxes sur le CA collectées', 'liability', 'taxes', '445', 3, TRUE, 'PCG'),
  (p_org_id, '44571', 'TVA collectée', 'liability', 'taxes', '4457', 4, TRUE, 'PCG'),
  (p_org_id, '4458', 'Taxes sur le CA à régulariser', 'liability', 'taxes', '445', 3, TRUE, 'PCG'),
  (p_org_id, '446', 'Obligations cautionnées', 'liability', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '447', 'Autres impôts, taxes et versements assimilés', 'liability', 'taxes', '44', 2, TRUE, 'PCG'),
  (p_org_id, '448', 'État - Charges à payer et produits à recevoir', 'liability', 'taxes', '44', 2, TRUE, 'PCG'),

  -- Groupe et associés
  (p_org_id, '45', 'Groupe et associés', 'asset', 'intercompany', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '451', 'Groupe', 'asset', 'intercompany', '45', 2, TRUE, 'PCG'),
  (p_org_id, '455', 'Associés - Comptes courants', 'liability', 'intercompany', '45', 2, TRUE, 'PCG'),
  (p_org_id, '456', 'Associés - Opérations sur le capital', 'asset', 'intercompany', '45', 2, TRUE, 'PCG'),
  (p_org_id, '457', 'Associés - Dividendes à payer', 'liability', 'intercompany', '45', 2, TRUE, 'PCG'),
  (p_org_id, '458', 'Associés - Opérations faites en commun', 'asset', 'intercompany', '45', 2, TRUE, 'PCG'),

  -- Débiteurs et créditeurs divers
  (p_org_id, '46', 'Débiteurs divers et créditeurs divers', 'asset', 'other', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '462', 'Créances sur cessions d''immobilisations', 'asset', 'other', '46', 2, TRUE, 'PCG'),
  (p_org_id, '465', 'Créances sur cessions de VMP', 'asset', 'other', '46', 2, TRUE, 'PCG'),
  (p_org_id, '467', 'Autres comptes débiteurs ou créditeurs', 'asset', 'other', '46', 2, TRUE, 'PCG'),

  -- Comptes transitoires
  (p_org_id, '47', 'Comptes transitoires ou d''attente', 'asset', 'suspense', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '471', 'Comptes d''attente', 'asset', 'suspense', '47', 2, TRUE, 'PCG'),
  (p_org_id, '476', 'Différences de conversion - Actif', 'asset', 'suspense', '47', 2, TRUE, 'PCG'),
  (p_org_id, '477', 'Différences de conversion - Passif', 'liability', 'suspense', '47', 2, TRUE, 'PCG'),
  (p_org_id, '478', 'Autres comptes transitoires', 'asset', 'suspense', '47', 2, TRUE, 'PCG'),

  -- Charges et produits à répartir
  (p_org_id, '48', 'Comptes de régularisation', 'asset', 'accruals', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '481', 'Charges à répartir sur plusieurs exercices', 'asset', 'accruals', '48', 2, TRUE, 'PCG'),
  (p_org_id, '486', 'Charges constatées d''avance', 'asset', 'accruals', '48', 2, TRUE, 'PCG'),
  (p_org_id, '487', 'Produits constatés d''avance', 'liability', 'accruals', '48', 2, TRUE, 'PCG'),

  -- Dépréciations comptes tiers
  (p_org_id, '49', 'Dépréciations des comptes de tiers', 'asset', 'depreciation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '491', 'Dépréciations des comptes clients', 'asset', 'depreciation', '49', 2, TRUE, 'PCG'),
  (p_org_id, '495', 'Dépréciations des comptes du groupe', 'asset', 'depreciation', '49', 2, TRUE, 'PCG'),
  (p_org_id, '496', 'Dépréciations des comptes de débiteurs divers', 'asset', 'depreciation', '49', 2, TRUE, 'PCG');

  v_count := v_count + 75;

  -- =========================================================================
  -- CLASSE 5 - COMPTES FINANCIERS
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  (p_org_id, '50', 'Valeurs mobilières de placement', 'asset', 'investments', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '501', 'Parts dans des entreprises liées', 'asset', 'investments', '50', 2, TRUE, 'PCG'),
  (p_org_id, '503', 'Actions', 'asset', 'investments', '50', 2, TRUE, 'PCG'),
  (p_org_id, '506', 'Obligations', 'asset', 'investments', '50', 2, TRUE, 'PCG'),
  (p_org_id, '508', 'Autres valeurs mobilières de placement', 'asset', 'investments', '50', 2, TRUE, 'PCG'),

  (p_org_id, '51', 'Banques, établissements financiers et assimilés', 'asset', 'bank', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '511', 'Valeurs à l''encaissement', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '512', 'Banques', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '5121', 'Banque compte courant', 'asset', 'bank', '512', 3, TRUE, 'PCG'),
  (p_org_id, '5122', 'Banque compte épargne', 'asset', 'bank', '512', 3, TRUE, 'PCG'),
  (p_org_id, '514', 'Chèques postaux', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '515', 'Caisses du Trésor et établissements publics', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '516', 'Sociétés de bourse', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '517', 'Autres organismes financiers', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '518', 'Intérêts courus', 'asset', 'bank', '51', 2, TRUE, 'PCG'),
  (p_org_id, '519', 'Concours bancaires courants', 'liability', 'bank', '51', 2, TRUE, 'PCG'),

  (p_org_id, '53', 'Caisse', 'asset', 'cash', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '531', 'Caisse siège social', 'asset', 'cash', '53', 2, TRUE, 'PCG'),
  (p_org_id, '532', 'Caisse succursale', 'asset', 'cash', '53', 2, TRUE, 'PCG'),

  (p_org_id, '54', 'Régies d''avances et accréditifs', 'asset', 'cash', NULL, 1, TRUE, 'PCG'),

  (p_org_id, '58', 'Virements internes', 'asset', 'cash', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '580', 'Virements internes', 'asset', 'cash', '58', 2, TRUE, 'PCG'),

  (p_org_id, '59', 'Dépréciations des comptes financiers', 'asset', 'depreciation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '590', 'Dépréciations des valeurs mobilières', 'asset', 'depreciation', '59', 2, TRUE, 'PCG');

  v_count := v_count + 24;

  -- =========================================================================
  -- CLASSE 6 - COMPTES DE CHARGES
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  -- Achats
  (p_org_id, '60', 'Achats (sauf 603)', 'expense', 'purchases', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '601', 'Achats stockés - Matières premières', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '602', 'Achats stockés - Autres approvisionnements', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '604', 'Achats d''études et prestations de services', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '605', 'Achats de matériel, équipements et travaux', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '606', 'Achats non stockés de matières et fournitures', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '6061', 'Fournitures non stockables (eau, énergie)', 'expense', 'purchases', '606', 3, TRUE, 'PCG'),
  (p_org_id, '6063', 'Fournitures d''entretien et petit équipement', 'expense', 'purchases', '606', 3, TRUE, 'PCG'),
  (p_org_id, '6064', 'Fournitures administratives', 'expense', 'purchases', '606', 3, TRUE, 'PCG'),
  (p_org_id, '607', 'Achats de marchandises', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '608', 'Frais accessoires d''achats', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),
  (p_org_id, '609', 'RRR obtenus sur achats', 'expense', 'purchases', '60', 2, TRUE, 'PCG'),

  -- Variation de stocks
  (p_org_id, '603', 'Variation des stocks', 'expense', 'inventory', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '6031', 'Variation des stocks de matières premières', 'expense', 'inventory', '603', 2, TRUE, 'PCG'),
  (p_org_id, '6032', 'Variation des stocks des autres approvisionnements', 'expense', 'inventory', '603', 2, TRUE, 'PCG'),
  (p_org_id, '6037', 'Variation des stocks de marchandises', 'expense', 'inventory', '603', 2, TRUE, 'PCG'),

  -- Services extérieurs
  (p_org_id, '61', 'Services extérieurs', 'expense', 'services', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '611', 'Sous-traitance générale', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '612', 'Redevances de crédit-bail', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '613', 'Locations', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '6132', 'Locations immobilières', 'expense', 'services', '613', 3, TRUE, 'PCG'),
  (p_org_id, '6135', 'Locations mobilières', 'expense', 'services', '613', 3, TRUE, 'PCG'),
  (p_org_id, '614', 'Charges locatives et de copropriété', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '615', 'Entretien et réparations', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '6152', 'Entretien et réparations sur biens immobiliers', 'expense', 'services', '615', 3, TRUE, 'PCG'),
  (p_org_id, '6155', 'Entretien et réparations sur biens mobiliers', 'expense', 'services', '615', 3, TRUE, 'PCG'),
  (p_org_id, '616', 'Primes d''assurances', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '617', 'Études et recherches', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '618', 'Divers', 'expense', 'services', '61', 2, TRUE, 'PCG'),
  (p_org_id, '619', 'RRR obtenus sur services extérieurs', 'expense', 'services', '61', 2, TRUE, 'PCG'),

  -- Autres services extérieurs
  (p_org_id, '62', 'Autres services extérieurs', 'expense', 'services', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '621', 'Personnel extérieur à l''entreprise', 'expense', 'services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '622', 'Rémunérations d''intermédiaires et honoraires', 'expense', 'services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '6221', 'Commissions et courtages', 'expense', 'services', '622', 3, TRUE, 'PCG'),
  (p_org_id, '6226', 'Honoraires', 'expense', 'services', '622', 3, TRUE, 'PCG'),
  (p_org_id, '6227', 'Frais d''actes et de contentieux', 'expense', 'services', '622', 3, TRUE, 'PCG'),
  (p_org_id, '623', 'Publicité, publications, relations publiques', 'expense', 'marketing', '62', 2, TRUE, 'PCG'),
  (p_org_id, '6231', 'Annonces et insertions', 'expense', 'marketing', '623', 3, TRUE, 'PCG'),
  (p_org_id, '6233', 'Foires et expositions', 'expense', 'marketing', '623', 3, TRUE, 'PCG'),
  (p_org_id, '6234', 'Cadeaux à la clientèle', 'expense', 'marketing', '623', 3, TRUE, 'PCG'),
  (p_org_id, '6236', 'Catalogues et imprimés', 'expense', 'marketing', '623', 3, TRUE, 'PCG'),
  (p_org_id, '6237', 'Publications', 'expense', 'marketing', '623', 3, TRUE, 'PCG'),
  (p_org_id, '6238', 'Sponsoring', 'expense', 'marketing', '623', 3, TRUE, 'PCG'),
  (p_org_id, '624', 'Transports de biens et transports collectifs du personnel', 'expense', 'transport', '62', 2, TRUE, 'PCG'),
  (p_org_id, '625', 'Déplacements, missions et réceptions', 'expense', 'travel', '62', 2, TRUE, 'PCG'),
  (p_org_id, '6251', 'Voyages et déplacements', 'expense', 'travel', '625', 3, TRUE, 'PCG'),
  (p_org_id, '6255', 'Frais de déménagement', 'expense', 'travel', '625', 3, TRUE, 'PCG'),
  (p_org_id, '6256', 'Missions', 'expense', 'travel', '625', 3, TRUE, 'PCG'),
  (p_org_id, '6257', 'Réceptions', 'expense', 'travel', '625', 3, TRUE, 'PCG'),
  (p_org_id, '626', 'Frais postaux et de télécommunications', 'expense', 'communication', '62', 2, TRUE, 'PCG'),
  (p_org_id, '627', 'Services bancaires et assimilés', 'expense', 'bank_fees', '62', 2, TRUE, 'PCG'),
  (p_org_id, '628', 'Divers', 'expense', 'other', '62', 2, TRUE, 'PCG'),
  (p_org_id, '6281', 'Cotisations (chambres syndicales, etc.)', 'expense', 'other', '628', 3, TRUE, 'PCG'),
  (p_org_id, '629', 'RRR obtenus sur autres services extérieurs', 'expense', 'services', '62', 2, TRUE, 'PCG'),

  -- Impôts et taxes
  (p_org_id, '63', 'Impôts, taxes et versements assimilés', 'expense', 'taxes', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '631', 'Impôts, taxes et versements sur rémunérations', 'expense', 'taxes', '63', 2, TRUE, 'PCG'),
  (p_org_id, '6311', 'Taxe sur les salaires', 'expense', 'taxes', '631', 3, TRUE, 'PCG'),
  (p_org_id, '6312', 'Taxe d''apprentissage', 'expense', 'taxes', '631', 3, TRUE, 'PCG'),
  (p_org_id, '6313', 'Participation formation continue', 'expense', 'taxes', '631', 3, TRUE, 'PCG'),
  (p_org_id, '6333', 'Participation employeurs effort construction', 'expense', 'taxes', '631', 3, TRUE, 'PCG'),
  (p_org_id, '635', 'Autres impôts, taxes et versements assimilés', 'expense', 'taxes', '63', 2, TRUE, 'PCG'),
  (p_org_id, '6351', 'Impôts directs (sauf IS)', 'expense', 'taxes', '635', 3, TRUE, 'PCG'),
  (p_org_id, '6352', 'Taxes sur le CA non récupérables', 'expense', 'taxes', '635', 3, TRUE, 'PCG'),
  (p_org_id, '6354', 'Droits d''enregistrement et de timbre', 'expense', 'taxes', '635', 3, TRUE, 'PCG'),
  (p_org_id, '6358', 'Autres droits', 'expense', 'taxes', '635', 3, TRUE, 'PCG'),

  -- Charges de personnel
  (p_org_id, '64', 'Charges de personnel', 'expense', 'salaries', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '641', 'Rémunérations du personnel', 'expense', 'salaries', '64', 2, TRUE, 'PCG'),
  (p_org_id, '6411', 'Salaires, appointements', 'expense', 'salaries', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6412', 'Congés payés', 'expense', 'salaries', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6413', 'Primes et gratifications', 'expense', 'salaries', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6414', 'Indemnités et avantages divers', 'expense', 'salaries', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6415', 'Supplément familial', 'expense', 'salaries', '641', 3, TRUE, 'PCG'),
  (p_org_id, '644', 'Rémunération du travail de l''exploitant', 'expense', 'salaries', '64', 2, TRUE, 'PCG'),
  (p_org_id, '645', 'Charges de sécurité sociale et de prévoyance', 'expense', 'social_charges', '64', 2, TRUE, 'PCG'),
  (p_org_id, '6451', 'Cotisations à l''URSSAF', 'expense', 'social_charges', '645', 3, TRUE, 'PCG'),
  (p_org_id, '6452', 'Cotisations aux mutuelles', 'expense', 'social_charges', '645', 3, TRUE, 'PCG'),
  (p_org_id, '6453', 'Cotisations aux caisses de retraite', 'expense', 'social_charges', '645', 3, TRUE, 'PCG'),
  (p_org_id, '6454', 'Cotisations aux ASSEDIC', 'expense', 'social_charges', '645', 3, TRUE, 'PCG'),
  (p_org_id, '647', 'Autres charges sociales', 'expense', 'social_charges', '64', 2, TRUE, 'PCG'),
  (p_org_id, '648', 'Autres charges de personnel', 'expense', 'salaries', '64', 2, TRUE, 'PCG'),

  -- Autres charges de gestion courante
  (p_org_id, '65', 'Autres charges de gestion courante', 'expense', 'other', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '651', 'Redevances pour concessions, brevets, licences', 'expense', 'other', '65', 2, TRUE, 'PCG'),
  (p_org_id, '653', 'Jetons de présence', 'expense', 'other', '65', 2, TRUE, 'PCG'),
  (p_org_id, '654', 'Pertes sur créances irrécouvrables', 'expense', 'other', '65', 2, TRUE, 'PCG'),
  (p_org_id, '655', 'Quote-part de résultat sur opérations faites en commun', 'expense', 'other', '65', 2, TRUE, 'PCG'),
  (p_org_id, '658', 'Charges diverses de gestion courante', 'expense', 'other', '65', 2, TRUE, 'PCG'),

  -- Charges financières
  (p_org_id, '66', 'Charges financières', 'expense', 'financial', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '661', 'Charges d''intérêts', 'expense', 'financial', '66', 2, TRUE, 'PCG'),
  (p_org_id, '6611', 'Intérêts des emprunts et dettes', 'expense', 'financial', '661', 3, TRUE, 'PCG'),
  (p_org_id, '6615', 'Intérêts des comptes courants', 'expense', 'financial', '661', 3, TRUE, 'PCG'),
  (p_org_id, '6616', 'Intérêts bancaires', 'expense', 'financial', '661', 3, TRUE, 'PCG'),
  (p_org_id, '6618', 'Intérêts des autres dettes', 'expense', 'financial', '661', 3, TRUE, 'PCG'),
  (p_org_id, '664', 'Pertes sur créances liées à des participations', 'expense', 'financial', '66', 2, TRUE, 'PCG'),
  (p_org_id, '665', 'Escomptes accordés', 'expense', 'financial', '66', 2, TRUE, 'PCG'),
  (p_org_id, '666', 'Pertes de change', 'expense', 'financial', '66', 2, TRUE, 'PCG'),
  (p_org_id, '667', 'Charges nettes sur cessions de VMP', 'expense', 'financial', '66', 2, TRUE, 'PCG'),
  (p_org_id, '668', 'Autres charges financières', 'expense', 'financial', '66', 2, TRUE, 'PCG'),

  -- Charges exceptionnelles
  (p_org_id, '67', 'Charges exceptionnelles', 'expense', 'exceptional', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '671', 'Charges exceptionnelles sur opérations de gestion', 'expense', 'exceptional', '67', 2, TRUE, 'PCG'),
  (p_org_id, '6711', 'Pénalités sur marchés', 'expense', 'exceptional', '671', 3, TRUE, 'PCG'),
  (p_org_id, '6712', 'Pénalités, amendes fiscales et pénales', 'expense', 'exceptional', '671', 3, TRUE, 'PCG'),
  (p_org_id, '6713', 'Dons, libéralités', 'expense', 'exceptional', '671', 3, TRUE, 'PCG'),
  (p_org_id, '6714', 'Créances devenues irrécouvrables', 'expense', 'exceptional', '671', 3, TRUE, 'PCG'),
  (p_org_id, '6717', 'Rappels d''impôts (sauf IS)', 'expense', 'exceptional', '671', 3, TRUE, 'PCG'),
  (p_org_id, '6718', 'Autres charges exceptionnelles', 'expense', 'exceptional', '671', 3, TRUE, 'PCG'),
  (p_org_id, '675', 'Valeurs comptables des éléments d''actif cédés', 'expense', 'exceptional', '67', 2, TRUE, 'PCG'),
  (p_org_id, '678', 'Autres charges exceptionnelles', 'expense', 'exceptional', '67', 2, TRUE, 'PCG'),

  -- Dotations aux amortissements et provisions
  (p_org_id, '68', 'Dotations aux amortissements, dépréciations et provisions', 'expense', 'depreciation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '681', 'DAP - Charges d''exploitation', 'expense', 'depreciation', '68', 2, TRUE, 'PCG'),
  (p_org_id, '6811', 'DAP des immobilisations incorporelles et corporelles', 'expense', 'depreciation', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6812', 'DAP des charges d''exploitation à répartir', 'expense', 'depreciation', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6815', 'Dotations aux provisions d''exploitation', 'expense', 'depreciation', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6816', 'Dotations aux dépréciations des immobilisations', 'expense', 'depreciation', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6817', 'Dotations aux dépréciations des actifs circulants', 'expense', 'depreciation', '681', 3, TRUE, 'PCG'),
  (p_org_id, '686', 'DAP - Charges financières', 'expense', 'depreciation', '68', 2, TRUE, 'PCG'),
  (p_org_id, '687', 'DAP - Charges exceptionnelles', 'expense', 'depreciation', '68', 2, TRUE, 'PCG'),

  -- Participation et impôts
  (p_org_id, '69', 'Participation des salariés - Impôts sur les bénéfices', 'expense', 'taxes', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '691', 'Participation des salariés aux résultats', 'expense', 'salaries', '69', 2, TRUE, 'PCG'),
  (p_org_id, '695', 'Impôts sur les bénéfices', 'expense', 'taxes', '69', 2, TRUE, 'PCG'),
  (p_org_id, '6951', 'Impôts dus en France', 'expense', 'taxes', '695', 3, TRUE, 'PCG'),
  (p_org_id, '6952', 'Contribution sociale sur les bénéfices', 'expense', 'taxes', '695', 3, TRUE, 'PCG'),
  (p_org_id, '699', 'Produits - Report en arrière des déficits', 'expense', 'taxes', '69', 2, TRUE, 'PCG');

  v_count := v_count + 120;

  -- =========================================================================
  -- CLASSE 7 - COMPTES DE PRODUITS
  -- =========================================================================
  INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, parent_code, level, is_system, accounting_standard) VALUES
  -- Ventes de produits
  (p_org_id, '70', 'Ventes de produits fabriqués, prestations de services, marchandises', 'revenue', 'sales', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '701', 'Ventes de produits finis', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),
  (p_org_id, '702', 'Ventes de produits intermédiaires', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),
  (p_org_id, '703', 'Ventes de produits résiduels', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),
  (p_org_id, '704', 'Travaux', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),
  (p_org_id, '705', 'Études', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),
  (p_org_id, '706', 'Prestations de services', 'revenue', 'services', '70', 2, TRUE, 'PCG'),
  (p_org_id, '707', 'Ventes de marchandises', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),
  (p_org_id, '708', 'Produits des activités annexes', 'revenue', 'other', '70', 2, TRUE, 'PCG'),
  (p_org_id, '7081', 'Produits des services exploités dans l''intérêt du personnel', 'revenue', 'other', '708', 3, TRUE, 'PCG'),
  (p_org_id, '7082', 'Commissions et courtages', 'revenue', 'other', '708', 3, TRUE, 'PCG'),
  (p_org_id, '7083', 'Locations diverses', 'revenue', 'other', '708', 3, TRUE, 'PCG'),
  (p_org_id, '7084', 'Mise à disposition de personnel facturée', 'revenue', 'other', '708', 3, TRUE, 'PCG'),
  (p_org_id, '7085', 'Ports et frais accessoires facturés', 'revenue', 'other', '708', 3, TRUE, 'PCG'),
  (p_org_id, '7088', 'Autres produits d''activités annexes', 'revenue', 'other', '708', 3, TRUE, 'PCG'),
  (p_org_id, '709', 'RRR accordés par l''entreprise', 'revenue', 'sales', '70', 2, TRUE, 'PCG'),

  -- Production stockée
  (p_org_id, '71', 'Production stockée (ou déstockage)', 'revenue', 'production', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '713', 'Variation des stocks des en-cours et des produits', 'revenue', 'production', '71', 2, TRUE, 'PCG'),

  -- Production immobilisée
  (p_org_id, '72', 'Production immobilisée', 'revenue', 'production', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '721', 'Immobilisations incorporelles', 'revenue', 'production', '72', 2, TRUE, 'PCG'),
  (p_org_id, '722', 'Immobilisations corporelles', 'revenue', 'production', '72', 2, TRUE, 'PCG'),

  -- Subventions d'exploitation
  (p_org_id, '74', 'Subventions d''exploitation', 'revenue', 'grants', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '741', 'Subventions d''exploitation reçues', 'revenue', 'grants', '74', 2, TRUE, 'PCG'),

  -- Autres produits de gestion courante
  (p_org_id, '75', 'Autres produits de gestion courante', 'revenue', 'other', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '751', 'Redevances pour concessions, brevets, licences', 'revenue', 'other', '75', 2, TRUE, 'PCG'),
  (p_org_id, '752', 'Revenus des immeubles non affectés aux activités pro', 'revenue', 'other', '75', 2, TRUE, 'PCG'),
  (p_org_id, '753', 'Jetons de présence et rémunérations d''administrateurs', 'revenue', 'other', '75', 2, TRUE, 'PCG'),
  (p_org_id, '754', 'Ristournes perçues des coopératives', 'revenue', 'other', '75', 2, TRUE, 'PCG'),
  (p_org_id, '755', 'Quote-part de résultat sur opérations faites en commun', 'revenue', 'other', '75', 2, TRUE, 'PCG'),
  (p_org_id, '758', 'Produits divers de gestion courante', 'revenue', 'other', '75', 2, TRUE, 'PCG'),

  -- Produits financiers
  (p_org_id, '76', 'Produits financiers', 'revenue', 'financial', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '761', 'Produits de participations', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '762', 'Produits des autres immobilisations financières', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '763', 'Revenus des autres créances', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '764', 'Revenus des valeurs mobilières de placement', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '765', 'Escomptes obtenus', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '766', 'Gains de change', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '767', 'Produits nets sur cessions de VMP', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),
  (p_org_id, '768', 'Autres produits financiers', 'revenue', 'financial', '76', 2, TRUE, 'PCG'),

  -- Produits exceptionnels
  (p_org_id, '77', 'Produits exceptionnels', 'revenue', 'exceptional', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '771', 'Produits exceptionnels sur opérations de gestion', 'revenue', 'exceptional', '77', 2, TRUE, 'PCG'),
  (p_org_id, '7711', 'Dédits et pénalités perçus', 'revenue', 'exceptional', '771', 3, TRUE, 'PCG'),
  (p_org_id, '7713', 'Libéralités reçues', 'revenue', 'exceptional', '771', 3, TRUE, 'PCG'),
  (p_org_id, '7714', 'Rentrées sur créances amorties', 'revenue', 'exceptional', '771', 3, TRUE, 'PCG'),
  (p_org_id, '7715', 'Subventions d''équilibre', 'revenue', 'exceptional', '771', 3, TRUE, 'PCG'),
  (p_org_id, '7717', 'Dégrèvements d''impôts (sauf IS)', 'revenue', 'exceptional', '771', 3, TRUE, 'PCG'),
  (p_org_id, '7718', 'Autres produits exceptionnels', 'revenue', 'exceptional', '771', 3, TRUE, 'PCG'),
  (p_org_id, '775', 'Produits des cessions d''éléments d''actif', 'revenue', 'exceptional', '77', 2, TRUE, 'PCG'),
  (p_org_id, '7751', 'Immobilisations incorporelles', 'revenue', 'exceptional', '775', 3, TRUE, 'PCG'),
  (p_org_id, '7752', 'Immobilisations corporelles', 'revenue', 'exceptional', '775', 3, TRUE, 'PCG'),
  (p_org_id, '7756', 'Immobilisations financières', 'revenue', 'exceptional', '775', 3, TRUE, 'PCG'),
  (p_org_id, '7758', 'Autres éléments d''actif', 'revenue', 'exceptional', '775', 3, TRUE, 'PCG'),
  (p_org_id, '777', 'Quote-part des subventions virée au résultat', 'revenue', 'exceptional', '77', 2, TRUE, 'PCG'),
  (p_org_id, '778', 'Autres produits exceptionnels', 'revenue', 'exceptional', '77', 2, TRUE, 'PCG'),

  -- Reprises sur amortissements et provisions
  (p_org_id, '78', 'Reprises sur amortissements, dépréciations et provisions', 'revenue', 'depreciation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '781', 'Reprises sur amortissements et provisions - Exploitation', 'revenue', 'depreciation', '78', 2, TRUE, 'PCG'),
  (p_org_id, '7811', 'Reprises sur amortissements des immobilisations', 'revenue', 'depreciation', '781', 3, TRUE, 'PCG'),
  (p_org_id, '7815', 'Reprises sur provisions d''exploitation', 'revenue', 'depreciation', '781', 3, TRUE, 'PCG'),
  (p_org_id, '7816', 'Reprises sur dépréciations des immobilisations', 'revenue', 'depreciation', '781', 3, TRUE, 'PCG'),
  (p_org_id, '7817', 'Reprises sur dépréciations des actifs circulants', 'revenue', 'depreciation', '781', 3, TRUE, 'PCG'),
  (p_org_id, '786', 'Reprises sur dépréciations et provisions - Financier', 'revenue', 'depreciation', '78', 2, TRUE, 'PCG'),
  (p_org_id, '787', 'Reprises sur dépréciations et provisions - Exceptionnel', 'revenue', 'depreciation', '78', 2, TRUE, 'PCG'),

  -- Transferts de charges
  (p_org_id, '79', 'Transferts de charges', 'revenue', 'transfers', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '791', 'Transferts de charges d''exploitation', 'revenue', 'transfers', '79', 2, TRUE, 'PCG'),
  (p_org_id, '796', 'Transferts de charges financières', 'revenue', 'transfers', '79', 2, TRUE, 'PCG'),
  (p_org_id, '797', 'Transferts de charges exceptionnelles', 'revenue', 'transfers', '79', 2, TRUE, 'PCG');

  v_count := v_count + 68;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. RLS POLICIES pour les nouvelles tables
-- =============================================================================

ALTER TABLE erp_account_lettrage ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_account_lettrage_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_closing_entries ENABLE ROW LEVEL SECURITY;

-- Policies pour erp_account_lettrage
DROP POLICY IF EXISTS erp_account_lettrage_select ON erp_account_lettrage;
CREATE POLICY erp_account_lettrage_select ON erp_account_lettrage FOR SELECT
USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS erp_account_lettrage_insert ON erp_account_lettrage;
CREATE POLICY erp_account_lettrage_insert ON erp_account_lettrage FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS erp_account_lettrage_update ON erp_account_lettrage;
CREATE POLICY erp_account_lettrage_update ON erp_account_lettrage FOR UPDATE
USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS erp_account_lettrage_delete ON erp_account_lettrage;
CREATE POLICY erp_account_lettrage_delete ON erp_account_lettrage FOR DELETE
USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- Policies pour erp_account_lettrage_lines
DROP POLICY IF EXISTS erp_account_lettrage_lines_select ON erp_account_lettrage_lines;
CREATE POLICY erp_account_lettrage_lines_select ON erp_account_lettrage_lines FOR SELECT
USING (lettrage_id IN (SELECT id FROM erp_account_lettrage WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS erp_account_lettrage_lines_insert ON erp_account_lettrage_lines;
CREATE POLICY erp_account_lettrage_lines_insert ON erp_account_lettrage_lines FOR INSERT
WITH CHECK (lettrage_id IN (SELECT id FROM erp_account_lettrage WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS erp_account_lettrage_lines_delete ON erp_account_lettrage_lines;
CREATE POLICY erp_account_lettrage_lines_delete ON erp_account_lettrage_lines FOR DELETE
USING (lettrage_id IN (SELECT id FROM erp_account_lettrage WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

-- Policies pour erp_fiscal_periods
DROP POLICY IF EXISTS erp_fiscal_periods_select ON erp_fiscal_periods;
CREATE POLICY erp_fiscal_periods_select ON erp_fiscal_periods FOR SELECT
USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS erp_fiscal_periods_insert ON erp_fiscal_periods;
CREATE POLICY erp_fiscal_periods_insert ON erp_fiscal_periods FOR INSERT
WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS erp_fiscal_periods_update ON erp_fiscal_periods;
CREATE POLICY erp_fiscal_periods_update ON erp_fiscal_periods FOR UPDATE
USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()));

-- =============================================================================
-- 9. TRIGGER pour l'immutabilité post-posting
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_posted_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('posted', 'locked') AND NEW.status != 'reversed' THEN
    RAISE EXCEPTION 'Cannot modify a posted or locked journal entry. Create a reversal entry instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_posted_entry_mod ON erp_journal_entries;
CREATE TRIGGER trg_prevent_posted_entry_mod
BEFORE UPDATE ON erp_journal_entries
FOR EACH ROW
WHEN (OLD.status IN ('posted', 'locked'))
EXECUTE FUNCTION prevent_posted_entry_modification();

-- =============================================================================
-- FIN DE LA MIGRATION
-- =============================================================================

COMMENT ON FUNCTION init_pcg_2025 IS 'Initialise le Plan Comptable Général 2025 complet pour une organisation';
COMMENT ON TABLE erp_account_lettrage IS 'Lettrages des comptes tiers (clients 411, fournisseurs 401)';
COMMENT ON TABLE erp_fiscal_periods IS 'Périodes fiscales pour la clôture comptable';

-- =============================================================================
-- 10. TRIGGER: Initialisation automatique du PCG pour les nouvelles organisations
-- =============================================================================

-- Fonction trigger pour initialiser le PCG automatiquement
CREATE OR REPLACE FUNCTION auto_init_pcg_on_org_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Initialiser le PCG 2025 pour toute nouvelle organisation
  -- (Par défaut PCG français - peut être étendu pour d'autres pays)
  PERFORM init_pcg_2025(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur la création d'organisation
DROP TRIGGER IF EXISTS trg_auto_init_pcg ON organizations;
CREATE TRIGGER trg_auto_init_pcg
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION auto_init_pcg_on_org_create();

-- =============================================================================
-- 11. Initialiser le PCG pour les organisations existantes
-- =============================================================================

DO $$
DECLARE
  org_record RECORD;
  result INTEGER;
BEGIN
  FOR org_record IN
    SELECT o.id, o.name
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_chart_of_accounts c
      WHERE c.org_id = o.id AND c.is_system = TRUE
      LIMIT 1
    )
  LOOP
    SELECT init_pcg_2025(org_record.id) INTO result;
    RAISE NOTICE 'PCG 2025 initialisé pour %: % comptes', org_record.name, result;
  END LOOP;
END $$;
