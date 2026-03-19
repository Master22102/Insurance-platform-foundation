import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/trips', '/incidents', '/coverage', '/claims', '/account', '/scan', '/policies'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const cookies = Array.from(req.cookies.getAll());
  // Supabase cookie names vary by version/config; accept the common token cookies.
  const hasAuthCookie = cookies.some((c) => {
    if (!c.name.startsWith('sb-')) return false;
    const n = c.name.toLowerCase();
    return (
      n.includes('auth-token') ||
      n.includes('auth_token') ||
      n.includes('access-token') ||
      n.includes('access_token') ||
      n.includes('refresh-token') ||
      n.includes('refresh_token')
    );
  });

  if (!hasAuthCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('return_url', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/trips/:path*',
    '/incidents/:path*',
    '/coverage/:path*',
    '/claims/:path*',
    '/account/:path*',
    '/scan/:path*',
    '/policies/:path*',
  ],
};
