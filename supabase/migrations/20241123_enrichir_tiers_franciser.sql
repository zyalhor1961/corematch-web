-- Migration: Enrichissement fiches tiers + Francisation ERP
-- Date: 2024-11-23

-- =====================================================
-- 1. ENRICHISSEMENT TABLES FOURNISSEURS ET CLIENTS
-- =====================================================

-- Ajout colonnes fournisseurs
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS siren VARCHAR(9);
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS siret VARCHAR(14);
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS naf_code VARCHAR(10);
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS activite TEXT;
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS mode_reglement VARCHAR(50) DEFAULT 'virement';
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS delai_paiement INTEGER DEFAULT 30;
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS bic VARCHAR(11);
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS banque VARCHAR(100);
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ajout colonnes clients (erp_clients)
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS siren VARCHAR(9);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS siret VARCHAR(14);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS naf_code VARCHAR(10);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS activite TEXT;
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS mode_reglement VARCHAR(50) DEFAULT 'virement';
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS delai_paiement INTEGER DEFAULT 30;
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS bic VARCHAR(11);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS banque VARCHAR(100);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'FR';
ALTER TABLE erp_clients ADD COLUMN IF NOT EXISTS vat_number VARCHAR(20);

-- =====================================================
-- 2. TABLE DE REFERENCE MODES DE REGLEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS erp_modes_reglement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  libelle_court VARCHAR(50),
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE
);

-- Insertion des modes de règlement
INSERT INTO erp_modes_reglement (code, libelle, libelle_court, ordre) VALUES
  ('virement', 'Virement bancaire', 'Virement', 1),
  ('cheque', 'Chèque', 'Chèque', 2),
  ('cb', 'Carte bancaire', 'CB', 3),
  ('especes', 'Espèces', 'Espèces', 4),
  ('prelevement', 'Prélèvement automatique', 'Prélèvement', 5),
  ('lcr', 'Lettre de change relevé', 'LCR', 6),
  ('bor', 'Billet à ordre relevé', 'BOR', 7),
  ('traite', 'Traite', 'Traite', 8)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. FRANCISATION DES TYPES DE COMPTE
-- =====================================================

-- Mise à jour de l'enum account_type si existe
DO $$
BEGIN
  -- Mise à jour des valeurs existantes vers français
  UPDATE erp_chart_of_accounts SET account_type = 'actif' WHERE account_type = 'asset';
  UPDATE erp_chart_of_accounts SET account_type = 'passif' WHERE account_type = 'liability';
  UPDATE erp_chart_of_accounts SET account_type = 'capitaux' WHERE account_type = 'equity';
  UPDATE erp_chart_of_accounts SET account_type = 'produit' WHERE account_type = 'income';
  UPDATE erp_chart_of_accounts SET account_type = 'charge' WHERE account_type = 'expense';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Table erp_chart_of_accounts may not exist yet';
END $$;

-- Mise à jour du type de journal en français
DO $$
BEGIN
  UPDATE erp_journals SET journal_type = 'ventes' WHERE journal_type = 'sale';
  UPDATE erp_journals SET journal_type = 'achats' WHERE journal_type = 'purchase';
  UPDATE erp_journals SET journal_type = 'banque' WHERE journal_type = 'bank';
  UPDATE erp_journals SET journal_type = 'caisse' WHERE journal_type = 'cash';
  UPDATE erp_journals SET journal_type = 'od' WHERE journal_type = 'misc';
  UPDATE erp_journals SET journal_type = 'ouverture' WHERE journal_type = 'opening';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Table erp_journals may not exist yet';
END $$;

-- =====================================================
-- 4. MISE A JOUR FONCTION PCG AVEC TYPES FRANCAIS
-- =====================================================

