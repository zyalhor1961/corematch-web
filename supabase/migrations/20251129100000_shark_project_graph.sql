-- ============================================================
-- SHARK HUNTER - PROJECT GRAPH SCHEMA
-- ============================================================
--
-- Ce schema modélise un graphe orienté pour la vision "Shark Hunter" :
-- L'IA lit la presse, les appels d'offres et détecte des PROJETS de travaux.
-- Chaque projet est relié à des ORGANISATIONS (MOA, MOE, entreprises)
-- et à des PERSONNES (décideurs), le tout tracé depuis les NEWS.
--
-- Tables principales :
--   - shark_projects      : Projets BTP détectés (chantiers, rénovations, etc.)
--   - shark_organizations : Entreprises/collectivités impliquées
--   - shark_people        : Personnes/décideurs identifiés
--   - shark_news_items    : Articles de presse sources
--
-- Tables de liaison (graphe) :
--   - shark_project_organizations : Rôle d'une org dans un projet
--   - shark_organization_people   : Rôle d'une personne dans une org
--   - shark_project_news          : Lien news → projet
--
-- NOTE: Le préfixe "shark_" évite les conflits avec les tables existantes
--       (organizations = clients SaaS, projects = CV screening)
-- ============================================================


-- ============================================================
-- 1. SHARK_PROJECTS - Projets BTP détectés par l'IA
-- ============================================================
-- Représente un projet de construction/rénovation/infrastructure
-- détecté dans la presse ou les appels d'offres.

CREATE TABLE IF NOT EXISTS shark_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identification
    name TEXT NOT NULL,
    type TEXT CHECK (type IN (
        'construction_neuve',
        'renovation',
        'extension',
        'demolition',
        'infrastructure',
        'amenagement',
        'maintenance',
        'autre'
    )),
    description_short TEXT,

    -- Localisation
    location_city TEXT,
    location_region TEXT,
    country TEXT DEFAULT 'FR',

    -- Budget et planning
    budget_amount NUMERIC,
    budget_currency TEXT DEFAULT 'EUR',
    start_date_est DATE,
    end_date_est DATE,

    -- Phase du projet
    phase TEXT DEFAULT 'detection' CHECK (phase IN (
        'detection',      -- Vient d'être détecté
        'etude',          -- En phase d'étude/conception
        'appel_offres',   -- Appel d'offres en cours
        'attribution',    -- Marché attribué
        'travaux',        -- Travaux en cours
        'livraison',      -- Projet livré
        'abandonne'       -- Projet abandonné
    )),

    -- Classification
    sector_tags JSONB DEFAULT '[]'::jsonb,  -- Ex: ["hotel", "tertiaire", "luxe"]

    -- Scoring Shark
    shark_score INTEGER DEFAULT 0 CHECK (shark_score >= 0 AND shark_score <= 100),
    shark_priority TEXT DEFAULT 'medium' CHECK (shark_priority IN ('low', 'medium', 'high', 'critical')),

    -- Métadonnées IA
    ai_confidence NUMERIC(3,2),  -- Confiance de la détection (0.00-1.00)
    ai_extracted_at TIMESTAMPTZ,
    raw_extraction JSONB,  -- Données brutes de l'extraction

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE shark_projects IS 'Projets BTP détectés par l''IA Shark Hunter (chantiers, rénovations, infrastructures)';
COMMENT ON COLUMN shark_projects.type IS 'Type de projet: construction_neuve, renovation, extension, demolition, infrastructure, amenagement, maintenance, autre';
COMMENT ON COLUMN shark_projects.phase IS 'Phase du cycle de vie: detection → etude → appel_offres → attribution → travaux → livraison';
COMMENT ON COLUMN shark_projects.sector_tags IS 'Tags sectoriels JSON: ["hotel", "tertiaire", "luxe", "public"]';
COMMENT ON COLUMN shark_projects.shark_score IS 'Score d''opportunité Shark (0-100)';


-- ============================================================
-- 2. SHARK_ORGANIZATIONS - Entreprises/Collectivités
-- ============================================================
-- Organisations détectées comme parties prenantes des projets :
-- MOA (Maître d'Ouvrage), MOE (Maître d'Oeuvre), entreprises travaux, etc.

