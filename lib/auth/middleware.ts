import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  email: string;
  isMasterAdmin: boolean;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

/**
 * Vérifie l'authentification de l'utilisateur à partir de la requête
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    let user = null;

    // Try Authorization header first (Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

      if (!error && authUser) {
        user = authUser;
      }
    }

    // Fallback: Try to get user from cookies (for SSR)
    if (!user) {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
          },
        }
      );

      const { data: { user: cookieUser }, error } = await supabase.auth.getUser();

      if (!error && cookieUser) {
        user = cookieUser;
      }
    }

    if (!user) {
      return {
        user: null,
        error: 'Authentication required - No valid session found'
      };
    }

    // Check if user is master admin (DEV ONLY - disabled in production for security)
    const isMasterAdmin = process.env.NODE_ENV !== 'production' && user.email === 'admin@corematch.test';

    if (isMasterAdmin) {
      console.warn(`⚠️ Master admin bypass active for ${user.email} - DEV MODE ONLY`);
    }

    return {
      user: {
        id: user.id,
        email: user.email!,
        isMasterAdmin
      },
      error: null
    };

  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      user: null,
      error: 'Authentication verification failed'
    };
  }
}

/**
 * Vérifie si l'utilisateur a accès à une organisation spécifique
 */
export async function verifyOrgAccess(userId: string, orgId: string, isMasterAdmin: boolean = false): Promise<boolean> {
  try {
    // Master admin can access all organizations
    if (isMasterAdmin) {
      return true;
    }

    // TODO: Implement organization membership verification
    // For now, we'll implement a basic check using Supabase Admin
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    const { data: membership, error } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('Organization access verification error:', error);
      return false;
    }

    return !!membership;
  } catch (error) {
    console.error('Organization access check failed:', error);
    return false;
  }
}

/**
 * Middleware pour sécuriser les routes d'API
 */
export async function secureApiRoute(
  request: NextRequest,
  options: {
    requireOrgAccess?: boolean;
    allowMasterAdmin?: boolean;
    orgIdSource?: 'query' | 'body' | 'params';
    orgIdParam?: string;
  } = {}
): Promise<{
  success: boolean;
  user?: AuthUser;
  orgId?: string;
  response?: NextResponse;
}> {
  const {
    requireOrgAccess = false,
    allowMasterAdmin = true,
    orgIdSource = 'query',
    orgIdParam = 'orgId'
  } = options;

  // Verify authentication
  const { user, error } = await verifyAuth(request);

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Authentication required',
          details: error,
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      )
    };
  }

  // Extract orgId if required
  let orgId: string | undefined;
  if (requireOrgAccess) {
    try {
      switch (orgIdSource) {
        case 'query':
          const { searchParams } = new URL(request.url);
          orgId = searchParams.get(orgIdParam) || undefined;
          break;
        case 'body':
          throw new Error('secureApiRoute no longer supports orgIdSource="body". Use verifyAuth + verifyAuthAndOrgAccess instead.');
        case 'params':
          // This would need to be handled by the calling route
          // as we don't have access to dynamic params here
          break;
      }
    } catch (error) {
      console.error('Error extracting orgId:', error);
    }

    if (!orgId) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Organization ID required',
            code: 'ORG_ID_REQUIRED'
          },
          { status: 400 }
        )
      };
    }

    // Verify organization access (unless master admin and allowed)
    if (!(user.isMasterAdmin && allowMasterAdmin)) {
      const hasAccess = await verifyOrgAccess(user.id, orgId, user.isMasterAdmin);

      if (!hasAccess) {
        return {
          success: false,
          response: NextResponse.json(
            {
              error: 'Access denied to this organization',
              code: 'ORG_ACCESS_DENIED'
            },
            { status: 403 }
          )
        };
      }
    }
  }

  return {
    success: true,
    user,
    orgId
  };
}

/**
 * Vérifie l'authentification et l'accès organisationnel sans consommer le corps de la requête
 */
export async function verifyAuthAndOrgAccess(
  user: AuthUser,
  orgId: string,
  options: { allowMasterAdmin?: boolean } = {}
): Promise<boolean> {
  const { allowMasterAdmin = true } = options;

  if (!orgId) {
    return false;
  }

  if (allowMasterAdmin && user.isMasterAdmin) {
    return true;
  }

  return verifyOrgAccess(user.id, orgId, allowMasterAdmin && user.isMasterAdmin);
}

/**
 * Utility function pour créer une réponse d'erreur standardisée
 */
export function createErrorResponse(message: string, code: string, status: number = 400): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

/**
 * Utility function pour logger les tentatives d'accès
 */
export function logSecurityEvent(event: {
  type: 'AUTH_FAILURE' | 'ACCESS_DENIED' | 'SUSPICIOUS_ACTIVITY';
  userId?: string;
  email?: string;
  orgId?: string;
  route: string;
  ip?: string;
  details?: string;
}) {
  console.warn(`[SECURITY] ${event.type}:`, {
    ...event,
    timestamp: new Date().toISOString()
  });

  // TODO: In production, send to security monitoring service
  // Examples: Sentry, LogRocket, custom security dashboard
}