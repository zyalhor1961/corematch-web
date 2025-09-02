-- ATTENTION: Ce script supprime toutes les tables et données existantes !
-- Exécutez-le uniquement si vous voulez réinitialiser complètement la base de données

-- Désactiver temporairement les contraintes de clés étrangères
SET session_replication_role = 'replica';

-- Supprimer les politiques RLS existantes
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Startups are viewable by everyone" ON public.startups;
DROP POLICY IF EXISTS "Users can insert their own startup" ON public.startups;
DROP POLICY IF EXISTS "Users can update own startup" ON public.startups;
DROP POLICY IF EXISTS "Users can delete own startup" ON public.startups;
DROP POLICY IF EXISTS "Investors are viewable by everyone" ON public.investors;
DROP POLICY IF EXISTS "Users can insert their own investor profile" ON public.investors;
DROP POLICY IF EXISTS "Users can update own investor profile" ON public.investors;
DROP POLICY IF EXISTS "Users can delete own investor profile" ON public.investors;
DROP POLICY IF EXISTS "Users can view their own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update their own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can view messages in their matches" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own swipes" ON public.swipes;
DROP POLICY IF EXISTS "Users can create their own swipes" ON public.swipes;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own saved profiles" ON public.saved_profiles;
DROP POLICY IF EXISTS "Users can save profiles" ON public.saved_profiles;
DROP POLICY IF EXISTS "Users can delete their own saved profiles" ON public.saved_profiles;

-- Supprimer les triggers
DROP TRIGGER IF EXISTS handle_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS handle_startups_updated_at ON public.startups;
DROP TRIGGER IF EXISTS handle_investors_updated_at ON public.investors;
DROP TRIGGER IF EXISTS handle_matches_updated_at ON public.matches;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.calculate_match_score(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_potential_matches(UUID);
DROP FUNCTION IF EXISTS public.handle_swipe(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_user_matches(UUID);
DROP FUNCTION IF EXISTS public.get_user_analytics(UUID);

-- Supprimer les indexes
DROP INDEX IF EXISTS idx_startups_user_id;
DROP INDEX IF EXISTS idx_startups_is_active;
DROP INDEX IF EXISTS idx_investors_user_id;
DROP INDEX IF EXISTS idx_matches_startup_id;
DROP INDEX IF EXISTS idx_matches_investor_id;
DROP INDEX IF EXISTS idx_matches_status;
DROP INDEX IF EXISTS idx_messages_match_id;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_swipes_user_id;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_is_read;

-- Supprimer les tables (dans l'ordre inverse des dépendances)
DROP TABLE IF EXISTS public.saved_profiles CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.swipes CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.investors CASCADE;
DROP TABLE IF EXISTS public.startups CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Réactiver les contraintes
SET session_replication_role = 'origin';

-- Message de confirmation
DO $$ 
BEGIN 
  RAISE NOTICE 'Toutes les tables et objets ont été supprimés avec succès.';
END $$;