CREATE TABLE IF NOT EXISTS shark_organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identification
    name TEXT NOT NULL,
    org_type TEXT CHECK (org_type IN (
        'moa',              -- Maître d'Ouvrage (client final)
        'moe',              -- Maître d'Oeuvre (architecte, BET)
        'entreprise_gros_oeuvre',
        'entreprise_second_oeuvre',
        'promoteur',
        'collectivite',
        'etablissement_public',
        'fonciere',
        'autre'
    )),

    -- Coordonnées
    website TEXT,
    city TEXT,
    region TEXT,
    country TEXT DEFAULT 'FR',

    -- Taille
    size_bucket TEXT CHECK (size_bucket IN (
        'tpe',       -- < 10 employés
        'pme',       -- 10-250 employés
        'eti',       -- 250-5000 employés
        'ge'         -- > 5000 employés (Grande Entreprise)
    )),

    -- Enrichissement
    linkedin_url TEXT,
    siren TEXT,
    siret TEXT,

    -- Métadonnées
    ai_confidence NUMERIC(3,2),
    raw_extraction JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE shark_organizations IS 'Organisations impliquées dans les projets BTP (MOA, MOE, entreprises travaux)';
COMMENT ON COLUMN shark_organizations.org_type IS 'Type: moa, moe, entreprise_gros_oeuvre, entreprise_second_oeuvre, promoteur, collectivite, etc.';
COMMENT ON COLUMN shark_organizations.size_bucket IS 'Taille: tpe (<10), pme (10-250), eti (250-5000), ge (>5000)';


-- ============================================================
-- 3. SHARK_PEOPLE - Décideurs et Contacts
-- ============================================================
-- Personnes identifiées comme décideurs ou contacts clés
-- dans les organisations liées aux projets.

CREATE TABLE IF NOT EXISTS shark_people (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identification
    full_name TEXT NOT NULL,
    title TEXT,  -- "Directeur Travaux", "Chef de Projet", etc.

    -- Contact
    linkedin_url TEXT,
    email_guess TEXT,  -- Email deviné (format prenom.nom@domain)
    phone TEXT,

    -- Localisation
    city TEXT,
    region TEXT,
    country TEXT DEFAULT 'FR',

    -- Qualité des données
    source_confidence NUMERIC(3,2),  -- Confiance sur l'identification (0.00-1.00)
    source_type TEXT CHECK (source_type IN (
        'linkedin',
        'article_presse',
        'site_entreprise',
        'annuaire',
        'enrichissement_api',
        'manuel'
    )),

    -- Métadonnées
    raw_extraction JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE shark_people IS 'Décideurs et contacts identifiés dans les organisations';
COMMENT ON COLUMN shark_people.title IS 'Titre/fonction: Directeur Travaux, Chef de Projet, DG, etc.';
COMMENT ON COLUMN shark_people.source_confidence IS 'Confiance sur l''identification (0.00-1.00)';
COMMENT ON COLUMN shark_people.email_guess IS 'Email deviné (non vérifié) au format prenom.nom@domain';


-- ============================================================
-- 4. SHARK_NEWS_ITEMS - Articles de presse sources
-- ============================================================
-- Articles d'où les projets ont été détectés.
-- Permet la traçabilité et évite les doublons de crawl.

CREATE TABLE IF NOT EXISTS shark_news_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Source
    source_url TEXT NOT NULL,
    source_name TEXT,  -- "Le Moniteur", "Batiactu", "Le Figaro Immobilier"

    -- Contenu
    title TEXT,
    summary TEXT,
    full_text TEXT,  -- Texte complet de l'article (optionnel)

    -- Temporalité
    published_at TIMESTAMPTZ,

    -- Classification
    region_hint TEXT,  -- Région mentionnée dans l'article
    category TEXT,     -- "hotel", "logement", "infrastructure", etc.

    -- Crawl info
    crawl_ref TEXT,    -- Référence du crawl (batch ID)
    crawled_at TIMESTAMPTZ DEFAULT NOW(),

    -- Métadonnées
    raw_data JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte d'unicité sur l'URL par org
    UNIQUE(org_id, source_url)
);

COMMENT ON TABLE shark_news_items IS 'Articles de presse d''où les projets BTP ont été détectés';
COMMENT ON COLUMN shark_news_items.source_name IS 'Nom de la source: Le Moniteur, Batiactu, Le Figaro Immobilier, etc.';
COMMENT ON COLUMN shark_news_items.crawl_ref IS 'Référence du batch de crawl pour traçabilité';


