import { NextRequest, NextResponse } from 'next/server';

// FOCL is a founder-only surface. We 404 non-founders at the edge so the
// surface is invisible to the rest of the user base. Actual authorization
// still happens client-side (AuthProvider) and server-side (RPC is_founder
// check). This middleware just hides the existence of the path from users who
// are not authenticated as CORPORATE.
//
// The cookie we check is the Supabase auth session cookie plus a shadow cookie
// `wf_tier` that the client sets after profile load. Absence of either means
// the visitor is not a verified founder -> 404.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/focl')) {
    const tierCookie = req.cookies.get('wf_tier')?.value;
    if (tierCookie !== 'CORPORATE') {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/focl/:path*'],
};
