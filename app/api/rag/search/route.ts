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

    // Parse request body
    const body = await request.json();

    const {
      query,
      org_id,
      content_type,
      limit = 10,
      mode = 'hybrid',
      metadata_filters,
    } = body;

    // Validate required fields
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new AppError(ErrorType.MISSING_REQUIRED_FIELD, 'Query is required', 'query');
    }

    if (!org_id || typeof org_id !== 'string') {
      throw new AppError(ErrorType.MISSING_REQUIRED_FIELD, 'Organization ID is required', 'org_id');
    }

    // Verify user has access to this organization
    const { getSupabaseAdmin } = await import('@/lib/supabase/server');
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', user!.id)
      .eq('org_id', org_id)
      .single();

    if (!membership) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No access to this organization');
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
      org_id,
      content_type: content_type as ContentType | undefined,
      limit,
      mode: mode as 'vector' | 'fts' | 'hybrid',
      metadata_filters,
    });

    return NextResponse.json({
      results: context.chunks,
      total: context.chunks.length,
      execution_time_ms: 0, // TODO: track actual time
      context_text: context.context_text,
      citations: context.citations,
      total_tokens: context.total_tokens,
    });
  } catch (error) {
    console.error('[RAG Search] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/rag/search [POST]');
  }
}
