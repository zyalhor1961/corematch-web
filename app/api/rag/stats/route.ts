/**
 * RAG Stats API
 * Statistiques des embeddings par organisation
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import { createRAGOrchestrator } from '@/lib/rag';

/**
 * GET /api/rag/stats
 *
 * Response:
 * {
 *   success: true;
 *   data: {
 *     total_chunks: number;
 *     total_documents: number;
 *     by_content_type: Record<string, number>;
 *     total_tokens: number;
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  let userId: string | undefined;

  try {
    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;
    userId = user?.id;

    // Get user's organization
    const { getSupabaseAdmin } = await import('@/lib/supabase/server');
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: userOrg } = await supabaseAdmin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    const orgId = userOrg.org_id;

    // Create RAG orchestrator
    const rag = createRAGOrchestrator();

    // Get stats
    const stats = await rag.getStats(orgId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[RAG Stats] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/rag/stats [GET]');
  }
}
