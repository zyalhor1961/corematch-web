-- =====================================================
-- DAF Docs Assistant - Phase 0 Schema
-- =====================================================
-- Date: 2025-01-03
-- Objectif: POC validation DAF (upload + classification)

-- Table principale: documents DAF
CREATE TABLE IF NOT EXISTS daf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Fichier
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size_bytes BIGINT,
  file_type TEXT,

  -- Classification
  doc_type TEXT NOT NULL DEFAULT 'autre',
  -- Types: facture, releve_bancaire, contrat, assurance, note_frais, autre
  fournisseur TEXT,

  -- Extraction (Phase 1 - vide pour l'instant)
  montant_ht NUMERIC(12,2),
  montant_ttc NUMERIC(12,2),
  taux_tva NUMERIC(5,2),
  date_document DATE,
  date_echeance DATE,
  numero_facture TEXT,

  -- Comptabilité (Phase 1 - vide pour l'instant)
  compte_propose TEXT, -- Ex: "606100"
  axe_analytique TEXT,

  -- Extraction brute (JSON Azure DI)
  extraction_raw JSONB,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'uploaded',
  -- Statuts: uploaded, extracted, validated, exported, archived
  source TEXT NOT NULL DEFAULT 'manual_upload',
  -- Sources: manual_upload, email_imap, drive_sync, sftp

  -- Métadonnées
  notes TEXT,
  tags TEXT[],

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id)
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_daf_docs_org_created
  ON daf_documents(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daf_docs_type
  ON daf_documents(org_id, doc_type);

CREATE INDEX IF NOT EXISTS idx_daf_docs_status
  ON daf_documents(org_id, status);

CREATE INDEX IF NOT EXISTS idx_daf_docs_fournisseur
  ON daf_documents(org_id, fournisseur);

CREATE INDEX IF NOT EXISTS idx_daf_docs_date
  ON daf_documents(org_id, date_document DESC)
  WHERE date_document IS NOT NULL;

-- Full-text search sur file_name et fournisseur
CREATE INDEX IF NOT EXISTS idx_daf_docs_search
  ON daf_documents USING GIN(
    to_tsvector('french', COALESCE(file_name, '') || ' ' || COALESCE(fournisseur, ''))
  );

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_daf_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_daf_documents_updated_at
  BEFORE UPDATE ON daf_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_daf_documents_updated_at();

-- Row Level Security (RLS)
ALTER TABLE daf_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access documents from their organizations
CREATE POLICY "Users access own org documents" ON daf_documents
  FOR ALL USING (
    org_id IN (
      SELECT org_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Storage Bucket pour fichiers DAF
-- =====================================================

-- Créer bucket (si n'existe pas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'daf-docs',
  'daf-docs',
  false, -- Privé (accès via signed URLs)
  10485760, -- 10 MB max
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Org members can upload to their org folder
CREATE POLICY "Org members can upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'daf-docs' AND
    (storage.foldername(name))[1] IN (
      SELECT org_id::text
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Storage RLS: Org members can read their org files
CREATE POLICY "Org members can read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'daf-docs' AND
    (storage.foldername(name))[1] IN (
      SELECT org_id::text
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Storage RLS: Org members can delete their org files
CREATE POLICY "Org members can delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'daf-docs' AND
    (storage.foldername(name))[1] IN (
      SELECT org_id::text
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Vue helper: documents avec métadonnées enrichies
-- =====================================================

CREATE OR REPLACE VIEW daf_documents_enriched AS
SELECT
  d.*,
  u.email as created_by_email,
  v.email as validated_by_email,
  -- Age du document
  EXTRACT(DAY FROM NOW() - d.created_at) as age_days,
  -- Délai de paiement (si facture)
  CASE
    WHEN d.date_echeance IS NOT NULL AND d.date_document IS NOT NULL
    THEN (d.date_echeance - d.date_document)
    ELSE NULL
  END as delai_paiement_jours,
  -- Statut LME (si > 60j)
  CASE
    WHEN d.date_echeance IS NOT NULL AND d.date_document IS NOT NULL
    THEN (d.date_echeance - d.date_document) > 60
    ELSE NULL
  END as lme_depassement
FROM daf_documents d
LEFT JOIN auth.users u ON d.created_by = u.id
LEFT JOIN auth.users v ON d.validated_by = v.id;

-- Grant access à la vue
GRANT SELECT ON daf_documents_enriched TO authenticated;

-- =====================================================
-- Fonction helper: statistiques documents par org
-- =====================================================

CREATE OR REPLACE FUNCTION get_daf_stats(p_org_id UUID)
RETURNS TABLE(
  total_documents BIGINT,
  total_factures BIGINT,
  total_valides BIGINT,
  total_en_attente BIGINT,
  montant_total_ttc NUMERIC,
  nombre_fournisseurs BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_documents,
    COUNT(*) FILTER (WHERE doc_type = 'facture') as total_factures,
    COUNT(*) FILTER (WHERE status = 'validated') as total_valides,
    COUNT(*) FILTER (WHERE status IN ('uploaded', 'extracted')) as total_en_attente,
    SUM(montant_ttc) as montant_total_ttc,
    COUNT(DISTINCT fournisseur) as nombre_fournisseurs
  FROM daf_documents
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Données de test (optionnel - à supprimer en prod)
-- =====================================================

-- Types de documents reconnus (pour classification)
COMMENT ON COLUMN daf_documents.doc_type IS
  'Types: facture, releve_bancaire, contrat, assurance, note_frais, autre';

-- Statuts possibles
COMMENT ON COLUMN daf_documents.status IS
  'Workflow: uploaded → extracted → validated → exported → archived';

-- Sources d''ingestion
COMMENT ON COLUMN daf_documents.source IS
  'Sources: manual_upload, email_imap, drive_sync, sftp';
