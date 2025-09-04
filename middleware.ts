import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/org',
  '/onboarding',
];

// API routes that require authentication
const protectedApiRoutes = [
  '/api/cv',
  '/api/deb',
  '/api/billing',
  '/api/history',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the route needs protection
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isProtectedApiRoute = protectedApiRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute || isProtectedApiRoute) {
    // Get the session token from cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    // Check for auth cookies
    const cookieName = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    const token = request.cookies.get(cookieName);
    
    if (!token) {
      // No auth token found
      if (isProtectedApiRoute) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      } else {
        // Redirect to login for web routes
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    
    // For API routes, add user context to headers
    if (isProtectedApiRoute) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-auth-token', token.value);
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - login, register, and root pages
     */
    '/((?!_next/static|_next/image|favicon.ico|public|login|register|pricing|products|$).*)',
  ],
};