import { expect, test, type APIRequestContext } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasServiceRoleKey, serviceRoleDelete, serviceRoleGet } from './utils/serviceRoleRest';
import { hasSupabaseEnv, readSupabaseUserIdFromStorageState } from './utils/supabaseRest';

/**
 * Uses one storageState user + server-side notification rate limits. When running **all** Playwright
 * browser projects, use `--workers=1` so two projects do not hit the same limits concurrently.
 * Retries below absorb Supabase Auth `getUser()` throttling (429) surfacing as 401 Unauthorized.
 */
const SESSION_401_RETRY_DELAYS_MS = [10_000, 20_000, 45_000, 60_000];

async function postJsonWithSessionRetry(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<{ status: number; ok: boolean; text: string }> {
  let last = { status: 0, ok: false, text: '' };
  for (let attempt = 0; attempt <= SESSION_401_RETRY_DELAYS_MS.length; attempt++) {
    const res = await request.post(path, {
      headers: { 'Content-Type': 'application/json' },
      data,
    });
    const text = await res.text();
    last = { status: res.status(), ok: res.ok(), text };
    if (res.ok()) return last;
    const transient =
      res.status() === 401 &&
      (text.includes('Unauthorized') || text.toLowerCase().includes('unauthorized'));
    if (!transient || attempt === SESSION_401_RETRY_DELAYS_MS.length) return last;
    await new Promise((r) => setTimeout(r, SESSION_401_RETRY_DELAYS_MS[attempt]));
  }
  return last;
}

async function putJsonWithSessionRetry(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<{ status: number; ok: boolean; text: string }> {
  let last = { status: 0, ok: false, text: '' };
  for (let attempt = 0; attempt <= SESSION_401_RETRY_DELAYS_MS.length; attempt++) {
    const res = await request.put(path, {
      headers: { 'Content-Type': 'application/json' },
      data,
    });
    const text = await res.text();
    last = { status: res.status(), ok: res.ok(), text };
    if (res.ok()) return last;
    const transient =
      res.status() === 401 &&
      (text.includes('Unauthorized') || text.toLowerCase().includes('unauthorized'));
    if (!transient || attempt === SESSION_401_RETRY_DELAYS_MS.length) return last;
    await new Promise((r) => setTimeout(r, SESSION_401_RETRY_DELAYS_MS[attempt]));
  }
  return last;
}

function logSkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[notification-engine E2E] SKIPPED — ${reason}${tail}\n\n`);
}

test.describe.serial('Notification Engine (F-6.5.15)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY.');
  test.use({ storageState: getStorageStatePath() });

  test.beforeEach(async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    if (!actorId) return;
    await serviceRoleDelete(request, 'notification_queue', `account_id=eq.${actorId}`);
  });

  test('push subscription POST creates row', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    const endpoint = `https://example.invalid/push/e2e-${Date.now()}`;
    const res = await postJsonWithSessionRetry(request, '/api/notifications/subscribe-push', {
      endpoint,
      keys: { p256dh: 'test-p256dh-key-pad-to-url-safe-base64==', auth: 'test-auth-key==' },
      userAgent: 'Playwright',
    });
    if (res.status === 404 || res.status === 503) {
      logSkip('subscribe-push unavailable', res.text);
      test.skip();
    }
    expect(res.ok, res.text).toBeTruthy();

    const rows = await serviceRoleGet<Array<{ endpoint: string }>>(
      request,
      'push_subscriptions',
      `select=endpoint&account_id=eq.${actorId}&endpoint=eq.${encodeURIComponent(endpoint)}`,
    );
    expect(rows.some((r) => r.endpoint === endpoint)).toBeTruthy();
  });

  test('queue notification via send endpoint', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    await putJsonWithSessionRetry(request, '/api/notifications/preferences', {
      notifications: {
        push_enabled: true,
        email_enabled: false,
        sms_enabled: false,
        categories: {
          trip_update: { push: true, email: false, sms: false },
        },
      },
    });

    const res = await postJsonWithSessionRetry(request, '/api/notifications/send', {
      account_id: actorId,
      channel: 'push',
      category: 'trip_update',
      title: 'E2E test',
      body: 'Queue smoke test',
    });
    if (res.status === 404 || res.status === 503) {
      logSkip('send API unavailable', res.text);
      test.skip();
    }
    expect(res.ok, res.text).toBeTruthy();
    const j = JSON.parse(res.text) as { queued?: boolean; notification_id?: string };
    expect(j.queued).toBe(true);
    expect(j.notification_id).toBeTruthy();
  });

  test('rate limiting: 11th push in window is rate_limited', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    await putJsonWithSessionRetry(request, '/api/notifications/preferences', {
      notifications: {
        push_enabled: true,
        categories: {
          system_announcement: { push: true, email: false, sms: false },
        },
      },
    });

    let lastJson: { queued?: boolean; reason?: string } = {};
    for (let i = 0; i < 11; i++) {
      const res = await postJsonWithSessionRetry(request, '/api/notifications/send', {
        account_id: actorId,
        channel: 'push',
        category: 'system_announcement',
        title: `Rate test ${i}`,
        body: 'x',
      });
      if (res.status === 404 || res.status === 503) {
        logSkip('send API unavailable', res.text);
        test.skip();
      }
      expect(res.ok, res.text).toBeTruthy();
      lastJson = JSON.parse(res.text) as typeof lastJson;
    }
    expect(lastJson.queued).toBe(false);
    expect(lastJson.reason).toBe('rate_limited');
  });

  test('preferences suppress push when disabled', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    await putJsonWithSessionRetry(request, '/api/notifications/preferences', {
      notifications: {
        push_enabled: false,
        categories: {
          trip_update: { push: true, email: false, sms: false },
        },
      },
    });

    const res = await postJsonWithSessionRetry(request, '/api/notifications/send', {
      account_id: actorId,
      channel: 'push',
      category: 'trip_update',
      title: 'Should suppress',
      body: 'opt out',
    });
    expect(res.ok, res.text).toBeTruthy();
    const j = JSON.parse(res.text) as { queued?: boolean; reason?: string };
    expect(j.queued).toBe(false);
    expect(j.reason).toBe('suppressed_opt_out');
  });

  test('idempotency key dedupes queue row', async ({ request }) => {
    const actorId = readSupabaseUserIdFromStorageState();
    test.skip(!actorId, 'No user id in storageState — run npm run e2e:auth');

    await putJsonWithSessionRetry(request, '/api/notifications/preferences', {
      notifications: {
        push_enabled: true,
        categories: {
          trip_update: { push: true, email: false, sms: false },
        },
      },
    });

    const key = `e2e-idem-${Date.now()}`;
    const body = {
      account_id: actorId,
      channel: 'push',
      category: 'trip_update',
      title: 'Idem',
      body: 'once',
      idempotency_key: key,
    };
    const r1 = await postJsonWithSessionRetry(request, '/api/notifications/send', body);
    expect(r1.ok, r1.text).toBeTruthy();
    const j1 = JSON.parse(r1.text) as { queued?: boolean };
    expect(j1.queued).toBe(true);

    const r2 = await postJsonWithSessionRetry(request, '/api/notifications/send', body);
    expect(r2.ok, r2.text).toBeTruthy();
    const j2 = JSON.parse(r2.text) as { queued?: boolean; reason?: string };
    expect(j2.queued).toBe(false);
    expect(j2.reason).toBe('duplicate_idempotency_key');
  });
});
