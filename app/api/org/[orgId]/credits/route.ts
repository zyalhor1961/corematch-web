import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/org/[orgId]/credits
 *
 * Fetch organization credits using service role (bypasses RLS)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try by ID first
    let { data, error } = await supabase
      .from('organizations')
      .select('id, credits_balance')
      .eq('id', orgId)
      .single();

    // If not found by ID, try by slug
    if (error || !data) {
      const slugResult = await supabase
        .from('organizations')
        .select('id, credits_balance')
        .eq('slug', orgId)
        .single();

      data = slugResult.data;
      error = slugResult.error;
    }

    if (error) {
      console.error('[Credits API] Error:', error);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      credits_balance: data?.credits_balance ?? 0,
      org_id: data?.id
    });

  } catch (error) {
    console.error('[Credits API] Error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