-- ============================================================
-- 5. SHARK_PROJECT_ORGANIZATIONS - Liaison Projet ↔ Organisation
-- ============================================================
-- Définit le rôle d'une organisation dans un projet.

CREATE TABLE IF NOT EXISTS shark_project_organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES shark_projects(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES shark_organizations(id) ON DELETE CASCADE NOT NULL,

    -- Rôle dans le projet
    role_in_project TEXT NOT NULL CHECK (role_in_project IN (
        'maitrise_ouvrage',      -- Client/Donneur d'ordre
        'maitrise_oeuvre',       -- Architecte/BET
        'entreprise_generale',   -- Mandataire du lot
        'sous_traitant',
        'fournisseur',
        'cotraitant',
        'autre'
    )),

    -- Lot spécifique (si applicable)
    lot_name TEXT,  -- "Gros Oeuvre", "CVC", "Electricité", etc.

    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    ai_confidence NUMERIC(3,2),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte d'unicité
    UNIQUE(project_id, organization_id, role_in_project)
);

COMMENT ON TABLE shark_project_organizations IS 'Liaison entre projets et organisations avec leur rôle';
COMMENT ON COLUMN shark_project_organizations.role_in_project IS 'Rôle: maitrise_ouvrage, maitrise_oeuvre, entreprise_generale, sous_traitant, fournisseur';
COMMENT ON COLUMN shark_project_organizations.lot_name IS 'Nom du lot si applicable: Gros Oeuvre, CVC, Electricité, etc.';


-- ============================================================
-- 6. SHARK_ORGANIZATION_PEOPLE - Liaison Organisation ↔ Personne
-- ============================================================
-- Définit le rôle d'une personne dans une organisation.

CREATE TABLE IF NOT EXISTS shark_organization_people (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES shark_organizations(id) ON DELETE CASCADE NOT NULL,
    person_id UUID REFERENCES shark_people(id) ON DELETE CASCADE NOT NULL,

    -- Rôle dans l'organisation
    role_in_org TEXT NOT NULL CHECK (role_in_org IN (
        'dg',                    -- Directeur Général
        'dga',                   -- Directeur Général Adjoint
        'directeur_travaux',
        'chef_de_projet',
        'conducteur_travaux',
        'responsable_commercial',
        'acheteur',
        'prescripteur',
        'autre'
    )),

    -- Période (optionnel)
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT TRUE,

    -- Métadonnées
    ai_confidence NUMERIC(3,2),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte d'unicité
    UNIQUE(organization_id, person_id, role_in_org)
);

COMMENT ON TABLE shark_organization_people IS 'Liaison entre organisations et personnes avec leur rôle';
COMMENT ON COLUMN shark_organization_people.role_in_org IS 'Rôle: dg, dga, directeur_travaux, chef_de_projet, conducteur_travaux, etc.';


-- ============================================================
-- 7. SHARK_PROJECT_NEWS - Liaison Projet ↔ News
-- ============================================================
-- Trace l'origine des projets (d'où vient l'info).

CREATE TABLE IF NOT EXISTS shark_project_news (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES shark_projects(id) ON DELETE CASCADE NOT NULL,
    news_id UUID REFERENCES shark_news_items(id) ON DELETE CASCADE NOT NULL,

    -- Rôle de la news
    role_of_news TEXT DEFAULT 'source' CHECK (role_of_news IN (
        'source',       -- News qui a révélé le projet
        'update',       -- Mise à jour sur le projet
        'attribution',  -- Annonce d'attribution
        'livraison',    -- Annonce de livraison
        'autre'
    )),

    -- Extrait pertinent
    relevant_excerpt TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte d'unicité
    UNIQUE(project_id, news_id)
);

COMMENT ON TABLE shark_project_news IS 'Liaison entre projets et articles de presse (traçabilité)';
COMMENT ON COLUMN shark_project_news.role_of_news IS 'Rôle: source (origine), update, attribution, livraison';


-- ============================================================
-- 8. INDEXES POUR LA PERFORMANCE
-- ============================================================

