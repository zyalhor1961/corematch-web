# Setup Order for Supabase Database

## Important: Execute the scripts in this exact order

### Step 1: Create Tables and Basic Functions
Execute `01-tables.sql` first. This creates:
- All tables
- Indexes
- Basic triggers
- Core functions

### Step 2: Enable Row Level Security
Execute `02-rls.sql` second. This:
- Enables RLS on all tables
- Creates all security policies

### Step 3: Add Business Logic Functions
Execute `functions.sql` third. This adds:
- get_potential_matches()
- handle_swipe()
- get_user_matches()
- get_user_analytics()

### Step 4: Setup Storage (Optional)
Execute `storage-buckets.sql` if you need file storage for:
- Avatars
- Logos
- Pitch decks
- Videos

### Step 5: Add Test Data (Optional)
Execute `seed.sql` for development testing.

## Troubleshooting

If you get "column does not exist" errors:
1. Make sure you execute scripts in the correct order
2. Verify all tables were created successfully before adding RLS
3. Check that you're in the correct schema (public)

## Testing the Setup

After running all scripts, test with:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Test a simple query
SELECT * FROM public.profiles LIMIT 1;
```