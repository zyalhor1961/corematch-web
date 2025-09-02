-- Nettoyer toutes les politiques RLS existantes avant de les recréer
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Supprimer toutes les politiques existantes sur nos tables
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'startups', 'investors', 'matches', 'messages', 'swipes', 'notifications', 'saved_profiles')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Enable Row Level Security (RLS) sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for startups
CREATE POLICY "startups_select_policy"
  ON public.startups FOR SELECT
  USING (true);

CREATE POLICY "startups_insert_policy"
  ON public.startups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "startups_update_policy"
  ON public.startups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "startups_delete_policy"
  ON public.startups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for investors
CREATE POLICY "investors_select_policy"
  ON public.investors FOR SELECT
  USING (true);

CREATE POLICY "investors_insert_policy"
  ON public.investors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "investors_update_policy"
  ON public.investors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "investors_delete_policy"
  ON public.investors FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for matches
CREATE POLICY "matches_select_policy"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.startups
      WHERE startups.id = matches.startup_id
      AND startups.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.investors
      WHERE investors.id = matches.investor_id
      AND investors.user_id = auth.uid()
    )
  );

CREATE POLICY "matches_insert_policy"
  ON public.matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.startups
      WHERE startups.id = startup_id
      AND startups.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.investors
      WHERE investors.id = investor_id
      AND investors.user_id = auth.uid()
    )
  );

CREATE POLICY "matches_update_policy"
  ON public.matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.startups
      WHERE startups.id = matches.startup_id
      AND startups.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.investors
      WHERE investors.id = matches.investor_id
      AND investors.user_id = auth.uid()
    )
  );

-- RLS Policies for messages - Version très simplifiée pour éviter les erreurs
-- Politique pour SELECT - permet de voir les messages où l'utilisateur est impliqué
CREATE POLICY "messages_select_policy"
  ON public.messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR
    sender_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- Politique pour INSERT - permet d'envoyer des messages seulement si on est le sender
CREATE POLICY "messages_insert_policy"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

-- RLS Policies for swipes
CREATE POLICY "swipes_select_policy"
  ON public.swipes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "swipes_insert_policy"
  ON public.swipes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "notifications_select_policy"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_policy"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for saved_profiles
CREATE POLICY "saved_profiles_select_policy"
  ON public.saved_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "saved_profiles_insert_policy"
  ON public.saved_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_profiles_delete_policy"
  ON public.saved_profiles FOR DELETE
  USING (user_id = auth.uid());

-- Vérifier que les politiques ont été créées
SELECT 'Politiques créées:' as info;
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;