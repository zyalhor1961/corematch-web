import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute } from '@/lib/auth/middleware';
import { ApiErrorHandler } from '@/lib/errors/api-error-handler';
import { AppError, ErrorType } from '@/lib/errors/error-types';

interface SavedQuery {
  id: string;
  title: string;
  question: string;
  category: string;
  is_favorite: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

/**
 * GET /api/daf/saved-queries
 *
 * List saved queries for the current user
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
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    // Get saved queries
    const { data: queries, error } = await supabaseAdmin
      .from('daf_saved_queries')
      .select('*')
      .eq('org_id', userOrg.org_id)
      .eq('user_id', user!.id)
      .order('is_favorite', { ascending: false })
      .order('use_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Saved Queries] Error fetching:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: queries || [],
    });

  } catch (error) {
    console.error('[Saved Queries] GET Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/saved-queries [GET]');
  }
}

/**
 * POST /api/daf/saved-queries
 *
 * Save a new query
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
      .select('org_id')
      .eq('user_id', user!.id)
      .single();

    if (!userOrg) {
      throw new AppError(ErrorType.ACCESS_DENIED, 'No organization access');
    }

    // Parse body
    const body = await request.json();

    if (!body.question || typeof body.question !== 'string') {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Question is required', 'question');
    }

    const title = body.title || body.question.substring(0, 50) + (body.question.length > 50 ? '...' : '');

    // Check for duplicates
    const { data: existing } = await supabaseAdmin
      .from('daf_saved_queries')
      .select('id')
      .eq('org_id', userOrg.org_id)
      .eq('user_id', user!.id)
      .eq('question', body.question)
      .single();

    if (existing) {
      // Update use count instead
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('daf_saved_queries')
        .update({
          use_count: supabaseAdmin.sql`use_count + 1`,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(ErrorType.DATABASE_ERROR, updateError.message);
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Query already saved, updated use count',
      });
    }

    // Create new saved query
    const { data: saved, error } = await supabaseAdmin
      .from('daf_saved_queries')
      .insert({
        org_id: userOrg.org_id,
        user_id: user!.id,
        title,
        question: body.question,
        category: body.category || 'general',
        is_favorite: body.is_favorite || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Saved Queries] Error creating:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: saved,
    });

  } catch (error) {
    console.error('[Saved Queries] POST Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/saved-queries [POST]');
  }
}

/**
 * DELETE /api/daf/saved-queries
 *
 * Delete a saved query
 */
export async function DELETE(request: NextRequest) {
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

    // Get query ID from URL
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    if (!queryId) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Query ID is required', 'id');
    }

    // Delete (RLS will enforce ownership)
    const { error } = await supabaseAdmin
      .from('daf_saved_queries')
      .delete()
      .eq('id', queryId)
      .eq('user_id', user!.id);

    if (error) {
      console.error('[Saved Queries] Error deleting:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Query deleted',
    });

  } catch (error) {
    console.error('[Saved Queries] DELETE Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/saved-queries [DELETE]');
  }
}

/**
 * PATCH /api/daf/saved-queries
 *
 * Update a saved query (toggle favorite, update title)
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();

    if (!body.id) {
      throw new AppError(ErrorType.VALIDATION_ERROR, 'Query ID is required', 'id');
    }

    // Prepare update
    const update: Record<string, any> = {};
    if (typeof body.is_favorite === 'boolean') update.is_favorite = body.is_favorite;
    if (body.title) update.title = body.title;
    if (body.category) update.category = body.category;
    if (body.increment_use) {
      update.use_count = supabaseAdmin.sql`use_count + 1`;
      update.last_used_at = new Date().toISOString();
    }

    // Update (RLS will enforce ownership)
    const { data: updated, error } = await supabaseAdmin
      .from('daf_saved_queries')
      .update(update)
      .eq('id', body.id)
      .eq('user_id', user!.id)
      .select()
      .single();

    if (error) {
      console.error('[Saved Queries] Error updating:', error);
      throw new AppError(ErrorType.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });

  } catch (error) {
    console.error('[Saved Queries] PATCH Error:', error);
    return ApiErrorHandler.handleError(error, userId, '/api/daf/saved-queries [PATCH]');
  }
}
