-- Migration pour le système d'analyse déterministe
-- Ajoute les colonnes nécessaires pour stocker la configuration JOB_SPEC et les résultats d'évaluation

-- 1. Ajouter job_spec_config à la table projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS job_spec_config JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.job_spec_config IS 'Configuration JobSpec pour l''analyse déterministe: must_have, skills_required, relevance_rules, weights, thresholds';

-- Créer un index GIN pour les requêtes JSON
CREATE INDEX IF NOT EXISTS idx_projects_job_spec_config ON projects USING GIN (job_spec_config);

-- 2. Ajouter evaluation_result à la table candidates
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS evaluation_result JSONB DEFAULT NULL;

COMMENT ON COLUMN candidates.evaluation_result IS 'Résultat complet de l''évaluation déterministe au format EvaluationResult (meets_all_must_have, fails, relevance_summary, subscores, etc.)';

-- Créer un index GIN pour les requêtes JSON
CREATE INDEX IF NOT EXISTS idx_candidates_evaluation_result ON candidates USING GIN (evaluation_result);

-- 3. Ajouter des colonnes supplémentaires pour faciliter les requêtes
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS relevance_months_direct INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS relevance_months_adjacent INTEGER DEFAULT 0;

COMMENT ON COLUMN candidates.relevance_months_direct IS 'Nombre de mois d''expérience directe (calculé par l''analyse déterministe)';
COMMENT ON COLUMN candidates.relevance_months_adjacent IS 'Nombre de mois d''expérience adjacente (calculé par l''analyse déterministe)';

-- Créer des index pour les requêtes de tri/filtrage
CREATE INDEX IF NOT EXISTS idx_candidates_relevance_direct ON candidates (relevance_months_direct DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_relevance_adjacent ON candidates (relevance_months_adjacent DESC);

-- 4. Exemple de structure job_spec_config
-- {
--   "title": "Enseignant FLE",
--   "must_have": [
--     {"id":"M1","desc":"Diplôme M2 FLE ou équivalent","severity":"critical"},
--     {"id":"M2","desc":"Au moins 24 mois d'enseignement FLE","severity":"critical"}
--   ],
--   "skills_required": ["conception de cours","évaluation","gestion de classe"],
--   "nice_to_have": ["arabe","médiation sociale"],
--   "relevance_rules": {
--     "direct": ["enseignant FLE","formateur FLE","professeur de français"],
--     "adjacent": ["interprète","traducteur","médiateur social"],
--     "peripheral": ["secteur éducatif sans enseignement"]
--   },
--   "skills_map": {
--     "conception de cours": ["ingénierie pédagogique","préparer des séquences"]
--   },
--   "weights": {"w_exp":0.5,"w_skills":0.3,"w_nice":0.2,"p_adjacent":0.5},
--   "thresholds": {"years_full_score":3,"shortlist_min":75,"consider_min":60},
--   "analysis_date": "2025-10-22"
-- }

-- 5. Exemple de structure evaluation_result
-- {
--   "meets_all_must_have": true,
--   "fails": [],
--   "relevance_summary": {
--     "months_direct": 36,
--     "months_adjacent": 12,
--     "months_peripheral": 0,
--     "months_non_pertinent": 0,
--     "by_experience": [...]
--   },
--   "subscores": {
--     "experience_years_relevant": 3.5,
--     "skills_match_0_to_100": 85,
--     "nice_to_have_0_to_100": 60
--   },
--   "overall_score_0_to_100": 82,
--   "recommendation": "SHORTLIST",
--   "strengths": [...],
--   "improvements": [...],
--   "evidence_global": [...]
-- }
