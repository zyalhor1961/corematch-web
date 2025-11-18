/**
 * RAG Search API
 * Recherche sémantique dans les documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import { createRAGOrchestrator } from '@/lib/rag';
import type { ContentType } from '@/lib/rag';

/**
 * POST /api/rag/search
 *
 * Body:
 * {
 *   query: string;
 *   content_type?: 'daf_document' | 'cv' | 'job_spec';
 *   limit?: number;
 *   mode?: 'vector' | 'fts' | 'hybrid';
 *   metadata_filters?: Record<string, any>;
 * }
 *
 * Response:
 * {
 *   success: true;
 *   data: {
 *     chunks: SearchResult[];
 *     context_text: string;
 *     citations: Citation[];
 *     total_tokens: number;
 *     execution_time_ms: number;
 *   }
 * }
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();

    const {
      query,
      content_type,
      limit = 10,
      mode = 'hybrid',
      metadata_filters,
    } = body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new AppError(ErrorType.MISSING_REQUIRED_FIELD, 'Query is required', 'query');
    }

    if (query.length > 500) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Query too long (max 500 chars)', 'query');
    }

    console.log(`[RAG Search] User ${user!.id} searching: "${query.substring(0, 50)}..."`);

    // Create RAG orchestrator
    const rag = createRAGOrchestrator();

    // Execute search with context generation
    const context = await rag.query({
      query,
      org_id: orgId,
      content_type: content_type as ContentType | undefined,
      limit,
      mode: mode as 'vector' | 'fts' | 'hybrid',
      metadata_filters,
    });

    return NextResponse.json({
      success: true,
      data: {
        chunks: context.chunks,
        context_text: context.context_text,
        citations: context.citations,
        total_tokens: context.total_tokens,
        execution_time_ms: 0, // TODO: track actual time
      },
      message: `Found ${context.citations.length} relevant documents`,
    });
  } catch (error) {
    console.error('[RAG Search] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/rag/search [POST]');
  }
}
