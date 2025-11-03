import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { DAFDocument } from '@/lib/daf-docs/types';

/**
 * GET /api/daf/documents
 *
 * Liste tous les documents DAF de l'organisation
 *
 * Query params:
 * - status: filter by status (uploaded, extracted, validated, etc.)
 * - doc_type: filter by type (facture, releve_bancaire, etc.)
 * - fournisseur: filter by supplier
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
    const status = searchParams.get('status');
    const docType = searchParams.get('doc_type');
    const fournisseur = searchParams.get('fournisseur');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabaseAdmin
      .from('daf_documents')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (docType) {
      query = query.eq('doc_type', docType);
    }

    if (fournisseur) {
      query = query.eq('fournisseur', fournisseur);
    }

    const { data: documents, error, count } = await query;

    if (error) {
      console.error('[DAF Documents] DB error:', error);
      throw new AppError(ErrorType.INTERNAL_ERROR, 'Failed to fetch documents');
    }

    // Get stats (fallback si fonction pas créée)
    let stats = null;
    try {
      const { data } = await supabaseAdmin
        .rpc('get_daf_stats', { p_org_id: orgId })
        .single();
      stats = data;
    } catch (statsError) {
      console.warn('[DAF Documents] Stats function not available, using fallback');
      // Fallback: calculer les stats manuellement
      const allDocs = documents || [];
      stats = {
        total_documents: allDocs.length,
        total_factures: allDocs.filter(d => d.doc_type === 'facture').length,
        total_valides: allDocs.filter(d => d.status === 'validated').length,
        total_en_attente: allDocs.filter(d => ['uploaded', 'extracted'].includes(d.status)).length,
        montant_total_ttc: 0,
        nombre_fournisseurs: new Set(allDocs.map(d => d.fournisseur).filter(Boolean)).size,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        documents: documents as DAFDocument[],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
        stats: stats || {
          total_documents: 0,
          total_factures: 0,
          total_valides: 0,
          total_en_attente: 0,
          montant_total_ttc: 0,
          nombre_fournisseurs: 0,
        },
      },
    });

  } catch (error) {
    console.error('[DAF Documents] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/documents [GET]');
  }
}

/**
 * POST /api/daf/documents
 *
 * Alternative upload endpoint (sans multipart/form-data)
 * Redirige vers /upload
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Use /api/daf/documents/upload for file uploads',
      redirect: '/api/daf/documents/upload',
    },
    { status: 400 }
  );
}