CREATE OR REPLACE FUNCTION init_pcg_2025(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Suppression des comptes existants pour cette org (pour réinitialisation)
  DELETE FROM erp_chart_of_accounts WHERE org_id = p_org_id AND source = 'PCG';

  -- =====================================================
  -- CLASSE 1 - COMPTES DE CAPITAUX
  -- =====================================================
  INSERT INTO erp_chart_of_accounts (org_id, account_code, account_name, account_type, category, parent_code, level, is_active, source) VALUES
  -- Capital
  (p_org_id, '10', 'Capital et réserves', 'capitaux', 'capital', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '101', 'Capital', 'capitaux', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '1011', 'Capital souscrit non appelé', 'capitaux', 'capital', '101', 3, TRUE, 'PCG'),
  (p_org_id, '1012', 'Capital souscrit appelé non versé', 'capitaux', 'capital', '101', 3, TRUE, 'PCG'),
  (p_org_id, '1013', 'Capital souscrit appelé versé', 'capitaux', 'capital', '101', 3, TRUE, 'PCG'),
  (p_org_id, '104', 'Primes liées au capital', 'capitaux', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '1041', 'Primes d''émission', 'capitaux', 'capital', '104', 3, TRUE, 'PCG'),
  (p_org_id, '1042', 'Primes de fusion', 'capitaux', 'capital', '104', 3, TRUE, 'PCG'),
  (p_org_id, '1043', 'Primes d''apport', 'capitaux', 'capital', '104', 3, TRUE, 'PCG'),
  (p_org_id, '1044', 'Primes de conversion', 'capitaux', 'capital', '104', 3, TRUE, 'PCG'),
  (p_org_id, '105', 'Écarts de réévaluation', 'capitaux', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '106', 'Réserves', 'capitaux', 'reserves', '10', 2, TRUE, 'PCG'),
  (p_org_id, '1061', 'Réserve légale', 'capitaux', 'reserves', '106', 3, TRUE, 'PCG'),
  (p_org_id, '1063', 'Réserves statutaires', 'capitaux', 'reserves', '106', 3, TRUE, 'PCG'),
  (p_org_id, '1064', 'Réserves réglementées', 'capitaux', 'reserves', '106', 3, TRUE, 'PCG'),
  (p_org_id, '1068', 'Autres réserves', 'capitaux', 'reserves', '106', 3, TRUE, 'PCG'),
  (p_org_id, '108', 'Compte de l''exploitant', 'capitaux', 'capital', '10', 2, TRUE, 'PCG'),
  (p_org_id, '109', 'Actionnaires : capital souscrit non appelé', 'actif', 'capital', '10', 2, TRUE, 'PCG'),

  -- Report à nouveau
  (p_org_id, '11', 'Report à nouveau', 'capitaux', 'report', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '110', 'Report à nouveau (solde créditeur)', 'capitaux', 'report', '11', 2, TRUE, 'PCG'),
  (p_org_id, '119', 'Report à nouveau (solde débiteur)', 'capitaux', 'report', '11', 2, TRUE, 'PCG'),

  -- Résultat
  (p_org_id, '12', 'Résultat de l''exercice', 'capitaux', 'resultat', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '120', 'Résultat de l''exercice (bénéfice)', 'capitaux', 'resultat', '12', 2, TRUE, 'PCG'),
  (p_org_id, '129', 'Résultat de l''exercice (perte)', 'capitaux', 'resultat', '12', 2, TRUE, 'PCG'),

  -- Subventions
  (p_org_id, '13', 'Subventions d''investissement', 'capitaux', 'subventions', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '131', 'Subventions d''équipement', 'capitaux', 'subventions', '13', 2, TRUE, 'PCG'),
  (p_org_id, '138', 'Autres subventions d''investissement', 'capitaux', 'subventions', '13', 2, TRUE, 'PCG'),
  (p_org_id, '139', 'Subventions inscrites au compte de résultat', 'capitaux', 'subventions', '13', 2, TRUE, 'PCG'),

  -- Provisions réglementées
  (p_org_id, '14', 'Provisions réglementées', 'capitaux', 'provisions_reglementees', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '142', 'Provisions pour investissement', 'capitaux', 'provisions_reglementees', '14', 2, TRUE, 'PCG'),
  (p_org_id, '144', 'Provisions pour hausse des prix', 'capitaux', 'provisions_reglementees', '14', 2, TRUE, 'PCG'),
  (p_org_id, '145', 'Amortissements dérogatoires', 'capitaux', 'provisions_reglementees', '14', 2, TRUE, 'PCG'),
  (p_org_id, '146', 'Provision spéciale de réévaluation', 'capitaux', 'provisions_reglementees', '14', 2, TRUE, 'PCG'),
  (p_org_id, '148', 'Autres provisions réglementées', 'capitaux', 'provisions_reglementees', '14', 2, TRUE, 'PCG'),

  -- Provisions pour risques et charges
  (p_org_id, '15', 'Provisions', 'passif', 'provisions', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '151', 'Provisions pour risques', 'passif', 'provisions', '15', 2, TRUE, 'PCG'),
  (p_org_id, '153', 'Provisions pour pensions', 'passif', 'provisions', '15', 2, TRUE, 'PCG'),
  (p_org_id, '155', 'Provisions pour impôts', 'passif', 'provisions', '15', 2, TRUE, 'PCG'),
  (p_org_id, '158', 'Autres provisions pour charges', 'passif', 'provisions', '15', 2, TRUE, 'PCG'),

  -- Emprunts et dettes
  (p_org_id, '16', 'Emprunts et dettes assimilées', 'passif', 'emprunts', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '161', 'Emprunts obligataires', 'passif', 'emprunts', '16', 2, TRUE, 'PCG'),
  (p_org_id, '164', 'Emprunts auprès des établissements de crédit', 'passif', 'emprunts', '16', 2, TRUE, 'PCG'),
  (p_org_id, '165', 'Dépôts et cautionnements reçus', 'passif', 'emprunts', '16', 2, TRUE, 'PCG'),
  (p_org_id, '167', 'Emprunts et dettes assortis de conditions particulières', 'passif', 'emprunts', '16', 2, TRUE, 'PCG'),
  (p_org_id, '168', 'Autres emprunts et dettes assimilées', 'passif', 'emprunts', '16', 2, TRUE, 'PCG'),

  -- Dettes rattachées à participations
  (p_org_id, '17', 'Dettes rattachées à des participations', 'passif', 'emprunts', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '171', 'Dettes rattachées à des participations (groupe)', 'passif', 'emprunts', '17', 2, TRUE, 'PCG'),
  (p_org_id, '174', 'Dettes rattachées à des participations (hors groupe)', 'passif', 'emprunts', '17', 2, TRUE, 'PCG'),

  -- =====================================================
  -- CLASSE 2 - COMPTES D'IMMOBILISATIONS
  -- =====================================================
  (p_org_id, '20', 'Immobilisations incorporelles', 'actif', 'immobilisations', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '201', 'Frais d''établissement', 'actif', 'immobilisations', '20', 2, TRUE, 'PCG'),
  (p_org_id, '203', 'Frais de recherche et de développement', 'actif', 'immobilisations', '20', 2, TRUE, 'PCG'),
  (p_org_id, '205', 'Concessions et droits similaires', 'actif', 'immobilisations', '20', 2, TRUE, 'PCG'),
  (p_org_id, '206', 'Droit au bail', 'actif', 'immobilisations', '20', 2, TRUE, 'PCG'),
  (p_org_id, '207', 'Fonds commercial', 'actif', 'immobilisations', '20', 2, TRUE, 'PCG'),
  (p_org_id, '208', 'Autres immobilisations incorporelles', 'actif', 'immobilisations', '20', 2, TRUE, 'PCG'),

  (p_org_id, '21', 'Immobilisations corporelles', 'actif', 'immobilisations', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '211', 'Terrains', 'actif', 'immobilisations', '21', 2, TRUE, 'PCG'),
  (p_org_id, '213', 'Constructions', 'actif', 'immobilisations', '21', 2, TRUE, 'PCG'),
  (p_org_id, '215', 'Installations techniques, matériel et outillage', 'actif', 'immobilisations', '21', 2, TRUE, 'PCG'),
  (p_org_id, '218', 'Autres immobilisations corporelles', 'actif', 'immobilisations', '21', 2, TRUE, 'PCG'),
  (p_org_id, '2182', 'Matériel de transport', 'actif', 'immobilisations', '218', 3, TRUE, 'PCG'),
  (p_org_id, '2183', 'Matériel de bureau et informatique', 'actif', 'immobilisations', '218', 3, TRUE, 'PCG'),
  (p_org_id, '2184', 'Mobilier', 'actif', 'immobilisations', '218', 3, TRUE, 'PCG'),

  (p_org_id, '26', 'Participations et créances rattachées', 'actif', 'immobilisations_financieres', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '261', 'Titres de participation', 'actif', 'immobilisations_financieres', '26', 2, TRUE, 'PCG'),
  (p_org_id, '267', 'Créances rattachées à des participations', 'actif', 'immobilisations_financieres', '26', 2, TRUE, 'PCG'),

  (p_org_id, '27', 'Autres immobilisations financières', 'actif', 'immobilisations_financieres', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '271', 'Titres immobilisés', 'actif', 'immobilisations_financieres', '27', 2, TRUE, 'PCG'),
  (p_org_id, '274', 'Prêts', 'actif', 'immobilisations_financieres', '27', 2, TRUE, 'PCG'),
  (p_org_id, '275', 'Dépôts et cautionnements versés', 'actif', 'immobilisations_financieres', '27', 2, TRUE, 'PCG'),

  (p_org_id, '28', 'Amortissements des immobilisations', 'actif', 'amortissements', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '280', 'Amortissements des immobilisations incorporelles', 'actif', 'amortissements', '28', 2, TRUE, 'PCG'),
  (p_org_id, '281', 'Amortissements des immobilisations corporelles', 'actif', 'amortissements', '28', 2, TRUE, 'PCG'),

  (p_org_id, '29', 'Dépréciations des immobilisations', 'actif', 'depreciations', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '290', 'Dépréciations des immobilisations incorporelles', 'actif', 'depreciations', '29', 2, TRUE, 'PCG'),
  (p_org_id, '291', 'Dépréciations des immobilisations corporelles', 'actif', 'depreciations', '29', 2, TRUE, 'PCG'),

  -- =====================================================
  -- CLASSE 3 - COMPTES DE STOCKS
  -- =====================================================
  (p_org_id, '31', 'Matières premières', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '32', 'Autres approvisionnements', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '33', 'En-cours de production de biens', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '34', 'En-cours de production de services', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '35', 'Stocks de produits', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '37', 'Stocks de marchandises', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '39', 'Dépréciations des stocks', 'actif', 'stocks', NULL, 1, TRUE, 'PCG'),

  -- =====================================================
  -- CLASSE 4 - COMPTES DE TIERS
  -- =====================================================
  -- Fournisseurs
  (p_org_id, '40', 'Fournisseurs et comptes rattachés', 'passif', 'fournisseurs', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '401', 'Fournisseurs', 'passif', 'fournisseurs', '40', 2, TRUE, 'PCG'),
  (p_org_id, '4011', 'Fournisseurs - Achats de biens et services', 'passif', 'fournisseurs', '401', 3, TRUE, 'PCG'),
  (p_org_id, '403', 'Fournisseurs - Effets à payer', 'passif', 'fournisseurs', '40', 2, TRUE, 'PCG'),
  (p_org_id, '404', 'Fournisseurs d''immobilisations', 'passif', 'fournisseurs', '40', 2, TRUE, 'PCG'),
  (p_org_id, '408', 'Fournisseurs - Factures non parvenues', 'passif', 'fournisseurs', '40', 2, TRUE, 'PCG'),
  (p_org_id, '409', 'Fournisseurs débiteurs', 'actif', 'fournisseurs', '40', 2, TRUE, 'PCG'),

  -- Clients
  (p_org_id, '41', 'Clients et comptes rattachés', 'actif', 'clients', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '411', 'Clients', 'actif', 'clients', '41', 2, TRUE, 'PCG'),
  (p_org_id, '4111', 'Clients - Ventes de biens ou services', 'actif', 'clients', '411', 3, TRUE, 'PCG'),
  (p_org_id, '413', 'Clients - Effets à recevoir', 'actif', 'clients', '41', 2, TRUE, 'PCG'),
  (p_org_id, '416', 'Clients douteux ou litigieux', 'actif', 'clients', '41', 2, TRUE, 'PCG'),
  (p_org_id, '418', 'Clients - Produits non encore facturés', 'actif', 'clients', '41', 2, TRUE, 'PCG'),
  (p_org_id, '419', 'Clients créditeurs', 'passif', 'clients', '41', 2, TRUE, 'PCG'),

  -- Personnel
  (p_org_id, '42', 'Personnel et comptes rattachés', 'passif', 'personnel', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '421', 'Personnel - Rémunérations dues', 'passif', 'personnel', '42', 2, TRUE, 'PCG'),
  (p_org_id, '425', 'Personnel - Avances et acomptes', 'actif', 'personnel', '42', 2, TRUE, 'PCG'),

  -- Organismes sociaux
  (p_org_id, '43', 'Sécurité sociale et autres organismes sociaux', 'passif', 'social', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '431', 'Sécurité sociale', 'passif', 'social', '43', 2, TRUE, 'PCG'),
  (p_org_id, '437', 'Autres organismes sociaux', 'passif', 'social', '43', 2, TRUE, 'PCG'),

  -- État et collectivités
  (p_org_id, '44', 'État et autres collectivités publiques', 'passif', 'etat', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '441', 'État - Subventions à recevoir', 'actif', 'etat', '44', 2, TRUE, 'PCG'),
  (p_org_id, '442', 'État - Impôts et taxes recouvrables sur tiers', 'actif', 'etat', '44', 2, TRUE, 'PCG'),
  (p_org_id, '443', 'Opérations particulières avec l''État', 'passif', 'etat', '44', 2, TRUE, 'PCG'),
  (p_org_id, '444', 'État - Impôts sur les bénéfices', 'passif', 'etat', '44', 2, TRUE, 'PCG'),
  (p_org_id, '445', 'État - Taxes sur le chiffre d''affaires', 'passif', 'etat', '44', 2, TRUE, 'PCG'),
  (p_org_id, '4455', 'TVA à décaisser', 'passif', 'etat', '445', 3, TRUE, 'PCG'),
  (p_org_id, '4456', 'TVA déductible', 'actif', 'etat', '445', 3, TRUE, 'PCG'),
  (p_org_id, '44562', 'TVA sur immobilisations', 'actif', 'etat', '4456', 4, TRUE, 'PCG'),
  (p_org_id, '44566', 'TVA sur autres biens et services', 'actif', 'etat', '4456', 4, TRUE, 'PCG'),
  (p_org_id, '4457', 'TVA collectée', 'passif', 'etat', '445', 3, TRUE, 'PCG'),
  (p_org_id, '447', 'Autres impôts, taxes et versements assimilés', 'passif', 'etat', '44', 2, TRUE, 'PCG'),
  (p_org_id, '448', 'État - Charges à payer et produits à recevoir', 'passif', 'etat', '44', 2, TRUE, 'PCG'),

  -- Groupe et associés
  (p_org_id, '45', 'Groupe et associés', 'passif', 'groupe', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '451', 'Groupe', 'passif', 'groupe', '45', 2, TRUE, 'PCG'),
  (p_org_id, '455', 'Associés - Comptes courants', 'passif', 'groupe', '45', 2, TRUE, 'PCG'),
  (p_org_id, '456', 'Associés - Opérations sur le capital', 'passif', 'groupe', '45', 2, TRUE, 'PCG'),
  (p_org_id, '457', 'Associés - Dividendes à payer', 'passif', 'groupe', '45', 2, TRUE, 'PCG'),

  -- Débiteurs et créditeurs divers
  (p_org_id, '46', 'Débiteurs divers et créditeurs divers', 'actif', 'divers', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '467', 'Autres comptes débiteurs ou créditeurs', 'actif', 'divers', '46', 2, TRUE, 'PCG'),

  -- Comptes transitoires
  (p_org_id, '47', 'Comptes transitoires ou d''attente', 'actif', 'attente', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '471', 'Comptes d''attente', 'actif', 'attente', '47', 2, TRUE, 'PCG'),

  -- Régularisation
  (p_org_id, '48', 'Comptes de régularisation', 'actif', 'regularisation', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '481', 'Charges à répartir sur plusieurs exercices', 'actif', 'regularisation', '48', 2, TRUE, 'PCG'),
  (p_org_id, '486', 'Charges constatées d''avance', 'actif', 'regularisation', '48', 2, TRUE, 'PCG'),
  (p_org_id, '487', 'Produits constatés d''avance', 'passif', 'regularisation', '48', 2, TRUE, 'PCG'),

  -- Dépréciations comptes de tiers
  (p_org_id, '49', 'Dépréciations des comptes de tiers', 'actif', 'depreciations_tiers', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '491', 'Dépréciations des comptes de clients', 'actif', 'depreciations_tiers', '49', 2, TRUE, 'PCG'),

  -- =====================================================
  -- CLASSE 5 - COMPTES FINANCIERS
  -- =====================================================
  (p_org_id, '50', 'Valeurs mobilières de placement', 'actif', 'vmp', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '503', 'Actions', 'actif', 'vmp', '50', 2, TRUE, 'PCG'),
  (p_org_id, '506', 'Obligations', 'actif', 'vmp', '50', 2, TRUE, 'PCG'),
  (p_org_id, '508', 'Autres valeurs mobilières de placement', 'actif', 'vmp', '50', 2, TRUE, 'PCG'),

  (p_org_id, '51', 'Banques, établissements financiers', 'actif', 'banque', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '512', 'Banques', 'actif', 'banque', '51', 2, TRUE, 'PCG'),
  (p_org_id, '5121', 'Compte bancaire principal', 'actif', 'banque', '512', 3, TRUE, 'PCG'),
  (p_org_id, '514', 'Chèques postaux', 'actif', 'banque', '51', 2, TRUE, 'PCG'),
  (p_org_id, '517', 'Autres organismes financiers', 'actif', 'banque', '51', 2, TRUE, 'PCG'),

  (p_org_id, '53', 'Caisse', 'actif', 'caisse', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '531', 'Caisse siège social', 'actif', 'caisse', '53', 2, TRUE, 'PCG'),

  (p_org_id, '58', 'Virements internes', 'actif', 'virements_internes', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '580', 'Virements internes', 'actif', 'virements_internes', '58', 2, TRUE, 'PCG'),

  (p_org_id, '59', 'Dépréciations des comptes financiers', 'actif', 'depreciations_financiers', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '590', 'Dépréciations des VMP', 'actif', 'depreciations_financiers', '59', 2, TRUE, 'PCG'),

  -- =====================================================
  -- CLASSE 6 - COMPTES DE CHARGES
  -- =====================================================
  -- Achats
  (p_org_id, '60', 'Achats', 'charge', 'achats', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '601', 'Achats de matières premières', 'charge', 'achats', '60', 2, TRUE, 'PCG'),
  (p_org_id, '602', 'Achats d''autres approvisionnements', 'charge', 'achats', '60', 2, TRUE, 'PCG'),
  (p_org_id, '604', 'Achats d''études et prestations', 'charge', 'achats', '60', 2, TRUE, 'PCG'),
  (p_org_id, '606', 'Achats non stockés de matières et fournitures', 'charge', 'achats', '60', 2, TRUE, 'PCG'),
  (p_org_id, '6061', 'Fournitures non stockables (eau, énergie)', 'charge', 'achats', '606', 3, TRUE, 'PCG'),
  (p_org_id, '6063', 'Fournitures d''entretien et de petit équipement', 'charge', 'achats', '606', 3, TRUE, 'PCG'),
  (p_org_id, '6064', 'Fournitures administratives', 'charge', 'achats', '606', 3, TRUE, 'PCG'),
  (p_org_id, '607', 'Achats de marchandises', 'charge', 'achats', '60', 2, TRUE, 'PCG'),
  (p_org_id, '609', 'RRR obtenus sur achats', 'charge', 'achats', '60', 2, TRUE, 'PCG'),

  -- Services extérieurs
  (p_org_id, '61', 'Services extérieurs', 'charge', 'services_ext', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '611', 'Sous-traitance générale', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '612', 'Redevances de crédit-bail', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '613', 'Locations', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '614', 'Charges locatives et de copropriété', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '615', 'Entretien et réparations', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '616', 'Primes d''assurances', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '617', 'Études et recherches', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),
  (p_org_id, '618', 'Divers', 'charge', 'services_ext', '61', 2, TRUE, 'PCG'),

  -- Autres services extérieurs
  (p_org_id, '62', 'Autres services extérieurs', 'charge', 'autres_services', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '621', 'Personnel extérieur à l''entreprise', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '622', 'Rémunérations d''intermédiaires et honoraires', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '6226', 'Honoraires', 'charge', 'autres_services', '622', 3, TRUE, 'PCG'),
  (p_org_id, '6227', 'Frais d''actes et de contentieux', 'charge', 'autres_services', '622', 3, TRUE, 'PCG'),
  (p_org_id, '623', 'Publicité, publications, relations publiques', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '624', 'Transports de biens et transports collectifs', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '625', 'Déplacements, missions et réceptions', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '6251', 'Voyages et déplacements', 'charge', 'autres_services', '625', 3, TRUE, 'PCG'),
  (p_org_id, '6255', 'Frais de déménagement', 'charge', 'autres_services', '625', 3, TRUE, 'PCG'),
  (p_org_id, '6256', 'Missions', 'charge', 'autres_services', '625', 3, TRUE, 'PCG'),
  (p_org_id, '6257', 'Réceptions', 'charge', 'autres_services', '625', 3, TRUE, 'PCG'),
  (p_org_id, '626', 'Frais postaux et de télécommunications', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '627', 'Services bancaires et assimilés', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),
  (p_org_id, '628', 'Divers', 'charge', 'autres_services', '62', 2, TRUE, 'PCG'),

  -- Impôts et taxes
  (p_org_id, '63', 'Impôts, taxes et versements assimilés', 'charge', 'impots', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '631', 'Impôts, taxes et versements sur rémunérations', 'charge', 'impots', '63', 2, TRUE, 'PCG'),
  (p_org_id, '633', 'Impôts, taxes et versements sur rémunérations (autres org.)', 'charge', 'impots', '63', 2, TRUE, 'PCG'),
  (p_org_id, '635', 'Autres impôts, taxes et versements assimilés', 'charge', 'impots', '63', 2, TRUE, 'PCG'),
  (p_org_id, '6351', 'Impôts directs', 'charge', 'impots', '635', 3, TRUE, 'PCG'),
  (p_org_id, '6354', 'Droits d''enregistrement et de timbre', 'charge', 'impots', '635', 3, TRUE, 'PCG'),

  -- Charges de personnel
  (p_org_id, '64', 'Charges de personnel', 'charge', 'personnel', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '641', 'Rémunérations du personnel', 'charge', 'personnel', '64', 2, TRUE, 'PCG'),
  (p_org_id, '6411', 'Salaires, appointements', 'charge', 'personnel', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6412', 'Congés payés', 'charge', 'personnel', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6413', 'Primes et gratifications', 'charge', 'personnel', '641', 3, TRUE, 'PCG'),
  (p_org_id, '6414', 'Indemnités et avantages divers', 'charge', 'personnel', '641', 3, TRUE, 'PCG'),
  (p_org_id, '644', 'Rémunération du travail de l''exploitant', 'charge', 'personnel', '64', 2, TRUE, 'PCG'),
  (p_org_id, '645', 'Charges de sécurité sociale et de prévoyance', 'charge', 'personnel', '64', 2, TRUE, 'PCG'),
  (p_org_id, '6451', 'Cotisations à l''URSSAF', 'charge', 'personnel', '645', 3, TRUE, 'PCG'),
  (p_org_id, '6453', 'Cotisations aux caisses de retraites', 'charge', 'personnel', '645', 3, TRUE, 'PCG'),
  (p_org_id, '6454', 'Cotisations aux ASSEDIC', 'charge', 'personnel', '645', 3, TRUE, 'PCG'),
  (p_org_id, '647', 'Autres charges sociales', 'charge', 'personnel', '64', 2, TRUE, 'PCG'),
  (p_org_id, '648', 'Autres charges de personnel', 'charge', 'personnel', '64', 2, TRUE, 'PCG'),

  -- Autres charges de gestion
  (p_org_id, '65', 'Autres charges de gestion courante', 'charge', 'autres_charges', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '651', 'Redevances pour concessions, brevets, licences', 'charge', 'autres_charges', '65', 2, TRUE, 'PCG'),
  (p_org_id, '654', 'Pertes sur créances irrécouvrables', 'charge', 'autres_charges', '65', 2, TRUE, 'PCG'),
  (p_org_id, '658', 'Charges diverses de gestion courante', 'charge', 'autres_charges', '65', 2, TRUE, 'PCG'),

  -- Charges financières
  (p_org_id, '66', 'Charges financières', 'charge', 'charges_financieres', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '661', 'Charges d''intérêts', 'charge', 'charges_financieres', '66', 2, TRUE, 'PCG'),
  (p_org_id, '6611', 'Intérêts des emprunts et dettes', 'charge', 'charges_financieres', '661', 3, TRUE, 'PCG'),
  (p_org_id, '6615', 'Intérêts des comptes courants et dépôts', 'charge', 'charges_financieres', '661', 3, TRUE, 'PCG'),
  (p_org_id, '6616', 'Intérêts bancaires', 'charge', 'charges_financieres', '661', 3, TRUE, 'PCG'),
  (p_org_id, '664', 'Pertes sur créances liées à des participations', 'charge', 'charges_financieres', '66', 2, TRUE, 'PCG'),
  (p_org_id, '665', 'Escomptes accordés', 'charge', 'charges_financieres', '66', 2, TRUE, 'PCG'),
  (p_org_id, '666', 'Pertes de change', 'charge', 'charges_financieres', '66', 2, TRUE, 'PCG'),
  (p_org_id, '667', 'Charges nettes sur cessions de VMP', 'charge', 'charges_financieres', '66', 2, TRUE, 'PCG'),
  (p_org_id, '668', 'Autres charges financières', 'charge', 'charges_financieres', '66', 2, TRUE, 'PCG'),

  -- Charges exceptionnelles
  (p_org_id, '67', 'Charges exceptionnelles', 'charge', 'charges_exceptionnelles', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '671', 'Charges exceptionnelles sur opérations de gestion', 'charge', 'charges_exceptionnelles', '67', 2, TRUE, 'PCG'),
  (p_org_id, '675', 'Valeurs comptables des éléments d''actif cédés', 'charge', 'charges_exceptionnelles', '67', 2, TRUE, 'PCG'),
  (p_org_id, '678', 'Autres charges exceptionnelles', 'charge', 'charges_exceptionnelles', '67', 2, TRUE, 'PCG'),

  -- Dotations
  (p_org_id, '68', 'Dotations aux amortissements, dépréciations et provisions', 'charge', 'dotations', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '681', 'Dotations aux amortissements et provisions - exploitation', 'charge', 'dotations', '68', 2, TRUE, 'PCG'),
  (p_org_id, '6811', 'Dotations aux amortissements des immobilisations', 'charge', 'dotations', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6815', 'Dotations aux provisions pour risques et charges d''exploitation', 'charge', 'dotations', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6816', 'Dotations aux dépréciations des immobilisations', 'charge', 'dotations', '681', 3, TRUE, 'PCG'),
  (p_org_id, '6817', 'Dotations aux dépréciations des actifs circulants', 'charge', 'dotations', '681', 3, TRUE, 'PCG'),
  (p_org_id, '686', 'Dotations aux amortissements et provisions - financières', 'charge', 'dotations', '68', 2, TRUE, 'PCG'),
  (p_org_id, '687', 'Dotations aux amortissements et provisions - exceptionnelles', 'charge', 'dotations', '68', 2, TRUE, 'PCG'),

  -- Impôts sur les bénéfices
  (p_org_id, '69', 'Participation des salariés - Impôts sur les bénéfices', 'charge', 'impot_benefices', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '691', 'Participation des salariés aux résultats', 'charge', 'impot_benefices', '69', 2, TRUE, 'PCG'),
  (p_org_id, '695', 'Impôts sur les bénéfices', 'charge', 'impot_benefices', '69', 2, TRUE, 'PCG'),
  (p_org_id, '699', 'Produits - Report en arrière des déficits', 'produit', 'impot_benefices', '69', 2, TRUE, 'PCG'),

  -- =====================================================
  -- CLASSE 7 - COMPTES DE PRODUITS
  -- =====================================================
  -- Ventes
  (p_org_id, '70', 'Ventes de produits fabriqués, prestations de services, marchandises', 'produit', 'ventes', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '701', 'Ventes de produits finis', 'produit', 'ventes', '70', 2, TRUE, 'PCG'),
  (p_org_id, '706', 'Prestations de services', 'produit', 'ventes', '70', 2, TRUE, 'PCG'),
  (p_org_id, '707', 'Ventes de marchandises', 'produit', 'ventes', '70', 2, TRUE, 'PCG'),
  (p_org_id, '708', 'Produits des activités annexes', 'produit', 'ventes', '70', 2, TRUE, 'PCG'),
  (p_org_id, '709', 'RRR accordés par l''entreprise', 'produit', 'ventes', '70', 2, TRUE, 'PCG'),

  -- Production stockée
  (p_org_id, '71', 'Production stockée (ou déstockage)', 'produit', 'production', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '713', 'Variation des stocks (en-cours de production, produits)', 'produit', 'production', '71', 2, TRUE, 'PCG'),

  -- Production immobilisée
  (p_org_id, '72', 'Production immobilisée', 'produit', 'production', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '721', 'Immobilisations incorporelles', 'produit', 'production', '72', 2, TRUE, 'PCG'),
  (p_org_id, '722', 'Immobilisations corporelles', 'produit', 'production', '72', 2, TRUE, 'PCG'),

  -- Subventions d'exploitation
  (p_org_id, '74', 'Subventions d''exploitation', 'produit', 'subventions', NULL, 1, TRUE, 'PCG'),

  -- Autres produits de gestion
  (p_org_id, '75', 'Autres produits de gestion courante', 'produit', 'autres_produits', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '751', 'Redevances pour concessions, brevets, licences', 'produit', 'autres_produits', '75', 2, TRUE, 'PCG'),
  (p_org_id, '758', 'Produits divers de gestion courante', 'produit', 'autres_produits', '75', 2, TRUE, 'PCG'),

  -- Produits financiers
  (p_org_id, '76', 'Produits financiers', 'produit', 'produits_financiers', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '761', 'Produits de participations', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '762', 'Produits des autres immobilisations financières', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '763', 'Revenus des autres créances', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '764', 'Revenus des VMP', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '765', 'Escomptes obtenus', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '766', 'Gains de change', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '767', 'Produits nets sur cessions de VMP', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),
  (p_org_id, '768', 'Autres produits financiers', 'produit', 'produits_financiers', '76', 2, TRUE, 'PCG'),

  -- Produits exceptionnels
  (p_org_id, '77', 'Produits exceptionnels', 'produit', 'produits_exceptionnels', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '771', 'Produits exceptionnels sur opérations de gestion', 'produit', 'produits_exceptionnels', '77', 2, TRUE, 'PCG'),
  (p_org_id, '775', 'Produits des cessions d''éléments d''actif', 'produit', 'produits_exceptionnels', '77', 2, TRUE, 'PCG'),
  (p_org_id, '778', 'Autres produits exceptionnels', 'produit', 'produits_exceptionnels', '77', 2, TRUE, 'PCG'),

  -- Reprises
  (p_org_id, '78', 'Reprises sur amortissements, dépréciations et provisions', 'produit', 'reprises', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '781', 'Reprises sur amortissements et provisions - exploitation', 'produit', 'reprises', '78', 2, TRUE, 'PCG'),
  (p_org_id, '786', 'Reprises sur provisions - financières', 'produit', 'reprises', '78', 2, TRUE, 'PCG'),
  (p_org_id, '787', 'Reprises sur provisions - exceptionnelles', 'produit', 'reprises', '78', 2, TRUE, 'PCG'),

  -- Transferts de charges
  (p_org_id, '79', 'Transferts de charges', 'produit', 'transferts', NULL, 1, TRUE, 'PCG'),
  (p_org_id, '791', 'Transferts de charges d''exploitation', 'produit', 'transferts', '79', 2, TRUE, 'PCG'),
  (p_org_id, '796', 'Transferts de charges financières', 'produit', 'transferts', '79', 2, TRUE, 'PCG'),
  (p_org_id, '797', 'Transferts de charges exceptionnelles', 'produit', 'transferts', '79', 2, TRUE, 'PCG');

  RAISE NOTICE 'PCG 2025 initialisé avec types français pour org %', p_org_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. COMMENTAIRES SUR LES COLONNES
-- =====================================================

COMMENT ON COLUMN erp_suppliers.siren IS 'Numéro SIREN (9 chiffres)';
COMMENT ON COLUMN erp_suppliers.siret IS 'Numéro SIRET (14 chiffres)';
COMMENT ON COLUMN erp_suppliers.naf_code IS 'Code NAF/APE de l''activité';
COMMENT ON COLUMN erp_suppliers.activite IS 'Description de l''activité';
COMMENT ON COLUMN erp_suppliers.mode_reglement IS 'Mode de règlement par défaut';
COMMENT ON COLUMN erp_suppliers.delai_paiement IS 'Délai de paiement en jours';
COMMENT ON COLUMN erp_suppliers.iban IS 'IBAN du compte bancaire';
COMMENT ON COLUMN erp_suppliers.bic IS 'Code BIC/SWIFT';
COMMENT ON COLUMN erp_suppliers.banque IS 'Nom de la banque';

COMMENT ON COLUMN erp_clients.siren IS 'Numéro SIREN (9 chiffres)';
COMMENT ON COLUMN erp_clients.siret IS 'Numéro SIRET (14 chiffres)';
COMMENT ON COLUMN erp_clients.naf_code IS 'Code NAF/APE de l''activité';
COMMENT ON COLUMN erp_clients.activite IS 'Description de l''activité';
COMMENT ON COLUMN erp_clients.mode_reglement IS 'Mode de règlement par défaut';
COMMENT ON COLUMN erp_clients.delai_paiement IS 'Délai de paiement en jours';
COMMENT ON COLUMN erp_clients.iban IS 'IBAN du compte bancaire';
COMMENT ON COLUMN erp_clients.bic IS 'Code BIC/SWIFT';
COMMENT ON COLUMN erp_clients.banque IS 'Nom de la banque';
