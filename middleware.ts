import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Allow access to auth callback route immediately
  if (request.nextUrl.pathname === '/auth/callback') {
    return NextResponse.next()
  }

  // Allow access to public pages immediately
  const publicPages = ['/login', '/register', '/pricing', '/products/cv-screening', '/products/deb-assistant'];
  if (publicPages.includes(request.nextUrl.pathname) || request.nextUrl.pathname === '/') {
    return NextResponse.next()
  }

  // Skip auth check for static assets and API routes
  if (request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api/') ||
      request.nextUrl.pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Check if env vars are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Middleware: Supabase env vars not configured')
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session if needed - this is the recommended pattern
    const { data: { user }, error } = await supabase.auth.getUser()

    // If auth error or no user, redirect to login
    if (error || !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return response
  } catch (error) {
    // On unexpected error, allow through (fail open for availability)
    console.error('Middleware auth error:', error)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - register (register page)
     * - pricing (pricing page)
     * - products (products pages)
     * - auth/callback (auth callback route)
     */
    '/((?!_next/static|_next/image|favicon.ico|login|register|pricing|products|auth/callback).*)',
  ],
}