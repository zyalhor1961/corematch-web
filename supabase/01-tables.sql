-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  role TEXT CHECK (role IN ('startup', 'investor', 'admin')),
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create startups table
CREATE TABLE IF NOT EXISTS public.startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pitch TEXT,
  industry TEXT,
  stage TEXT CHECK (stage IN ('idea', 'mvp', 'seed', 'series-a', 'series-b', 'growth')),
  founded_date DATE,
  team_size INTEGER,
  funding_status TEXT,
  funding_amount DECIMAL(15, 2),
  revenue_range TEXT,
  logo_url TEXT,
  website TEXT,
  pitch_deck_url TEXT,
  video_url TEXT,
  metrics JSONB,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create investors table
CREATE TABLE IF NOT EXISTS public.investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  firm_name TEXT,
  investment_focus TEXT[],
  investment_stage TEXT[],
  ticket_size_min DECIMAL(15, 2),
  ticket_size_max DECIMAL(15, 2),
  portfolio_companies TEXT[],
  investment_thesis TEXT,
  sectors TEXT[],
  geographic_focus TEXT[],
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
  match_score DECIMAL(5, 2),
  startup_interested BOOLEAN DEFAULT false,
  investor_interested BOOLEAN DEFAULT false,
  startup_swiped_at TIMESTAMP WITH TIME ZONE,
  investor_swiped_at TIMESTAMP WITH TIME ZONE,
  matched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(startup_id, investor_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create swipes table (for tracking all swipe actions)
CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT CHECK (target_type IN ('startup', 'investor')),
  action TEXT CHECK (action IN ('like', 'pass')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, target_id, target_type)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create saved_profiles table
CREATE TABLE IF NOT EXISTS public.saved_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  saved_id UUID NOT NULL,
  saved_type TEXT CHECK (saved_type IN ('startup', 'investor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, saved_id, saved_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_startups_user_id ON public.startups(user_id);
CREATE INDEX IF NOT EXISTS idx_startups_is_active ON public.startups(is_active);
CREATE INDEX IF NOT EXISTS idx_investors_user_id ON public.investors(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_startup_id ON public.matches(startup_id);
CREATE INDEX IF NOT EXISTS idx_matches_investor_id ON public.matches(investor_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_swipes_user_id ON public.swipes(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_startups_updated_at
  BEFORE UPDATE ON public.startups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to create a profile after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to calculate match score
CREATE OR REPLACE FUNCTION public.calculate_match_score(
  startup_id UUID,
  investor_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  score DECIMAL := 50.00; -- Base score
  startup_record RECORD;
  investor_record RECORD;
BEGIN
  -- Get startup and investor records
  SELECT * INTO startup_record FROM public.startups WHERE id = startup_id;
  SELECT * INTO investor_record FROM public.investors WHERE id = investor_id;
  
  -- Check industry match
  IF startup_record.industry = ANY(investor_record.sectors) THEN
    score := score + 20;
  END IF;
  
  -- Check stage match
  IF startup_record.stage = ANY(investor_record.investment_stage) THEN
    score := score + 20;
  END IF;
  
  -- Check funding amount range
  IF startup_record.funding_amount BETWEEN investor_record.ticket_size_min AND investor_record.ticket_size_max THEN
    score := score + 10;
  END IF;
  
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;