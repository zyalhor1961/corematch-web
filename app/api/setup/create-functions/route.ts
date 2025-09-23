import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function GET() {
  try {
    // Create the sum_pages_for_org function using raw SQL
    const { data, error } = await supabase.rpc('query', {
      sql: `
        CREATE OR REPLACE FUNCTION public.sum_pages_for_org(org_id_param UUID)
        RETURNS INTEGER AS $$
        BEGIN
          RETURN COALESCE(
            (SELECT SUM(deb_pages_count) 
             FROM usage_counters 
             WHERE org_id = org_id_param),
            0
          );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO anon;
        GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO service_role;
      `
    });

    if (error) {
      console.error('Error creating function:', error);
      return NextResponse.json({ 
        error: 'Failed to create function',
        details: error.message,
        hint: 'Please create the function manually in Supabase SQL editor'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Function sum_pages_for_org created successfully'
    });
  } catch (err: any) {
    console.error('Error:', err);
    
    // Return the SQL so it can be run manually
    const sql = `
-- Run this in your Supabase SQL editor:
CREATE OR REPLACE FUNCTION public.sum_pages_for_org(org_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(deb_pages_count) 
     FROM usage_counters 
     WHERE org_id = org_id_param),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO service_role;
    `.trim();
    
    return NextResponse.json({ 
      error: 'Could not create function automatically',
      sql: sql,
      hint: 'Please copy the SQL above and run it in your Supabase SQL editor'
    }, { status: 500 });
  }
}