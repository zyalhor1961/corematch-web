import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  try {
    const { supplierId } = await params;

    if (!supplierId) {
      return NextResponse.json({ success: false, error: 'Supplier ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: supplier, error } = await supabase
      .from('erp_suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (error) {
      console.error('Error fetching supplier:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Error in GET /api/erp/suppliers/[supplierId]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  try {
    const { supplierId } = await params;
    const body = await request.json();

    if (!supplierId) {
      return NextResponse.json({ success: false, error: 'Supplier ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, get the current supplier to get org_id
    const { data: currentSupplier } = await supabase
      .from('erp_suppliers')
      .select('org_id')
      .eq('id', supplierId)
      .single();

    if (!currentSupplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    // Extract updatable fields
    const {
      code, name, email, phone, company_name, address, city, postal_code, country, vat_number, vat_code,
      siren, siret, naf_code, activite, mode_reglement, iban, bic, banque, notes
    } = body;

    // Validate required code
    if (code !== undefined && !code?.trim()) {
      return NextResponse.json({ success: false, error: 'Le code fournisseur est obligatoire' }, { status: 400 });
    }

    // Check for duplicate code if code is being updated
    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();
      const { data: existingSupplier } = await supabase
        .from('erp_suppliers')
        .select('id')
        .eq('org_id', currentSupplier.org_id)
        .eq('code', normalizedCode)
        .neq('id', supplierId)
        .limit(1);

      if (existingSupplier && existingSupplier.length > 0) {
        return NextResponse.json({ success: false, error: 'Ce code fournisseur existe déjà' }, { status: 400 });
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};

    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (company_name !== undefined) updateData.company_name = company_name;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (country !== undefined) updateData.country = country;
    if (vat_number !== undefined) updateData.vat_number = vat_number;
    if (vat_code !== undefined) updateData.vat_code = vat_code;
    if (siren !== undefined) updateData.siren = siren;
    if (siret !== undefined) updateData.siret = siret;
    if (naf_code !== undefined) updateData.naf_code = naf_code;
    if (activite !== undefined) updateData.activite = activite;
    if (mode_reglement !== undefined) updateData.mode_reglement = mode_reglement;
    if (iban !== undefined) updateData.iban = iban;
    if (bic !== undefined) updateData.bic = bic;
    if (banque !== undefined) updateData.banque = banque;
    if (notes !== undefined) updateData.notes = notes;

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data: supplier, error } = await supabase
      .from('erp_suppliers')
      .update(updateData)
      .eq('id', supplierId)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Error in PUT /api/erp/suppliers/[supplierId]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  try {
    const { supplierId } = await params;

    if (!supplierId) {
      return NextResponse.json({ success: false, error: 'Supplier ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from('erp_suppliers')
      .delete()
      .eq('id', supplierId);

    if (error) {
      console.error('Error deleting supplier:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/erp/suppliers/[supplierId]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
