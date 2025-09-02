-- Seed data for testing (optional)
-- This file contains sample data for development and testing

-- Create test users (you'll need to create these through Supabase Auth first)
-- Then you can reference their IDs here

-- Sample startup data
INSERT INTO public.startups (user_id, name, description, pitch, industry, stage, founded_date, team_size, funding_status, funding_amount, tags)
VALUES 
  (
    'REPLACE_WITH_USER_ID',
    'TechVenture AI',
    'AI-powered analytics platform for e-commerce',
    'We help e-commerce businesses increase conversion rates by 40% using predictive AI',
    'Technology',
    'seed',
    '2023-01-15',
    8,
    'Raising',
    500000,
    ARRAY['AI', 'E-commerce', 'Analytics', 'SaaS']
  ),
  (
    'REPLACE_WITH_USER_ID',
    'GreenEnergy Solutions',
    'Sustainable energy management for smart cities',
    'Making cities 30% more energy efficient with IoT and renewable integration',
    'CleanTech',
    'series-a',
    '2022-06-01',
    15,
    'Raised',
    2000000,
    ARRAY['CleanTech', 'IoT', 'Smart Cities', 'Sustainability']
  );

-- Sample investor data
INSERT INTO public.investors (user_id, firm_name, investment_focus, investment_stage, ticket_size_min, ticket_size_max, sectors, geographic_focus)
VALUES
  (
    'REPLACE_WITH_USER_ID',
    'Innovation Capital Partners',
    ARRAY['B2B SaaS', 'AI/ML', 'Enterprise Software'],
    ARRAY['seed', 'series-a'],
    250000,
    5000000,
    ARRAY['Technology', 'Software', 'AI'],
    ARRAY['North America', 'Europe']
  ),
  (
    'REPLACE_WITH_USER_ID',
    'Green Future Ventures',
    ARRAY['CleanTech', 'Sustainability', 'Renewable Energy'],
    ARRAY['seed', 'series-a', 'series-b'],
    500000,
    10000000,
    ARRAY['CleanTech', 'Energy', 'Environment'],
    ARRAY['Global']
  );

-- Note: Replace 'REPLACE_WITH_USER_ID' with actual user IDs from your auth.users table