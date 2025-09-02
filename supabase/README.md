# Supabase Database Setup for CoreMatch

This directory contains all SQL scripts needed to set up the CoreMatch database in Supabase.

## Files Overview

1. **schema.sql** - Main database schema with tables, indexes, triggers, and RLS policies
2. **functions.sql** - Custom database functions for business logic
3. **storage-buckets.sql** - Storage bucket configuration for file uploads
4. **seed.sql** - Sample data for development and testing

## Setup Instructions

### 1. Create a New Supabase Project
- Go to [Supabase Dashboard](https://app.supabase.com)
- Create a new project
- Save your project URL and anon key

### 2. Run SQL Scripts

Execute the scripts in this order in the Supabase SQL Editor:

1. First, run `schema.sql` to create all tables and basic structure
2. Then run `functions.sql` to add custom functions
3. Run `storage-buckets.sql` to set up file storage
4. Optionally run `seed.sql` for test data (update user IDs first)

### 3. Enable Authentication

In Supabase Dashboard:
1. Go to Authentication → Providers
2. Enable Email authentication
3. Configure email templates if needed

### 4. Update Environment Variables

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Structure

### Main Tables

- **profiles** - User profiles (extends auth.users)
- **startups** - Startup company profiles
- **investors** - Investor profiles
- **matches** - Connections between startups and investors
- **messages** - Chat messages between matched parties
- **swipes** - Track all swipe actions (like/pass)
- **notifications** - User notifications
- **saved_profiles** - Bookmarked profiles

### Key Features

- **Row Level Security (RLS)** - All tables have RLS enabled for data protection
- **Real-time** - Tables are ready for real-time subscriptions
- **Storage Buckets** - Configured for avatars, logos, pitch decks, and videos
- **Automatic Timestamps** - Updated_at triggers on all relevant tables
- **Match Scoring** - Algorithm to calculate compatibility scores

### Custom Functions

- `get_potential_matches()` - Get profiles to swipe on
- `handle_swipe()` - Process swipe actions and create matches
- `get_user_matches()` - Retrieve user's matches with details
- `get_user_analytics()` - Get user statistics and metrics
- `calculate_match_score()` - Calculate compatibility between startup and investor

## Storage Buckets

- **avatars** - User profile pictures (public, 5MB limit)
- **logos** - Company logos (public, 5MB limit)
- **pitch-decks** - Private documents (50MB limit, restricted access)
- **videos** - Pitch videos (public, 100MB limit)

## Security

- All tables use Row Level Security (RLS)
- Users can only modify their own data
- Pitch decks are only accessible to matched parties
- Storage policies ensure users can only upload to their own folders

## Testing

After setup, you can:
1. Create test users through Supabase Auth
2. Use the seed.sql file (update user IDs)
3. Test the application with real data

## Maintenance

- Monitor database performance in Supabase Dashboard
- Set up database backups
- Review and optimize queries as needed
- Update RLS policies if requirements change