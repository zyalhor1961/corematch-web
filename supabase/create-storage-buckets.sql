-- Create storage buckets for CoreMatch

-- Create CV bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES (
  'cv',
  'cv', 
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create documents bucket for DEB module
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff'
  ],
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for CV bucket
-- Simple policy: allow access if user has admin_user_id in organizations table
CREATE POLICY "Users can upload CVs to their org bucket" ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'cv' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.organizations 
    WHERE admin_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view CVs from their org" ON storage.objects
FOR SELECT 
USING (
  bucket_id = 'cv' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.organizations 
    WHERE admin_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete CVs from their org" ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'cv' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.organizations 
    WHERE admin_user_id = auth.uid()
  )
);

-- Create RLS policies for documents bucket
CREATE POLICY "Users can upload docs to their org bucket" ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.organizations 
    WHERE admin_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view docs from their org" ON storage.objects
FOR SELECT 
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.organizations 
    WHERE admin_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete docs from their org" ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public.organizations 
    WHERE admin_user_id = auth.uid()
  )
);

-- Verify buckets creation
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id IN ('cv', 'documents');