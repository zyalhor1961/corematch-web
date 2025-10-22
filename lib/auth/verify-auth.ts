import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return null;
    }
    
    // Get auth token from header (set by middleware)
    const authToken = request.headers.get('x-auth-token');
    
    if (!authToken) {
      // Try to get from Authorization header as fallback
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return null;
      }
      
      const token = authHeader.substring(7);
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }
      
      return {
        id: user.id,
        email: user.email!,
        role: user.role,
      };
    }
    
    // Parse the cookie value to get the actual token
    let tokenData;
    try {
      tokenData = JSON.parse(decodeURIComponent(authToken));
    } catch {
      return null;
    }
    
    const accessToken = tokenData[0];
    if (!accessToken) {
      return null;
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
    
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email!,
      role: user.role,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export async function verifyOrgAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has access to the organization
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Org access verification error:', error);
    return false;
  }
}

export async function verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[verifyProjectAccess] Missing Supabase environment variables');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project with org info and creator
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, org_id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('[verifyProjectAccess] Project query error:', projectError);
      return false;
    }

    if (!project) {
      console.error('[verifyProjectAccess] Project not found:', projectId);
      return false;
    }

    // Check if user is the project creator
    if (project.user_id === userId) {
      console.log('[verifyProjectAccess] Access granted: user is project creator');
      return true;
    }

    // If not creator, check if user has access to the project's organization
    console.log('[verifyProjectAccess] Checking org access for org_id:', project.org_id);
    return verifyOrgAccess(userId, project.org_id);
  } catch (error) {
    console.error('[verifyProjectAccess] Error:', error);
    return false;
  }
}