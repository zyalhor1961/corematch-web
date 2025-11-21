/**
 * Admin API: Organization AI Settings
 *
 * GET /api/admin/orgs/[orgId]/ai-settings - Get org AI settings
 * PUT /api/admin/orgs/[orgId]/ai-settings - Update/create org AI settings
 *
 * Only org_admin can modify settings.
 * All org members can read (needed for runtime injection).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';
import { OrgAISettings } from '@/lib/types';

/**
 * GET /api/admin/orgs/[orgId]/ai-settings
 * Returns the AI settings for an organization.
 * Returns null data if no settings exist (use defaults).
 */
export const GET = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const orgId = params.orgId;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify user has access to this org
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Fetch AI settings
    const { data: settings, error: settingsError } = await supabase
      .from('org_ai_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    // PGRST116 = no rows returned (acceptable - org has no custom settings)
    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('[org-ai-settings] Error fetching settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch AI settings', details: settingsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: settings || null,
      hasCustomSettings: !!settings,
    });
  } catch (error) {
    console.error('[org-ai-settings] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/orgs/[orgId]/ai-settings
 * Create or update AI settings for an organization.
 * Only org_admin can modify.
 */
export const PUT = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const orgId = params.orgId;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify user is org_admin
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    if (membership.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Only organization admins can modify AI settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      general_instructions,
      daf_instructions,
      cv_instructions,
      deb_instructions,
    } = body;

    // Validate input lengths (prevent bloated prompts)
    const MAX_INSTRUCTION_LENGTH = 10000;
    const fields = [
      { name: 'general_instructions', value: general_instructions },
      { name: 'daf_instructions', value: daf_instructions },
      { name: 'cv_instructions', value: cv_instructions },
      { name: 'deb_instructions', value: deb_instructions },
    ];

    for (const field of fields) {
      if (field.value && field.value.length > MAX_INSTRUCTION_LENGTH) {
        return NextResponse.json(
          { error: `${field.name} exceeds maximum length of ${MAX_INSTRUCTION_LENGTH} characters` },
          { status: 400 }
        );
      }
    }

    // Use admin client for upsert (RLS will validate ownership)
    const supabaseAdmin = await getSupabaseAdmin();

    const settingsData: Partial<OrgAISettings> = {
      org_id: orgId,
      general_instructions: general_instructions || null,
      daf_instructions: daf_instructions || null,
      cv_instructions: cv_instructions || null,
      deb_instructions: deb_instructions || null,
    };

    // Upsert: create if not exists, update if exists
    const { data: settings, error: upsertError } = await supabaseAdmin
      .from('org_ai_settings')
      .upsert(settingsData, {
        onConflict: 'org_id',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('[org-ai-settings] Error upserting settings:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save AI settings', details: upsertError.message },
        { status: 500 }
      );
    }

    console.log(`[org-ai-settings] Updated AI settings for org: ${orgId}`);

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'AI settings saved successfully',
    });
  } catch (error) {
    console.error('[org-ai-settings] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/orgs/[orgId]/ai-settings
 * Remove custom AI settings (revert to defaults).
 * Only org_admin can delete.
 */
export const DELETE = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const orgId = params.orgId;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify user is org_admin
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    if (membership.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Only organization admins can delete AI settings' },
        { status: 403 }
      );
    }

    const supabaseAdmin = await getSupabaseAdmin();

    const { error: deleteError } = await supabaseAdmin
      .from('org_ai_settings')
      .delete()
      .eq('org_id', orgId);

    if (deleteError) {
      console.error('[org-ai-settings] Error deleting settings:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete AI settings', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`[org-ai-settings] Deleted AI settings for org: ${orgId}`);

    return NextResponse.json({
      success: true,
      message: 'AI settings deleted. Organization will use default prompts.',
    });
  } catch (error) {
    console.error('[org-ai-settings] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});
