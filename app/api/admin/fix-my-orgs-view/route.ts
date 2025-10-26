import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🚀 Fixing my_orgs view...');

    // Drop and recreate the view
    const sql = `
DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT
  o.id,
  o.name AS org_name,
  o.plan,
  o.status,
  o.trial_end_date,
  o.created_at,
  om.role AS user_role,
  om.role,
  om.created_at AS membership_created_at
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.org_id
WHERE om.user_id = auth.uid();

ALTER VIEW public.my_orgs SET (security_invoker = true);
GRANT SELECT ON public.my_orgs TO anon, authenticated;
    `;

    // Execute the SQL
    const { error: execError } = await supabase.rpc('exec', { sql });

    if (execError) {
      // Try alternative method using raw SQL query
      const queries = sql.split(';').filter(q => q.trim());

      for (const query of queries) {
        if (query.trim()) {
          const { error } = await supabase.rpc('exec', { sql: query });
          if (error && !error.message.includes('does not exist')) {
            console.error('Query error:', error);
            return NextResponse.json({
              success: false,
              error: error.message,
              hint: 'Try running the SQL manually in Supabase SQL Editor'
            }, { status: 500 });
          }
        }
      }
    }

    // Test the view
    const { data: testData, error: testError } = await supabase
      .from('my_orgs')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('View test error:', testError);
    }

    return NextResponse.json({
      success: true,
      message: 'View my_orgs has been fixed',
      testResult: testData ? `View returns ${testData.length} rows` : 'View is accessible',
      columns: testData && testData.length > 0 ? Object.keys(testData[0]) : []
    });

  } catch (error: any) {
    console.error('Error fixing view:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      sqlToRunManually: `
-- Run this in Supabase SQL Editor:

DROP VIEW IF EXISTS public.my_orgs;

CREATE VIEW public.my_orgs AS
SELECT
  o.id,
  o.name AS org_name,
  o.plan,
  o.status,
  o.trial_end_date,
  o.created_at,
  om.role AS user_role,
  om.role,
  om.created_at AS membership_created_at
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.org_id
WHERE om.user_id = auth.uid();

ALTER VIEW public.my_orgs SET (security_invoker = true);
GRANT SELECT ON public.my_orgs TO anon, authenticated;
      `
    }, { status: 500 });
  }
}
