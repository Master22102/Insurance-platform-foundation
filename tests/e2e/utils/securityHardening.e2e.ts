import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { serviceRoleDelete, serviceRoleGet, serviceRolePost } from './serviceRoleRest';

export async function recordLoginFailure(
  request: APIRequestContext,
  ipSuffix: string,
  email: string,
): Promise<void> {
  const res = await request.post('/api/auth/login-attempt', {
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ipSuffix,
    },
    data: { action: 'record', success: false, email },
  });
  expect([200, 429]).toContain(res.status());
}

export async function assertLatestLoginAttemptMasked(
  request: APIRequestContext,
  ipSuffix: string,
  expectEmailPattern: RegExp,
): Promise<void> {
  const rows = await serviceRoleGet<
    Array<{ success: boolean; email_hint: string | null; ip_address: string }>
  >(request, 'login_attempts', `ip_address=eq.${encodeURIComponent(ipSuffix)}&select=success,email_hint,ip_address&order=created_at.desc&limit=1`);
  expect(rows.length).toBe(1);
  expect(rows[0]?.success).toBe(false);
  expect(rows[0]?.email_hint).toMatch(expectEmailPattern);
}

/**
 * Hits `/api/voice/parse` until a 429 (or max attempts). Tolerates an immediate 429 when another
 * worker/test already exhausted the in-memory limit — still requires `Retry-After`.
 */
export async function voiceParseUntil429(page: Page): Promise<{ last: number; retryAfter: string | null }> {
  let last = 0;
  let retryAfter: string | null = null;
  const maxAttempts = 85;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await page.evaluate(async (idx) => {
      const r = await fetch('/api/voice/parse', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: `e2e rl ${idx} tokyo osaka`,
          context: 'signal_categorize',
        }),
      });
      return { status: r.status, ra: r.headers.get('Retry-After') };
    }, i);
    last = res.status;
    if (res.ra) retryAfter = res.ra;
    if (last === 429) {
      expect(retryAfter, '429 responses must include Retry-After').toBeTruthy();
      return { last, retryAfter };
    }
    expect([200], `voice/parse expected 200 before limit, got ${last} at attempt ${i}`).toContain(last);
  }
  throw new Error(`No 429 after ${maxAttempts} voice/parse calls (try --workers=1 or a fresh dev server).`);
}

export async function insertRevokableSessionRow(
  request: APIRequestContext,
  userId: string,
): Promise<string> {
  const sid = randomUUID();
  const ins = await serviceRolePost(request, 'user_sessions', {
    session_id: sid,
    user_id: userId,
    device_info: 'e2e-revoke-target',
    ip_address: '127.0.0.1',
    is_current: false,
    is_revoked: false,
  });
  expect(ins.status, JSON.stringify(ins.data)).toBe(201);
  return sid;
}

export async function cleanupUserSessionById(request: APIRequestContext, sessionId: string): Promise<void> {
  await serviceRoleDelete(request, 'user_sessions', `session_id=eq.${sessionId}`);
}
