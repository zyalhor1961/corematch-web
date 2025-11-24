-- Migration: Create Supabase Storage bucket for invoices
-- Date: 2025-01-24
-- Description: Sets up storage bucket and policies for PDF/image uploads

-- 1. Créer le bucket de stockage "invoices"
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- 3. Autoriser l'upload pour tout le monde (pour la démo)
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'invoices');

-- 4. Autoriser la lecture pour voir les PDF
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'invoices');
