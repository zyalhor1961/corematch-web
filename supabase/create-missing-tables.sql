-- Créer toutes les tables manquantes que l'application recherche

-- 1. Créer la table documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Créer la table projects
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Créer la table candidates
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id),
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Créer la table usage_counters pour les analytics
CREATE TABLE IF NOT EXISTS public.usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    period_month TEXT NOT NULL, -- Format: "2025-09"
    counter_type TEXT NOT NULL,
    counter_value INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(org_id, period_month, counter_type)
);

-- 5. Ajouter les colonnes manquantes à organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 6. Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_org_id ON public.candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_project_id ON public.candidates(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_counters_org_id ON public.usage_counters(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_counters_period ON public.usage_counters(period_month);

-- 7. Activer RLS sur les nouvelles tables
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- 8. Créer des politiques RLS simples
CREATE POLICY "Users can access documents from their org"
    ON public.documents FOR ALL
    USING (org_id IN (SELECT id FROM public.organizations WHERE admin_user_id = auth.uid()));

CREATE POLICY "Users can access projects from their org"
    ON public.projects FOR ALL
    USING (org_id IN (SELECT id FROM public.organizations WHERE admin_user_id = auth.uid()));

CREATE POLICY "Users can access candidates from their org"
    ON public.candidates FOR ALL
    USING (org_id IN (SELECT id FROM public.organizations WHERE admin_user_id = auth.uid()));

CREATE POLICY "Users can access usage counters from their org"
    ON public.usage_counters FOR ALL
    USING (org_id IN (SELECT id FROM public.organizations WHERE admin_user_id = auth.uid()));

-- 9. Insérer des données de test avec l'ID de votre organisation
DO $$
DECLARE
    user_org_id UUID;
    current_month TEXT;
BEGIN
    -- Récupérer l'ID de l'organisation de l'utilisateur
    SELECT id INTO user_org_id 
    FROM public.organizations 
    WHERE name = 'Mon Organisation CoreMatch' 
    LIMIT 1;
    
    IF user_org_id IS NOT NULL THEN
        current_month := TO_CHAR(NOW(), 'YYYY-MM');
        
        -- Insérer des données de test
        INSERT INTO public.projects (org_id, name, description, created_by)
        VALUES 
            (user_org_id, 'Projet de Test', 'Premier projet pour tester l''application', auth.uid()),
            (user_org_id, 'Recrutement 2025', 'Campagne de recrutement pour 2025', auth.uid())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO public.documents (org_id, name, description, uploaded_by)
        VALUES 
            (user_org_id, 'Document de Test', 'Premier document pour tester', auth.uid()),
            (user_org_id, 'Présentation CoreMatch', 'Présentation de la plateforme', auth.uid())
        ON CONFLICT DO NOTHING;
        
        INSERT INTO public.usage_counters (org_id, period_month, counter_type, counter_value)
        VALUES 
            (user_org_id, current_month, 'documents_created', 2),
            (user_org_id, current_month, 'projects_created', 2),
            (user_org_id, current_month, 'candidates_added', 0)
        ON CONFLICT (org_id, period_month, counter_type) DO NOTHING;
        
        RAISE NOTICE 'Données de test créées pour organisation: %', user_org_id;
    ELSE
        RAISE NOTICE 'Aucune organisation trouvée pour créer les données de test';
    END IF;
END $$;

-- 10. Mettre à jour la vue my_orgs pour inclure l'ID correctement
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT 
    o.id,
    o.name as org_name,
    o.slug,
    o.description,
    o.website,
    o.logo_url,
    o.plan,
    o.status,
    o.admin_user_id,
    o.created_at,
    o.updated_at
FROM public.organizations o
WHERE o.admin_user_id = auth.uid();

-- 11. Test final - vérifier que tout est créé
SELECT 'TABLES CRÉÉES:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('documents', 'projects', 'candidates', 'usage_counters')
ORDER BY table_name;

SELECT 'ORGANISATION AVEC DONNÉES:' as org_data;
SELECT 
    o.id as org_id,
    o.name,
    (SELECT COUNT(*) FROM public.projects WHERE org_id = o.id) as projects_count,
    (SELECT COUNT(*) FROM public.documents WHERE org_id = o.id) as documents_count,
    (SELECT COUNT(*) FROM public.candidates WHERE org_id = o.id) as candidates_count
FROM public.organizations o
WHERE o.name = 'Mon Organisation CoreMatch';

-- 12. Afficher l'ID de l'organisation pour le frontend
SELECT 'ID POUR VOTRE APPLICATION:' as app_id;
SELECT id as organization_id, name as organization_name
FROM public.organizations 
WHERE name = 'Mon Organisation CoreMatch';