-- shark_projects
CREATE INDEX IF NOT EXISTS idx_shark_projects_org ON shark_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_shark_projects_type ON shark_projects(type);
CREATE INDEX IF NOT EXISTS idx_shark_projects_phase ON shark_projects(phase);
CREATE INDEX IF NOT EXISTS idx_shark_projects_location ON shark_projects(location_city, location_region);
CREATE INDEX IF NOT EXISTS idx_shark_projects_score ON shark_projects(shark_score DESC);
CREATE INDEX IF NOT EXISTS idx_shark_projects_priority ON shark_projects(shark_priority);
CREATE INDEX IF NOT EXISTS idx_shark_projects_created ON shark_projects(created_at DESC);

-- shark_organizations
CREATE INDEX IF NOT EXISTS idx_shark_organizations_org ON shark_organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_shark_organizations_type ON shark_organizations(org_type);
CREATE INDEX IF NOT EXISTS idx_shark_organizations_name ON shark_organizations(name);
CREATE INDEX IF NOT EXISTS idx_shark_organizations_city ON shark_organizations(city);

-- shark_people
CREATE INDEX IF NOT EXISTS idx_shark_people_org ON shark_people(org_id);
CREATE INDEX IF NOT EXISTS idx_shark_people_name ON shark_people(full_name);
CREATE INDEX IF NOT EXISTS idx_shark_people_linkedin ON shark_people(linkedin_url);

-- shark_news_items
CREATE INDEX IF NOT EXISTS idx_shark_news_org ON shark_news_items(org_id);
CREATE INDEX IF NOT EXISTS idx_shark_news_url ON shark_news_items(source_url);
CREATE INDEX IF NOT EXISTS idx_shark_news_published ON shark_news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_shark_news_source ON shark_news_items(source_name);

-- Liaisons
CREATE INDEX IF NOT EXISTS idx_shark_po_project ON shark_project_organizations(project_id);
CREATE INDEX IF NOT EXISTS idx_shark_po_org ON shark_project_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_shark_op_org ON shark_organization_people(organization_id);
CREATE INDEX IF NOT EXISTS idx_shark_op_person ON shark_organization_people(person_id);
CREATE INDEX IF NOT EXISTS idx_shark_pn_project ON shark_project_news(project_id);
CREATE INDEX IF NOT EXISTS idx_shark_pn_news ON shark_project_news(news_id);


-- ============================================================
-- 9. TRIGGERS - Updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION update_shark_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shark_projects_updated_at ON shark_projects;
CREATE TRIGGER shark_projects_updated_at
    BEFORE UPDATE ON shark_projects
    FOR EACH ROW EXECUTE FUNCTION update_shark_updated_at();

DROP TRIGGER IF EXISTS shark_organizations_updated_at ON shark_organizations;
CREATE TRIGGER shark_organizations_updated_at
    BEFORE UPDATE ON shark_organizations
    FOR EACH ROW EXECUTE FUNCTION update_shark_updated_at();

DROP TRIGGER IF EXISTS shark_people_updated_at ON shark_people;
CREATE TRIGGER shark_people_updated_at
    BEFORE UPDATE ON shark_people
    FOR EACH ROW EXECUTE FUNCTION update_shark_updated_at();

DROP TRIGGER IF EXISTS shark_news_items_updated_at ON shark_news_items;
CREATE TRIGGER shark_news_items_updated_at
    BEFORE UPDATE ON shark_news_items
    FOR EACH ROW EXECUTE FUNCTION update_shark_updated_at();


-- ============================================================
-- 10. RLS POLICIES
-- ============================================================

ALTER TABLE shark_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_project_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_organization_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE shark_project_news ENABLE ROW LEVEL SECURITY;

