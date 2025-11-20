/**
 * Middleware d'authentification pour les routes API
 *
 * Sécurise les endpoints en vérifiant :
 * - Session utilisateur valide
 * - Membership dans l'organisation
 * - Permissions appropriées
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export type AuthenticatedHandler = (
  request: NextRequest,
  session: any
) => Promise<NextResponse>;

export type OrgAccessHandler = (
  request: NextRequest,
  session: any,
  orgId: string,
  membership: any
) => Promise<NextResponse>;

/**
 * Vérifie que l'utilisateur est authentifié
 */
export function withAuth(handler: AuthenticatedHandler | ((request: NextRequest, session: any, context?: any) => Promise<NextResponse>)) {
  return async (request: NextRequest, context?: any) => {
    // DEV ONLY: Bypass auth for admin routes in development
    if (process.env.NODE_ENV === 'development' && request.url.includes('/api/admin/')) {
      console.warn('[Auth Middleware] ⚠️ DEV MODE: Bypassing auth for admin route:', request.url);

      // Create mock session for dev
      const mockSession = {
        user: {
          id: 'dev-user-id',
          email: 'dev@corematch.local',
        },
      };

      return handler(request, mockSession, context);
    }

    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      console.error('[Auth Middleware] Unauthorized access attempt:', {
        url: request.url,
        error: error?.message,
      });

      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    return handler(request, session, context);
  };
}

/**
 * Vérifie l'accès à une organisation spécifique
 */
export function withOrgAccess(handler: OrgAccessHandler) {
  return withAuth(async (request, session) => {
    const orgId = request.nextUrl.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'MISSING_ORG_ID', message: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Vérifier membership dans l'organisation
    const { data: membership, error } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (error || !membership) {
      console.error('[Auth Middleware] Access denied:', {
        userId: session.user.id,
        orgId,
        error: error?.message,
      });

      return NextResponse.json(
        { error: 'ACCESS_DENIED', message: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    return handler(request, session, orgId, membership);
  });
}

/**
 * Vérifie que l'utilisateur a un rôle admin ou owner
 */
export function withAdminAccess(handler: OrgAccessHandler) {
  return withOrgAccess(async (request, session, orgId, membership) => {
    const isAdmin = membership.role === 'admin' || membership.role === 'owner';

    if (!isAdmin) {
      console.error('[Auth Middleware] Admin access denied:', {
        userId: session.user.id,
        orgId,
        role: membership.role,
      });

      return NextResponse.json(
        { error: 'ADMIN_REQUIRED', message: 'Admin privileges required' },
        { status: 403 }
      );
    }

    return handler(request, session, orgId, membership);
  });
}

/**
 * Helper pour extraire orgId du body (pour POST/PUT)
 */
export function withOrgAccessFromBody(handler: OrgAccessHandler) {
  return withAuth(async (request, session) => {
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: 'INVALID_BODY', message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const orgId = body.orgId;

    if (!orgId) {
      return NextResponse.json(
        { error: 'MISSING_ORG_ID', message: 'Organization ID is required in body' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: membership, error } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('org_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (error || !membership) {
      return NextResponse.json(
        { error: 'ACCESS_DENIED', message: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // Recréer request avec body déjà parsé
    const newRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(body),
    });

    // Attacher body parsé pour éviter de re-parser
    (newRequest as any).parsedBody = body;

    return handler(newRequest, session, orgId, membership);
  });
}
