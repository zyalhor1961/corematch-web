-- Fix projects table to add missing columns for CV screening

-- Add missing columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS requirements TEXT;

-- Update RLS policy if needed
DROP POLICY IF EXISTS "Users can manage their organization projects" ON public.projects;

CREATE POLICY "Users can manage their organization projects"
ON public.projects
FOR ALL
USING (
    projects.org_id IN (
        SELECT org_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('org_admin', 'org_manager')
    )
    OR 
    projects.created_by = auth.uid()
);

-- Test data (optional - remove if not needed)
INSERT INTO public.projects (org_id, name, job_title, description, requirements, created_by)
SELECT 
    o.id as org_id,
    'Test CV Screening Project' as name,
    'Développeur Full Stack' as job_title,
    'Projet test pour le screening de CV' as description,
    'React, TypeScript, Node.js, 3+ ans d''expérience' as requirements,
    o.admin_user_id as created_by
FROM public.organizations o
WHERE o.org_name = 'Mon Organisation CoreMatch'
AND NOT EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.org_id = o.id 
    AND p.name = 'Test CV Screening Project'
)
LIMIT 1;

-- Verify the fix
SELECT 
    table_name,
    column_name,
    data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND table_schema = 'public'
ORDER BY ordinal_position;