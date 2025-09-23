import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware temporairement désactivé pour debug
export async function middleware(request: NextRequest) {
  console.log('Middleware called for:', request.nextUrl.pathname);
  
  // Pour le moment, on laisse tout passer pour identifier le problème
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Matcher temporairement très restrictif pour debug
    '/((?!_next/static|_next/image|favicon.ico|public|$).*)',
  ],
};