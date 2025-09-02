-- Vérifier la structure exacte de la table messages
SELECT '=== Structure de la table messages ===' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'messages'
ORDER BY ordinal_position;

-- Vérifier si la table messages existe vraiment
SELECT '=== Vérification existence table ===' as info;
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
AND table_name = 'messages';

-- Si la table existe mais n'a pas les bonnes colonnes, la recréer
DO $$
BEGIN
    -- Vérifier si les colonnes nécessaires existent
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
        AND column_name = 'match_id'
    ) THEN
        -- Supprimer l'ancienne table messages si elle existe
        DROP TABLE IF EXISTS public.messages CASCADE;
        
        -- Recréer la table messages avec la bonne structure
        CREATE TABLE public.messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
        
        -- Créer l'index
        CREATE INDEX idx_messages_match_id ON public.messages(match_id);
        CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
        
        RAISE NOTICE 'Table messages recréée avec la bonne structure';
    ELSE
        RAISE NOTICE 'Table messages existe déjà avec les bonnes colonnes';
    END IF;
END $$;

-- Vérifier la structure après correction
SELECT '=== Structure finale de messages ===' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'messages'
ORDER BY ordinal_position;