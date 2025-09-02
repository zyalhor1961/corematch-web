-- Simple fix for projects table - just add missing columns

-- Add missing columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS requirements TEXT;

-- Verify the columns were added
SELECT 
    table_name,
    column_name,
    data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND table_schema = 'public'
AND column_name IN ('job_title', 'requirements')
ORDER BY ordinal_position;