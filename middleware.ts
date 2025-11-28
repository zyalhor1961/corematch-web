import { createServerClient, type CookieOptions } from '@supabase/ssr'
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

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    // Check if env vars are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Middleware: Supabase env vars not configured')
      // Allow request through if auth can't be checked
      return NextResponse.next()
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Add timeout to auth check
    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 3000)
    )

    const { data: { user } } = await Promise.race([authPromise, timeoutPromise]) as any

    // if user is not signed in, redirect to /login
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return response
  } catch (error) {
    // On auth error or timeout, redirect to login
    console.error('Middleware auth error:', error)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
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