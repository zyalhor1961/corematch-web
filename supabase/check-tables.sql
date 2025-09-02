-- Script pour vérifier quelles tables existent

-- 1. Lister toutes les tables publiques existantes
SELECT 'Tables existantes:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Vérifier spécifiquement les tables CoreMatch
SELECT 'Vérification des tables CoreMatch:' as info;
SELECT 
    required.table_name,
    CASE 
        WHEN t.table_name IS NOT NULL
        THEN '✓ Existe'
        ELSE '✗ Manquante'
    END as status
FROM (
    VALUES 
        ('profiles'),
        ('startups'),
        ('investors'),
        ('matches'),
        ('messages'),
        ('swipes'),
        ('notifications'),
        ('saved_profiles')
) AS required(table_name)
LEFT JOIN information_schema.tables t 
    ON t.table_name = required.table_name 
    AND t.table_schema = 'public';

-- 3. Si des tables manquent, les créer individuellement
-- Créer la table swipes si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'swipes'
    ) THEN
        CREATE TABLE public.swipes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            target_id UUID NOT NULL,
            target_type TEXT CHECK (target_type IN ('startup', 'investor')),
            action TEXT CHECK (action IN ('like', 'pass')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            UNIQUE(user_id, target_id, target_type)
        );
        RAISE NOTICE 'Table swipes créée avec succès';
    ELSE
        RAISE NOTICE 'Table swipes existe déjà';
    END IF;
END $$;

-- Créer la table notifications si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'notifications'
    ) THEN
        CREATE TABLE public.notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT,
            data JSONB,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
        RAISE NOTICE 'Table notifications créée avec succès';
    ELSE
        RAISE NOTICE 'Table notifications existe déjà';
    END IF;
END $$;

-- Créer la table saved_profiles si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'saved_profiles'
    ) THEN
        CREATE TABLE public.saved_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            saved_id UUID NOT NULL,
            saved_type TEXT CHECK (saved_type IN ('startup', 'investor')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            UNIQUE(user_id, saved_id, saved_type)
        );
        RAISE NOTICE 'Table saved_profiles créée avec succès';
    ELSE
        RAISE NOTICE 'Table saved_profiles existe déjà';
    END IF;
END $$;

-- 4. Vérifier à nouveau après création
SELECT 'État final des tables:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'startups', 'investors', 'matches', 'messages', 'swipes', 'notifications', 'saved_profiles')
ORDER BY table_name;