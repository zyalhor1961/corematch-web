# Database Migrations

## Running the Invoice RLS Policies Migration

To enable the "Valider" button in the Invoice Drawer, you need to run the RLS policies migration:

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `20250124_invoice_rls_policies.sql`
5. Click **Run** to execute

### Option 2: Supabase CLI

```bash
# Make sure you're connected to your project
npx supabase db push

# Or run the specific migration
npx supabase db push --file supabase/migrations/20250124_invoice_rls_policies.sql
```

### Option 3: Direct SQL

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  < supabase/migrations/20250124_invoice_rls_policies.sql
```

## What This Migration Does

- Enables Row Level Security (RLS) on `invoices` and `jobs` tables
- Grants UPDATE permissions to authenticated users on both tables
- Allows the "Valider" button to successfully update invoice status to APPROVED
- Adds SELECT policies for reading data

## Verifying the Migration

After running the migration, you can verify it worked by:

1. Opening an invoice in the drawer
2. Clicking the "Valider" button
3. Checking that the status updates without errors

If you see "Erreur lors de la validation", the RLS policies may not be applied correctly.
