const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    // Create the sum_pages_for_org function
    const { error } = await supabase.rpc('query', {
      query: `
        -- Function to sum total pages processed for an organization
        CREATE OR REPLACE FUNCTION public.sum_pages_for_org(org_id_param UUID)
        RETURNS INTEGER AS $$
        DECLARE
          total_pages INTEGER;
        BEGIN
          -- For now, return 0 as default since we might not have document_pages table
          -- This will be updated when DEB module is fully implemented
          SELECT COALESCE(SUM(deb_pages_count), 0)
          INTO total_pages
          FROM usage_counters
          WHERE org_id = org_id_param;
          
          RETURN COALESCE(total_pages, 0);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Grant execute permission to authenticated users
        GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO anon;
      `
    });

    if (error) {
      console.error('Error creating function:', error);
      return;
    }

    console.log('✅ Function sum_pages_for_org created successfully');

  } catch (err) {
    console.error('Error:', err);
  }
}

applyMigration();