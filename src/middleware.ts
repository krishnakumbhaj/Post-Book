// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/sign-in', 
    '/sign-up', 
    '/', 
    '/verify/:path*',
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const url = request.nextUrl;

  if (url.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const userRole = token?.role as string | undefined;

  // Redirect authenticated users from auth pages
  if (
    token &&
    (url.pathname.startsWith('/sign-in') ||
      url.pathname.startsWith('/sign-up') ||
      url.pathname.startsWith('/verify') ||
      url.pathname === '/')
  ) {
    // Redirect based on role
    if (userRole === 'Agent') {
      return NextResponse.redirect(new URL('/Home', request.url));
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Protect dashboard - only Users can access
  if (url.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (userRole === 'Agent') {
      return NextResponse.redirect(new URL('/Home', request.url));
    }
  }

  // Protect /Home and agent routes - only Agents can access
  if (url.pathname.startsWith('/Home') || url.pathname.startsWith('/rd-account')) {
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (userRole !== 'Agent') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}
