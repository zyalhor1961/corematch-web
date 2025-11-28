import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getOrgIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get('current_org_id')?.value;
  return orgId || null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const bodyOrgId = searchParams.get('org_id');

    console.log('[Supplier Search] Query:', query, 'OrgId from param:', bodyOrgId);

    if (!query?.trim() || query.trim().length < 2) {
      return NextResponse.json({ suppliers: [] });
    }

    // Accept org_id from query or fall back to session cookie
    const sessionOrgId = await getOrgIdFromSession();
    const orgId = bodyOrgId || sessionOrgId;

    console.log('[Supplier Search] Session OrgId:', sessionOrgId, 'Final OrgId:', orgId);

    if (!orgId) {
      console.error('[Supplier Search] No org_id found');
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const searchTerm = query.trim();

    // Search by code, name, or SIRET (siren column doesn't exist)
    const { data, error } = await supabase
      .from('erp_suppliers')
      .select('id, code, name, siret, company_name, city, vat_number')
      .eq('org_id', orgId)
      .or(`code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,siret.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,vat_number.ilike.%${searchTerm}%`)
      .order('name', { ascending: true })
      .limit(10);

    console.log('[Supplier Search] Results:', data?.length || 0, 'Error:', error?.message || 'none');

    if (error) {
      console.error('Error searching suppliers:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ suppliers: data || [] });
  } catch (error) {
    console.error('Error in GET /api/erp/suppliers/search:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
