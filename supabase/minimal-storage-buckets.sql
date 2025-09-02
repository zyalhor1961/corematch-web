-- Minimal storage buckets creation - just the buckets, no RLS policies

-- Create CV bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cv',
  'cv', 
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Create documents bucket for DEB module
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
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
  ]
) ON CONFLICT (id) DO NOTHING;

-- Verify buckets creation
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id IN ('cv', 'documents');