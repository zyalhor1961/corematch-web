-- ============================================================
-- SHARK HUNTER - RENAME org_id → tenant_id
-- ============================================================
--
-- Cette migration renomme la colonne org_id en tenant_id dans
-- toutes les tables shark_* pour clarifier que c'est le TENANT
-- (client SaaS CoreMatch), pas une organisation BTP.
--
-- Éléments modifiés :
--   1. Colonnes : org_id → tenant_id
--   2. Indexes : renommés pour cohérence
--   3. Helper function : user_belongs_to_tenant()
--   4. RLS policies : adaptées pour tenant_id
--   5. Vue : shark_project_full recréée
--   6. Contrainte unique : shark_news_items
--
-- ============================================================


-- ============================================================
-- 1. RENOMMER LES COLONNES org_id → tenant_id
-- ============================================================

ALTER TABLE shark_projects
    RENAME COLUMN org_id TO tenant_id;

ALTER TABLE shark_organizations
    RENAME COLUMN org_id TO tenant_id;

ALTER TABLE shark_people
    RENAME COLUMN org_id TO tenant_id;

ALTER TABLE shark_news_items
    RENAME COLUMN org_id TO tenant_id;

-- Ajouter des commentaires explicatifs
COMMENT ON COLUMN shark_projects.tenant_id IS 'ID du tenant (client SaaS CoreMatch) propriétaire de cette donnée';
COMMENT ON COLUMN shark_organizations.tenant_id IS 'ID du tenant (client SaaS CoreMatch) propriétaire de cette donnée';
COMMENT ON COLUMN shark_people.tenant_id IS 'ID du tenant (client SaaS CoreMatch) propriétaire de cette donnée';
COMMENT ON COLUMN shark_news_items.tenant_id IS 'ID du tenant (client SaaS CoreMatch) propriétaire de cette donnée';


-- ============================================================
-- 2. RENOMMER LES INDEXES
-- ============================================================

-- Note: PostgreSQL renomme automatiquement les indexes sur les colonnes,
-- mais on renomme explicitement pour la cohérence des noms

ALTER INDEX IF EXISTS idx_shark_projects_org
    RENAME TO idx_shark_projects_tenant;

ALTER INDEX IF EXISTS idx_shark_organizations_org
    RENAME TO idx_shark_organizations_tenant;

ALTER INDEX IF EXISTS idx_shark_people_org
    RENAME TO idx_shark_people_tenant;

ALTER INDEX IF EXISTS idx_shark_news_org
    RENAME TO idx_shark_news_tenant;


-- ============================================================
-- 3. METTRE À JOUR LA CONTRAINTE UNIQUE DE shark_news_items
-- ============================================================

-- Supprimer l'ancienne contrainte (qui référençait org_id)
ALTER TABLE shark_news_items
    DROP CONSTRAINT IF EXISTS shark_news_items_org_id_source_url_key;

-- Recréer avec le nouveau nom de colonne
ALTER TABLE shark_news_items
    ADD CONSTRAINT shark_news_items_tenant_id_source_url_key
    UNIQUE (tenant_id, source_url);


-- ============================================================
-- 4. CRÉER LA NOUVELLE HELPER FUNCTION
-- ============================================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS user_belongs_to_org(UUID);

