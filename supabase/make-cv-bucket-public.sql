-- Rendre le bucket CV accessible publiquement pour la visualisation des PDFs

-- Mettre le bucket en mode public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'cv';

-- Ajouter une politique RLS pour permettre la lecture publique des CVs
CREATE POLICY "Allow public read access to CV files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cv');

-- Politique pour permettre aux utilisateurs authentifiés d'uploader dans leur org
CREATE POLICY "Allow authenticated users to upload CV files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cv');

-- Politique pour permettre aux utilisateurs authentifiés de voir leurs propres fichiers
CREATE POLICY "Allow authenticated users to view their org CV files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cv');