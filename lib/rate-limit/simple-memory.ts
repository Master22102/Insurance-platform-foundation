/**
 * Best-effort fixed-window counter per key (in-process only).
 * On serverless, each instance has its own map — use CDN/WAF or Redis for strong guarantees.
 */

import { NextResponse } from 'next/server';

type Entry = { count: number; windowStart: number };

const store = new Map<string, Entry>();

const MAX_KEYS = 10_000;

function pruneIfHuge() {
  if (store.size <= MAX_KEYS) return;
  store.clear();
}

export function simpleMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  pruneIfHuge();
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (entry.count >= max) {
    const retryAfterMs = Math.max(0, windowMs - (now - entry.windowStart));
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  entry.count += 1;
  return { ok: true };
}

/** If over limit, return a 429 JSON response; otherwise `null`. */
export function rateLimitedJsonResponse(
  key: string,
  max: number,
  windowMs: number,
): NextResponse | null {
  const rl = simpleMemoryRateLimit(key, max, windowMs);
  if (rl.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    },
  );
}

/** Per-user fixed window (same store as IP limits; key isolates by user id + route slug). */
export function userRateLimitedJsonResponse(
  userId: string,
  route: string,
  maxRequests: number,
  windowMs: number,
): NextResponse | null {
  const key = `user:${userId}:${route}`;
  return rateLimitedJsonResponse(key, maxRequests, windowMs);
}

/** Client IP for rate-limit keys (best effort behind proxies). */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}
