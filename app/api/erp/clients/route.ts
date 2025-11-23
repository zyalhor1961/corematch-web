import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { Client, ClientInput } from '@/lib/erp/types';

/**
 * GET /api/erp/clients
 * List all clients for the organization
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    // Get user's org
    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseAdmin
      .from('erp_clients')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: clients, error, count } = await query;

    if (error) {
      console.error('[ERP Clients] Error:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        clients: clients || [],
        total: count || 0,
        limit,
        offset,
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/clients [GET]');
  }
}

/**
 * POST /api/erp/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    // Get user's org
    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;

    // Parse body
    const body: ClientInput = await request.json();

    if (!body.name) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Client name is required', 'name');
    }

    // Create client
    const { data: client, error } = await supabaseAdmin
      .from('erp_clients')
      .insert({
        org_id: orgId,
        created_by: user!.id,
        name: body.name,
        email: body.email,
        phone: body.phone,
        company_name: body.company_name,
        vat_number: body.vat_number,
        siren: body.siren,
        siret: body.siret,
        naf_code: body.naf_code,
        activite: body.activite,
        ein: body.ein,
        address: body.address,
        city: body.city,
        postal_code: body.postal_code,
        country: body.country || 'FR',
        billing_address: body.billing_address,
        shipping_address: body.shipping_address,
        category: body.category,
        tags: body.tags,
        notes: body.notes,
        currency: body.currency || 'EUR',
        mode_reglement: body.mode_reglement || 'virement',
        delai_paiement: body.delai_paiement || 30,
        iban: body.iban,
        bic: body.bic,
        banque: body.banque,
      })
      .select()
      .single();

    if (error) {
      console.error('[ERP Clients] Create error:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: client,
    }, { status: 201 });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/clients [POST]');
  }
}
