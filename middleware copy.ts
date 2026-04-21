import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromRequest } from '@/lib/rate-limit/simple-memory';

const PROTECTED_PREFIXES = ['/trips', '/incidents', '/coverage', '/claims', '/account', '/scan', '/policies'];

/** In-memory login failure tracker (resets on cold start; complements DB login_attempts). */
const loginAttempts = new Map<string, { failures: number[]; lockedUntil: number }>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function hasSbAuthCookieShape(req: NextRequest): boolean {
  const cookies = Array.from(req.cookies.getAll());
  return cookies.some((c) => {
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
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self), payment=()');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  return res;
}

function loginRetryAfterSec(ip: string): number {
  const e = loginAttempts.get(ip);
  if (!e || Date.now() >= e.lockedUntil) return 15 * 60;
  return Math.max(1, Math.ceil((e.lockedUntil - Date.now()) / 1000));
}

function isLoginLocked(ip: string): boolean {
  const e = loginAttempts.get(ip);
  if (!e) return false;
  const now = Date.now();
  if (now >= e.lockedUntil) {
    if (e.failures.length === 0) loginAttempts.delete(ip);
    return false;
  }
  return true;
}

function recordLoginFailure(ip: string) {
  const now = Date.now();
  const prev = loginAttempts.get(ip) ?? { failures: [], lockedUntil: 0 };
  if (now < prev.lockedUntil) return;
  const failures = prev.failures.filter((t) => now - t < ATTEMPT_WINDOW_MS);
  failures.push(now);
  let lockedUntil = 0;
  if (failures.length >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(ip, { failures: [], lockedUntil });
  } else {
    loginAttempts.set(ip, { failures, lockedUntil: 0 });
  }
}

function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIpFromRequest(req);

  const authPathLocked =
    pathname.startsWith('/api/auth/') || pathname === '/signin' || pathname.startsWith('/signin/');
  if (authPathLocked && isLoginLocked(ip)) {
    const ra = String(loginRetryAfterSec(ip));
    if (pathname.startsWith('/api/')) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Too many login attempts. Please try again in 15 minutes.' },
          { status: 429, headers: { 'Retry-After': ra } },
        ),
      );
    }
    return applySecurityHeaders(
      new NextResponse('Too many login attempts. Please try again in 15 minutes.', {
        status: 429,
        headers: { 'Retry-After': ra, 'Content-Type': 'text/plain; charset=utf-8' },
      }),
    );
  }

  const isProtected =
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || pathname.startsWith('/focl');

  if (!isProtected) {
    return applySecurityHeaders(NextResponse.next());
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /* Prefer validated session when public env is configured (rejects expired / invalid cookies). */
  if (supabaseUrl && supabaseAnonKey) {
    let response = NextResponse.next({
      request: {
        headers: new Headers(req.headers),
      },
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) => {
              req.cookies.set(name, value);
            });
          } catch {
            /* Request cookies may be immutable in some runtimes; response cookies still apply. */
          }
          response = NextResponse.next({
            request: {
              headers: new Headers(req.headers),
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (hasSbAuthCookieShape(req)) {
          recordLoginFailure(ip);
          if (isLoginLocked(ip)) {
            const ra = String(loginRetryAfterSec(ip));
            return applySecurityHeaders(
              NextResponse.json(
                { error: 'Too many login attempts. Please try again in 15 minutes.' },
                { status: 429, headers: { 'Retry-After': ra } },
              ),
            );
          }
        }
        const url = req.nextUrl.clone();
        url.pathname = '/signin';
        url.searchParams.set('return_url', pathname);
        return applySecurityHeaders(NextResponse.redirect(url));
      }

      clearLoginFailures(ip);

      if (pathname.startsWith('/focl')) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('membership_tier')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.membership_tier !== 'FOUNDER') {
          const url = req.nextUrl.clone();
          url.pathname = '/trips';
          return applySecurityHeaders(NextResponse.redirect(url));
        }
      }

      return applySecurityHeaders(response);
    } catch {
      /* Auth service unreachable — fall back to cookie presence so travelers aren't hard-blocked. */
      if (!hasSbAuthCookieShape(req)) {
        const url = req.nextUrl.clone();
        url.pathname = '/signin';
        url.searchParams.set('return_url', pathname);
        return applySecurityHeaders(NextResponse.redirect(url));
      }
      return applySecurityHeaders(NextResponse.next());
    }
  }

  /* Fallback: env not wired (local misconfig) — preserve legacy cookie-name gate. */
  if (!hasSbAuthCookieShape(req)) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('return_url', pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Security headers + auth gates. Excludes static assets.
     * (Keeps prior protected prefixes and adds everything else except _next + images.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
