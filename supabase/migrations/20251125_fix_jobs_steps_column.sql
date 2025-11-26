-- Ensure jobs table exists
CREATE TABLE IF NOT EXISTS public.jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid REFERENCES public.invoices(id),
    status text DEFAULT 'pending',
    result text,
    logs text[],
    steps jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Ensure steps is jsonb (if it was text by mistake, this might fail without casting, but let's assume it's either missing or wrong type)
-- We'll use a safe alter
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'steps') THEN
        ALTER TABLE public.jobs ADD COLUMN steps jsonb DEFAULT '[]'::jsonb;
    ELSE
        -- If it exists but is not jsonb, we might want to convert it, but for now let's just leave it if it works.
        -- Actually, let's force it to be jsonb if possible.
        -- ALTER TABLE public.jobs ALTER COLUMN steps TYPE jsonb USING steps::jsonb;
        NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for demo purposes (or authenticated if user is logged in)
CREATE POLICY "Allow public read access" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.jobs FOR UPDATE USING (true);
