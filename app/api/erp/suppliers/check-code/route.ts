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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, siret, exclude_id, org_id: bodyOrgId } = body;

    // Accept org_id from body or fall back to session cookie
    const orgId = bodyOrgId || await getOrgIdFromSession();

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const matches: Array<{ type: string; supplier: any }> = [];

    // 1. Check by CODE (exact match, case-insensitive)
    if (code?.trim()) {
      const normalizedCode = code.trim().toUpperCase();
      let query = supabase
        .from('erp_suppliers')
        .select('id, name, code, siret')
        .eq('org_id', orgId)
        .eq('code', normalizedCode);

      if (exclude_id) {
        query = query.neq('id', exclude_id);
      }

      const { data } = await query.limit(1);
      if (data && data.length > 0) {
        matches.push({ type: 'code', supplier: data[0] });
      }
    }

    // 2. Check by SIRET (exact match - French establishment identifier)
    if (siret?.trim() && siret.trim().length >= 14) {
      const normalizedSiret = siret.trim().replace(/\s/g, '');
      let query = supabase
        .from('erp_suppliers')
        .select('id, name, code, siret')
        .eq('org_id', orgId)
        .eq('siret', normalizedSiret);

      if (exclude_id) {
        query = query.neq('id', exclude_id);
      }

      const { data } = await query.limit(1);
      if (data && data.length > 0) {
        // Don't add duplicate
        if (!matches.find(m => m.supplier.id === data[0].id)) {
          matches.push({ type: 'siret', supplier: data[0] });
        }
      }
    }

    // 3. Check by NAME (case-insensitive, for non-French vendors)
    if (name?.trim() && name.trim().length >= 3) {
      const normalizedName = name.trim().toLowerCase();
      let query = supabase
        .from('erp_suppliers')
        .select('id, name, code, siret')
        .eq('org_id', orgId)
        .ilike('name', normalizedName);

      if (exclude_id) {
        query = query.neq('id', exclude_id);
      }

      const { data } = await query.limit(1);
      if (data && data.length > 0) {
        // Don't add duplicate
        if (!matches.find(m => m.supplier.id === data[0].id)) {
          matches.push({ type: 'name', supplier: data[0] });
        }
      }
    }

    // Determine the primary match (priority: siret > code > name)
    const priorityOrder = ['siret', 'code', 'name'];
    matches.sort((a, b) => priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type));

    const exists = matches.length > 0;
    const primaryMatch = matches[0] || null;

    return NextResponse.json({
      exists,
      match_type: primaryMatch?.type || null,
      supplier: primaryMatch?.supplier || null,
      all_matches: matches
    });
  } catch (error) {
    console.error('Error in POST /api/erp/suppliers/check-code:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
