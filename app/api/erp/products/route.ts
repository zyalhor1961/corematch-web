import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { ProductInput } from '@/lib/erp/types';

/**
 * GET /api/erp/products
 * List all products for the organization
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

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
    const productType = searchParams.get('type');
    const isActive = searchParams.get('is_active');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseAdmin
      .from('erp_products')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (productType) {
      query = query.eq('product_type', productType);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data: products, error, count } = await query;

    if (error) {
      console.error('[ERP Products] Error:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        products: products || [],
        total: count || 0,
        limit,
        offset,
      },
    });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/products [GET]');
  }
}

/**
 * POST /api/erp/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) return securityResult.response!;

    const { user } = securityResult;
    userId = user?.id;

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;
    const body: ProductInput = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Product name is required');
    }

    // Create product
    const { data: product, error } = await supabaseAdmin
      .from('erp_products')
      .insert({
        org_id: orgId,
        name: body.name.trim(),
        description: body.description,
        sku: body.sku,
        unit_price: body.unit_price || 0,
        currency: body.currency || 'EUR',
        vat_rate: body.vat_rate ?? 20,
        tax_category: body.tax_category || 'standard',
        product_type: body.product_type || 'service',
        category: body.category,
        revenue_account_code: body.revenue_account_code || '706',
        expense_account_code: body.expense_account_code,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('[ERP Products] Create error:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: product,
    }, { status: 201 });

  } catch (error) {
    return ApiErrorHandler.handleError(error, userId, '/api/erp/products [POST]');
  }
}
