import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { clientIpFromRequest, rateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 10;
const LOCKOUT_MINUTES = 15;

function emailHint(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at <= 0) return '***';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const l = local.slice(0, Math.min(3, local.length)) + '***';
  const d = domain.slice(0, Math.min(2, domain.length)) + '***';
  return `${l}@${d}`;
}

/**
 * POST { action: 'precheck' } — 429 if IP is locked out (DB-backed).
 * POST { action: 'record', success: boolean, email?: string } — append audit row.
 */
export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const burst = rateLimitedJsonResponse(`login_attempt_burst:${ip}`, 30, 60_000);
  if (burst) return burst;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: true, skip: true });
  }

  let body: { action?: string; success?: boolean; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'precheck') {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { data: rows, error } = await admin
      .from('login_attempts')
      .select('created_at, success')
      .eq('ip_address', ip)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[login-attempt] precheck', error.message);
      return NextResponse.json({ ok: true });
    }

    const failures = (rows || []).filter((r) => r.success === false);
    if (failures.length >= MAX_FAILURES) {
      const oldest = failures[0]?.created_at ? new Date(failures[0].created_at as string).getTime() : Date.now();
      const unlockAt = oldest + LOCKOUT_MINUTES * 60_000;
      const retryAfterSec = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 15 minutes.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === 'record') {
    const ua = req.headers.get('user-agent') ?? '';
    const hint = typeof body.email === 'string' ? emailHint(body.email) : null;
    await admin.from('login_attempts').insert({
      ip_address: ip,
      email_hint: hint,
      success: Boolean(body.success),
      user_agent: ua.slice(0, 512),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}