-- Helper function pour vérifier l'appartenance org
CREATE OR REPLACE FUNCTION user_belongs_to_org(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = target_org_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies pour shark_projects
DROP POLICY IF EXISTS "shark_projects_select" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_insert" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_update" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_delete" ON shark_projects;
DROP POLICY IF EXISTS "shark_projects_service" ON shark_projects;

CREATE POLICY "shark_projects_select" ON shark_projects
    FOR SELECT USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_projects_insert" ON shark_projects
    FOR INSERT WITH CHECK (user_belongs_to_org(org_id));
CREATE POLICY "shark_projects_update" ON shark_projects
    FOR UPDATE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_projects_delete" ON shark_projects
    FOR DELETE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_projects_service" ON shark_projects
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies pour shark_organizations
DROP POLICY IF EXISTS "shark_organizations_select" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_insert" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_update" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_delete" ON shark_organizations;
DROP POLICY IF EXISTS "shark_organizations_service" ON shark_organizations;

CREATE POLICY "shark_organizations_select" ON shark_organizations
    FOR SELECT USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_organizations_insert" ON shark_organizations
    FOR INSERT WITH CHECK (user_belongs_to_org(org_id));
CREATE POLICY "shark_organizations_update" ON shark_organizations
    FOR UPDATE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_organizations_delete" ON shark_organizations
    FOR DELETE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_organizations_service" ON shark_organizations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies pour shark_people
DROP POLICY IF EXISTS "shark_people_select" ON shark_people;
DROP POLICY IF EXISTS "shark_people_insert" ON shark_people;
DROP POLICY IF EXISTS "shark_people_update" ON shark_people;
DROP POLICY IF EXISTS "shark_people_delete" ON shark_people;
DROP POLICY IF EXISTS "shark_people_service" ON shark_people;

CREATE POLICY "shark_people_select" ON shark_people
    FOR SELECT USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_people_insert" ON shark_people
    FOR INSERT WITH CHECK (user_belongs_to_org(org_id));
CREATE POLICY "shark_people_update" ON shark_people
    FOR UPDATE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_people_delete" ON shark_people
    FOR DELETE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_people_service" ON shark_people
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies pour shark_news_items
DROP POLICY IF EXISTS "shark_news_select" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_insert" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_update" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_delete" ON shark_news_items;
DROP POLICY IF EXISTS "shark_news_service" ON shark_news_items;

CREATE POLICY "shark_news_select" ON shark_news_items
    FOR SELECT USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_news_insert" ON shark_news_items
    FOR INSERT WITH CHECK (user_belongs_to_org(org_id));
CREATE POLICY "shark_news_update" ON shark_news_items
    FOR UPDATE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_news_delete" ON shark_news_items
    FOR DELETE USING (user_belongs_to_org(org_id));
CREATE POLICY "shark_news_service" ON shark_news_items
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies pour tables de liaison (accès via projet)
DROP POLICY IF EXISTS "shark_po_access" ON shark_project_organizations;
DROP POLICY IF EXISTS "shark_po_service" ON shark_project_organizations;

CREATE POLICY "shark_po_access" ON shark_project_organizations
    FOR ALL USING (
        project_id IN (SELECT id FROM shark_projects WHERE user_belongs_to_org(org_id))
    );
CREATE POLICY "shark_po_service" ON shark_project_organizations
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "shark_op_access" ON shark_organization_people;
DROP POLICY IF EXISTS "shark_op_service" ON shark_organization_people;

CREATE POLICY "shark_op_access" ON shark_organization_people
    FOR ALL USING (
        organization_id IN (SELECT id FROM shark_organizations WHERE user_belongs_to_org(org_id))
    );
CREATE POLICY "shark_op_service" ON shark_organization_people
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "shark_pn_access" ON shark_project_news;
DROP POLICY IF EXISTS "shark_pn_service" ON shark_project_news;

CREATE POLICY "shark_pn_access" ON shark_project_news
    FOR ALL USING (
        project_id IN (SELECT id FROM shark_projects WHERE user_belongs_to_org(org_id))
    );
CREATE POLICY "shark_pn_service" ON shark_project_news
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');


-- ============================================================
-- 11. VUES UTILITAIRES
-- ============================================================

-- Vue pour voir un projet avec toutes ses organisations
CREATE OR REPLACE VIEW shark_project_full AS
SELECT
    p.*,
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'organization_id', o.id,
                'organization_name', o.name,
                'org_type', o.org_type,
                'role_in_project', po.role_in_project,
                'lot_name', po.lot_name
            )
        )
        FROM shark_project_organizations po
        JOIN shark_organizations o ON o.id = po.organization_id
        WHERE po.project_id = p.id),
        '[]'::json
    ) as organizations,
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'news_id', n.id,
                'title', n.title,
                'source_name', n.source_name,
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

COMMENT ON VIEW shark_project_full IS 'Vue enrichie d''un projet avec ses organisations et news associées';


-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
