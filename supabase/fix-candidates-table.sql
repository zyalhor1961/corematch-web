-- Fix candidates table to add missing columns for CV screening

-- Add missing columns to candidates table
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS cv_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS cv_url TEXT,
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS source VARCHAR(100),
ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 0 AND score <= 100),
ADD COLUMN IF NOT EXISTS explanation TEXT,
ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT FALSE;

-- Update the status column to match expected values
ALTER TABLE public.candidates 
ALTER COLUMN status SET DEFAULT 'pending';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_candidates_project_id ON public.candidates(project_id);
CREATE INDEX IF NOT EXISTS idx_candidates_org_id ON public.candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON public.candidates(status);

-- Update RLS policy if needed
DROP POLICY IF EXISTS "Users can manage their organization candidates" ON public.candidates;

CREATE POLICY "Users can manage their organization candidates"
ON public.candidates
FOR ALL
USING (
    candidates.org_id IN (
        SELECT id 
        FROM public.organizations 
        WHERE admin_user_id = auth.uid()
    )
);

-- Verify the columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'candidates' 
AND table_schema = 'public'
ORDER BY ordinal_position;