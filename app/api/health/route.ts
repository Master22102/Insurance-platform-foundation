import { NextResponse } from 'next/server';

/**
 * Liveness / load-balancer probe — no DB, no secrets in response body.
 * Optionally includes short commit id when VERCEL_GIT_COMMIT_SHA (or HEALTH_GIT_SHA) is set.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.HEALTH_GIT_SHA ||
    process.env.GITHUB_SHA ||
    '';

  return NextResponse.json({
    ok: true,
    service: 'wayfarer-web',
    ...(sha ? { commit: sha.slice(0, 7) } : {}),
  });
}
