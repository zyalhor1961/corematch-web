-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for startups
CREATE POLICY "Startups are viewable by everyone"
  ON public.startups FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own startup"
  ON public.startups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own startup"
  ON public.startups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own startup"
  ON public.startups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for investors
CREATE POLICY "Investors are viewable by everyone"
  ON public.investors FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own investor profile"
  ON public.investors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investor profile"
  ON public.investors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investor profile"
  ON public.investors FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for matches
CREATE POLICY "Users can view their own matches"
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

CREATE POLICY "Users can create matches"
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

CREATE POLICY "Users can update their own matches"
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

-- RLS Policies for messages (version corrigée)
CREATE POLICY "Users can view messages in their matches"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.matches m
      LEFT JOIN public.startups s ON s.id = m.startup_id
      LEFT JOIN public.investors i ON i.id = m.investor_id
      WHERE m.id = public.messages.match_id
      AND (s.user_id = auth.uid() OR i.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = public.messages.sender_id
    AND EXISTS (
      SELECT 1 
      FROM public.matches m
      LEFT JOIN public.startups s ON s.id = m.startup_id
      LEFT JOIN public.investors i ON i.id = m.investor_id
      WHERE m.id = public.messages.match_id
      AND m.status = 'accepted'
      AND (s.user_id = auth.uid() OR i.user_id = auth.uid())
    )
  );

-- RLS Policies for swipes
CREATE POLICY "Users can view their own swipes"
  ON public.swipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own swipes"
  ON public.swipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for saved_profiles
CREATE POLICY "Users can view their own saved profiles"
  ON public.saved_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save profiles"
  ON public.saved_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved profiles"
  ON public.saved_profiles FOR DELETE
  USING (auth.uid() = user_id);