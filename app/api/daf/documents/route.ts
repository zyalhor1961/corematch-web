import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import type { DAFDocument, SmartHubStats } from '@/lib/daf-docs/types';

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

    // Get Smart Hub stats (try v2 first, fallback to v1, then manual)
    let smartStats: SmartHubStats | null = null;
    let legacyStats = null;

    // Try Smart Hub stats (v2)
    try {
      const { data } = await supabaseAdmin
        .rpc('get_daf_stats_v2', { p_org_id: orgId })
        .single();
      smartStats = data as SmartHubStats;
    } catch {
      console.warn('[DAF Documents] Smart Hub stats v2 not available');
    }

    // Try legacy stats (v1)
    try {
      const { data } = await supabaseAdmin
        .rpc('get_daf_stats', { p_org_id: orgId })
        .single();
      legacyStats = data;
    } catch {
      console.warn('[DAF Documents] Legacy stats not available');
    }

    // Fallback: calculate stats manually from documents
    const allDocs = documents || [];
    const fallbackStats: SmartHubStats = {
      total_documents: allDocs.length,
      // By AI type
      total_invoices: allDocs.filter(d => d.ai_detected_type === 'invoice' || d.doc_type === 'facture').length,
      total_cvs: allDocs.filter(d => d.ai_detected_type === 'cv').length,
      total_contracts: allDocs.filter(d => d.ai_detected_type === 'contract' || d.doc_type === 'contrat').length,
      total_reports: allDocs.filter(d => d.ai_detected_type === 'report').length,
      total_other: allDocs.filter(d => !d.ai_detected_type || d.ai_detected_type === 'other').length,
      // By status
      total_validated: allDocs.filter(d => d.status === 'validated').length,
      total_pending: allDocs.filter(d => ['uploaded', 'extracted'].includes(d.status)).length,
      total_extracted: allDocs.filter(d => d.status === 'extracted').length,
      // Financial
      montant_total_ttc: allDocs.reduce((sum, d) => sum + (d.montant_ttc || 0), 0),
      nombre_fournisseurs: new Set(allDocs.map(d => d.fournisseur).filter(Boolean)).size,
      // Attention
      needs_attention: allDocs.filter(d => d.status === 'uploaded' || (d.ai_confidence && d.ai_confidence < 0.5)).length,
    };

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
        // Smart Hub stats (primary)
        stats: smartStats || fallbackStats,
        // Legacy stats for backward compatibility
        legacyStats: legacyStats || {
          total_documents: fallbackStats.total_documents,
          total_factures: fallbackStats.total_invoices,
          total_valides: fallbackStats.total_validated,
          total_en_attente: fallbackStats.total_pending,
          montant_total_ttc: fallbackStats.montant_total_ttc,
          nombre_fournisseurs: fallbackStats.nombre_fournisseurs,
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
