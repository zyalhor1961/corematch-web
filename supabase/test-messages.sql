-- Script de test pour identifier l'erreur avec la table messages

-- Étape 1: Vérifier si les tables existent
SELECT 'Checking existing tables...' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'startups', 'investors', 'matches', 'messages');

-- Étape 2: Essayer de créer uniquement la table messages si elle n'existe pas
-- D'abord, s'assurer que les tables dépendantes existent

-- Créer une table profiles minimale si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer une table startups minimale si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL
);

-- Créer une table investors minimale si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  firm_name TEXT
);

-- Créer une table matches minimale si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES public.startups(id),
  investor_id UUID REFERENCES public.investors(id),
  status TEXT DEFAULT 'pending'
);

-- Maintenant essayer de créer la table messages
SELECT 'Creating messages table...' as status;
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vérifier que la table a été créée
SELECT 'Checking messages table columns...' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'messages';

-- Tester une requête simple
SELECT 'Testing simple query...' as status;
SELECT * FROM public.messages LIMIT 1;