-- Créer la nouvelle fonction avec un nom plus clair
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(target_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = target_tenant_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_belongs_to_tenant(UUID) IS
    'Vérifie si l''utilisateur courant appartient au tenant spécifié';


-- ============================================================
-- 5. METTRE À JOUR LES POLICIES RLS
-- ============================================================

-- -------------------- shark_projects --------------------
DROP POLICY IF EXISTS "shark_projects_select" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_insert" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_update" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_delete" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_service" ON shark_projects;

CREATE POLICY "shark_projects_tenant_select" ON shark_projects
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_projects_tenant_insert" ON shark_projects
    FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_projects_tenant_update" ON shark_projects
    FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_projects_tenant_delete" ON shark_projects
    FOR DELETE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_projects_service_role" ON shark_projects
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- -------------------- shark_organizations --------------------
DROP POLICY IF EXISTS "shark_organizations_select" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_insert" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_update" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_delete" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_service" ON shark_organizations;

CREATE POLICY "shark_organizations_tenant_select" ON shark_organizations
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_organizations_tenant_insert" ON shark_organizations
    FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_organizations_tenant_update" ON shark_organizations
    FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_organizations_tenant_delete" ON shark_organizations
    FOR DELETE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_organizations_service_role" ON shark_organizations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- -------------------- shark_people --------------------
DROP POLICY IF EXISTS "shark_people_select" ON shark_people;
DROP POLICY IF EXISTS "shark_people_insert" ON shark_people;
DROP POLICY IF EXISTS "shark_people_update" ON shark_people;
DROP POLICY IF EXISTS "shark_people_delete" ON shark_people;
DROP POLICY IF EXISTS "shark_people_service" ON shark_people;

CREATE POLICY "shark_people_tenant_select" ON shark_people
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_people_tenant_insert" ON shark_people
    FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_people_tenant_update" ON shark_people
    FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_people_tenant_delete" ON shark_people
    FOR DELETE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_people_service_role" ON shark_people
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- -------------------- shark_news_items --------------------
DROP POLICY IF EXISTS "shark_news_select" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_insert" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_update" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_delete" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_service" ON shark_news_items;

CREATE POLICY "shark_news_tenant_select" ON shark_news_items
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_news_tenant_insert" ON shark_news_items
    FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_news_tenant_update" ON shark_news_items
    FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_news_tenant_delete" ON shark_news_items
    FOR DELETE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "shark_news_service_role" ON shark_news_items
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- -------------------- Tables de liaison --------------------
-- Ces tables n'ont pas de tenant_id direct, l'accès est via les FK

DROP POLICY IF EXISTS "shark_po_access" ON shark_project_organizations;
DROP POLICY IF EXISTS "shark_po_service" ON shark_project_organizations;

CREATE POLICY "shark_po_tenant_access" ON shark_project_organizations
    FOR ALL USING (
        project_id IN (SELECT id FROM shark_projects WHERE user_belongs_to_tenant(tenant_id))
    );
CREATE POLICY "shark_po_service_role" ON shark_project_organizations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "shark_op_access" ON shark_organization_people;
DROP POLICY IF EXISTS "shark_op_service" ON shark_organization_people;

CREATE POLICY "shark_op_tenant_access" ON shark_organization_people
    FOR ALL USING (
        organization_id IN (SELECT id FROM shark_organizations WHERE user_belongs_to_tenant(tenant_id))
    );
CREATE POLICY "shark_op_service_role" ON shark_organization_people
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "shark_pn_access" ON shark_project_news;
DROP POLICY IF EXISTS "shark_pn_service" ON shark_project_news;

CREATE POLICY "shark_pn_tenant_access" ON shark_project_news
    FOR ALL USING (
        project_id IN (SELECT id FROM shark_projects WHERE user_belongs_to_tenant(tenant_id))
    );
CREATE POLICY "shark_pn_service_role" ON shark_project_news
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');


-- ============================================================
-- 6. RECRÉER LA VUE shark_project_full
-- ============================================================

DROP VIEW IF EXISTS shark_project_full;

CREATE VIEW shark_project_full AS
SELECT
    p.id,
    p.tenant_id,
    p.name,
    p.type,
    p.description_short,
    p.location_city,
    p.location_region,
    p.country,
    p.budget_amount,
    p.budget_currency,
    p.start_date_est,
    p.end_date_est,
    p.phase,
    p.sector_tags,
    p.shark_score,
    p.shark_priority,
    p.ai_confidence,
    p.ai_extracted_at,
    p.raw_extraction,
    p.created_at,
    p.updated_at,
    -- Organisations liées au projet
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'organization_id', o.id,
                'organization_name', o.name,
                'org_type', o.org_type,
                'role_in_project', po.role_in_project,
                'lot_name', po.lot_name,
                'city', o.city,
                'website', o.website
            )
        )
        FROM shark_project_organizations po
        JOIN shark_organizations o ON o.id = po.organization_id
        WHERE po.project_id = p.id),
        '[]'::json
    ) as organizations,
    -- News liées au projet
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'news_id', n.id,
                'title', n.title,
                'source_name', n.source_name,
                'source_url', n.source_url,
                'published_at', n.published_at,
                'role_of_news', pn.role_of_news
            )
        )
        FROM shark_project_news pn
        JOIN shark_news_items n ON n.id = pn.news_id
        WHERE pn.project_id = p.id),
        '[]'::json
    ) as news_items
FROM shark_projects p;

COMMENT ON VIEW shark_project_full IS
    'Vue enrichie d''un projet Shark avec ses organisations et news associées. Expose tenant_id pour le RLS.';


-- ============================================================
-- 7. SANITY CHECK QUERIES (à exécuter manuellement)
-- ============================================================

/*
-- Vérifier que les colonnes ont bien été renommées
SELECT column_name
FROM information_schema.columns
WHERE table_name LIKE 'shark_%'
AND column_name IN ('org_id', 'tenant_id')
ORDER BY table_name, column_name;

-- Vérifier les indexes
SELECT indexname
FROM pg_indexes
WHERE tablename LIKE 'shark_%'
AND indexname LIKE '%tenant%';

-- Vérifier les policies RLS
SELECT tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'shark_%'
ORDER BY tablename, policyname;

-- Vérifier que la vue fonctionne
SELECT * FROM shark_project_full LIMIT 5;

-- Compter par tenant
SELECT tenant_id, COUNT(*)
FROM shark_projects
GROUP BY tenant_id;

-- Vérifier qu'il n'y a plus de références à org_id
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name LIKE 'shark_%'
AND column_name = 'org_id';
-- Résultat attendu: 0 lignes
*/


-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
