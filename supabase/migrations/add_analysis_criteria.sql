-- Add analysis_criteria column to projects table
-- This allows each project to have custom analysis criteria

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS analysis_criteria JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the column
COMMENT ON COLUMN projects.analysis_criteria IS 'Custom analysis criteria for CV evaluation. JSON array of criteria objects with id, name, description, and weight (1-5).';

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_projects_analysis_criteria ON projects USING GIN (analysis_criteria);

-- Example criteria structure:
-- [
--   {
--     "id": "experience",
--     "name": "Expérience professionnelle",
--     "description": "Années d'expérience et pertinence par rapport au poste",
--     "weight": 5
--   },
--   {
--     "id": "skills",
--     "name": "Compétences techniques",
--     "description": "Maîtrise des technologies et outils requis",
--     "weight": 5
--   }
-- ]
