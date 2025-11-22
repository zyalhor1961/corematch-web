import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';
import { orchestrateQuery } from '@/lib/daf-ask/orchestrator';
import type { DafAskRequest, DafAskResponse } from '@/lib/daf-ask/types';

// Increase timeout for LLM calls
export const maxDuration = 60;

/**
 * POST /api/daf/ask
 *
 * Ask DAF - Natural language queries for financial analytics
 *
 * Body: {
 *   question: string;
 *   language?: 'fr' | 'en' | 'auto';
 *   context?: { filters?: object; dateRange?: object };
 * }
 *
 * Returns: DafAskResponse
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

    // Parse request body
    const body: DafAskRequest = await request.json();

    if (!body.question || typeof body.question !== 'string') {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Question is required', 'question');
    }

    const question = body.question.trim();
    if (question.length < 3) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Question too short', 'question');
    }

    if (question.length > 1000) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Question too long (max 1000 chars)', 'question');
    }

    console.log(`[Ask DAF] User ${userId} asking: "${question.substring(0, 100)}..."`);

    // Get org-specific AI instructions
    let orgInstructions: string | undefined;
    try {
      const { data: aiSettings } = await supabaseAdmin
        .from('org_ai_settings')
        .select('daf_instructions, general_instructions')
        .eq('org_id', orgId)
        .single();

      if (aiSettings) {
        orgInstructions = aiSettings.daf_instructions || aiSettings.general_instructions;
      }
    } catch {
      // No custom instructions - that's fine
    }

    // Run the orchestrator (includes intent classifier + RAG + agent)
    const response: DafAskResponse = await orchestrateQuery(question, {
      supabase: supabaseAdmin,
      orgId,
      userId: user!.id,
      language: body.language || 'auto',
      orgInstructions,
      enableRAG: true,
    });

    console.log(`[Ask DAF] Response generated in ${response.debug?.duration}ms, tools: ${response.debug?.toolsCalled.join(', ')}`);

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('[Ask DAF] Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/ask [POST]');
  }
}

/**
 * GET /api/daf/ask
 *
 * Returns available tools and example questions
 */
export async function GET(request: NextRequest) {
  try {
    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    return NextResponse.json({
      success: true,
      data: {
        description: 'Ask DAF - Natural language analytics for your documents',
        exampleQuestions: {
          fr: [
            'Donne moi les factures non réglées',
            'Combien j\'ai dépensé chez EDF en 2024 ?',
            'Liste les factures de plus de 500 €',
            'Quels sont mes principaux fournisseurs ?',
            'Évolution de mes dépenses par mois',
            'Montre moi les CVs reçus cette semaine',
            'Résumé de mon workspace',
          ],
          en: [
            'Show me unpaid invoices',
            'How much did I spend at EDF in 2024?',
            'List invoices over 500 €',
            'Who are my main suppliers?',
            'Monthly spending trend',
            'Show me CVs received this week',
            'Workspace summary',
          ],
        },
        availableTools: [
          'list_invoices',
          'sum_invoices',
          'invoices_by_supplier',
          'invoices_by_month',
          'list_documents',
          'list_cvs',
          'get_overview_stats',
          'search_documents',
        ],
      },
    });

  } catch (error) {
    console.error('[Ask DAF] GET Error:', error);
    return NextResponse.json({ error: 'Failed to get info' }, { status: 500 });
  }
}
