import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { DAFDocument } from '@/lib/daf-docs/types';

/**
 * GET /api/daf/search
 *
 * Full-text search across all DAF documents for an organization
 * Uses PostgreSQL tsvector for fast indexed search
 *
 * Query params:
 * - q: search query (required for search, optional for listing)
 * - doc_type: filter by AI-detected type
 * - status: filter by status
 * - limit: max results (default 50)
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;
    userId = user?.id;

    // Get user's org
    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const docType = searchParams.get('doc_type');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`[DAF Search] Query: "${query}" | Org: ${orgId} | Type: ${docType} | Limit: ${limit}`);

    // Use the RPC function if query is provided, otherwise fallback to regular query
    if (query.trim()) {
      // Full-text search using the RPC function
      const { data: searchResults, error: searchError } = await supabaseAdmin
        .rpc('search_daf_documents', {
          p_org_id: orgId,
          p_query: query,
          p_doc_type: docType,
          p_status: status,
          p_limit: limit,
          p_offset: offset,
        });

      if (searchError) {
        console.error('[DAF Search] RPC error:', searchError);
        // Fallback to ILIKE search if RPC fails (e.g., function doesn't exist yet)
        return fallbackSearch(supabaseAdmin, orgId, query, docType, status, limit, offset);
      }

      // Get total count for pagination
      const { count } = await supabaseAdmin
        .from('daf_documents')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .or(`file_name.ilike.%${query}%,fournisseur.ilike.%${query}%,full_text.ilike.%${query}%`);

      return NextResponse.json({
        success: true,
        data: {
          documents: searchResults as DAFDocument[],
          query,
          pagination: {
            total: count || searchResults?.length || 0,
            limit,
            offset,
            hasMore: (searchResults?.length || 0) >= limit,
          },
          searchMode: 'fulltext',
        },
      });
    } else {
      // No query - return regular list
      return fallbackSearch(supabaseAdmin, orgId, '', docType, status, limit, offset);
    }

  } catch (error) {
    console.error('[DAF Search] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/search [GET]');
  }
}

/**
 * Fallback search using ILIKE when tsvector isn't available
 */
async function fallbackSearch(
  supabaseAdmin: any,
  orgId: string,
  query: string,
  docType: string | null,
  status: string | null,
  limit: number,
  offset: number
) {
  let dbQuery = supabaseAdmin
    .from('daf_documents')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply text search filter using ILIKE
  if (query.trim()) {
    dbQuery = dbQuery.or(
      `file_name.ilike.%${query}%,` +
      `fournisseur.ilike.%${query}%,` +
      `numero_facture.ilike.%${query}%,` +
      `notes.ilike.%${query}%,` +
      `full_text.ilike.%${query}%`
    );
  }

  // Apply type filter
  if (docType) {
    dbQuery = dbQuery.or(`ai_detected_type.eq.${docType},doc_type.eq.${docType}`);
  }

  // Apply status filter
  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  const { data: documents, error, count } = await dbQuery;

  if (error) {
    console.error('[DAF Search] Fallback DB error:', error);
    throw new AppError(ErrorType.INTERNAL_ERROR, 'Search failed');
  }

  return NextResponse.json({
    success: true,
    data: {
      documents: documents as DAFDocument[],
      query,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      searchMode: 'ilike',
    },
  });
}

/**
 * POST /api/daf/search
 *
 * Advanced search with structured filters
 * Body: {
 *   query: string,
 *   filters: {
 *     types: string[],
 *     status: string[],
 *     dateFrom: string,
 *     dateTo: string,
 *     amountMin: number,
 *     amountMax: number,
 *     suppliers: string[]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;

  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;
    userId = user?.id;

    // Get user's org
    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;

    // Parse body
    const body = await request.json();
    const { query = '', filters = {}, limit = 50, offset = 0 } = body;

    console.log(`[DAF Search POST] Query: "${query}" | Filters:`, filters);

    // Build dynamic query
    let dbQuery = supabaseAdmin
      .from('daf_documents')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Text search
    if (query.trim()) {
      dbQuery = dbQuery.or(
        `file_name.ilike.%${query}%,` +
        `fournisseur.ilike.%${query}%,` +
        `numero_facture.ilike.%${query}%,` +
        `full_text.ilike.%${query}%`
      );
    }

    // Type filter (multiple)
    if (filters.types?.length > 0) {
      dbQuery = dbQuery.in('ai_detected_type', filters.types);
    }

    // Status filter (multiple)
    if (filters.status?.length > 0) {
      dbQuery = dbQuery.in('status', filters.status);
    }

    // Date range
    if (filters.dateFrom) {
      dbQuery = dbQuery.gte('date_document', filters.dateFrom);
    }
    if (filters.dateTo) {
      dbQuery = dbQuery.lte('date_document', filters.dateTo);
    }

    // Amount range
    if (filters.amountMin !== undefined) {
      dbQuery = dbQuery.gte('montant_ttc', filters.amountMin);
    }
    if (filters.amountMax !== undefined) {
      dbQuery = dbQuery.lte('montant_ttc', filters.amountMax);
    }

    // Supplier filter (multiple)
    if (filters.suppliers?.length > 0) {
      dbQuery = dbQuery.in('fournisseur', filters.suppliers);
    }

    const { data: documents, error, count } = await dbQuery;

    if (error) {
      console.error('[DAF Search POST] DB error:', error);
      throw new AppError(ErrorType.INTERNAL_ERROR, 'Search failed');
    }

    return NextResponse.json({
      success: true,
      data: {
        documents: documents as DAFDocument[],
        query,
        filters,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      },
    });

  } catch (error) {
    console.error('[DAF Search POST] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/search [POST]');
  }
}
