import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getOrgIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get('current_org_id')?.value;
  return orgId || null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    const orgId = await getOrgIdFromSession();

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('erp_suppliers')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: suppliers, error } = await query;

    if (error) {
      console.error('Error fetching suppliers:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get supplier invoice totals
    const supplierIds = suppliers?.map(s => s.id) || [];

    let suppliersWithStats = suppliers || [];

    if (supplierIds.length > 0) {
      const { data: invoiceStats } = await supabase
        .from('erp_supplier_invoices')
        .select('supplier_id, total_ttc, balance_due, status')
        .eq('org_id', orgId)
        .in('supplier_id', supplierIds);

      suppliersWithStats = suppliers!.map(supplier => {
        const supplierInvoices = invoiceStats?.filter(inv => inv.supplier_id === supplier.id) || [];
        return {
          ...supplier,
          total_purchased: supplierInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0),
          total_outstanding: supplierInvoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0),
          invoice_count: supplierInvoices.length,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        suppliers: suppliersWithStats,
        total: suppliersWithStats.length,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/erp/suppliers:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    const orgId = await getOrgIdFromSession();

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name, email, phone, company_name, address, city, postal_code, country, vat_number,
      siren, siret, naf_code, activite, mode_reglement, delai_paiement, iban, bic, banque, notes
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const { data: supplier, error } = await supabase
      .from('erp_suppliers')
      .insert({
        org_id: orgId,
        name,
        email,
        phone,
        company_name,
        address,
        city,
        postal_code,
        country: country || 'FR',
        vat_number,
        siren,
        siret,
        naf_code,
        activite,
        mode_reglement: mode_reglement || 'virement',
        delai_paiement: delai_paiement || 30,
        iban,
        bic,
        banque,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Error in POST /api/erp/suppliers:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
