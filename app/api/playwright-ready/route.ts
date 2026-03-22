import { NextResponse } from 'next/server';

/**
 * Lightweight readiness probe for Playwright `webServer.url`.
 * Hitting `/` can block until the entire app shell compiles; this route stays small so CI/local
 * `npx playwright test` does not time out on `config.webServer`.
 */
export async function GET() {
  return NextResponse.json({ ok: true, probe: 'playwright-ready' });
}
