import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { createPacketIdForApiTest } from './utils/claimPacketApiSetup.e2e';
import { hasServiceRoleKey } from './utils/e2eEnv';
import { serviceRoleDelete } from './utils/serviceRoleRest';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
} from './utils/supabaseRest';

async function founderTier(
  request: import('@playwright/test').APIRequestContext,
  token: string,
): Promise<'FOUNDER' | 'OTHER'> {
  const rows = await supabaseRestSelect<Array<{ membership_tier: string }>>(
    request,
    token,
    'user_profiles',
    'select=membership_tier&limit=1',
  );
  return rows[0]?.membership_tier === 'FOUNDER' ? 'FOUNDER' : 'OTHER';
}

test.describe('API route contracts (smoke)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.use({ storageState: getStorageStatePath() });

  test('GET /api/account/export returns JSON export', async ({ page }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
    // Same-origin `fetch` + `credentials: 'include'` — reliable across Chromium / Firefox / WebKit
    // (`page.request` can omit session cookies on some browsers vs `storageState`).
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/account/export', { credentials: 'include', cache: 'no-store' });
      const text = await r.text();
      return { status: r.status, text };
    });
    if (result.status === 401) {
      throw new Error(
        'GET /api/account/export returned 401 — renew `.playwright/storageState.json` (`npm run e2e:auth` with dev server running).',
      );
    }
    expect([200, 403]).toContain(result.status);
    if (result.status !== 200) return;
    const body = JSON.parse(result.text) as {
      exported_at?: string;
      user_id?: string;
      trips?: unknown[];
    };
    expect(body.exported_at).toBeTruthy();
    expect(body.user_id).toBeTruthy();
    expect(Array.isArray(body.trips)).toBeTruthy();
  });

  test('GET /api/coverage-catalog/search returns items envelope', async ({ request }) => {
    const res = await request.get('/api/coverage-catalog/search?q=chase&type=credit_card_benefit');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBeTruthy();
    expect(Array.isArray(body.items)).toBeTruthy();
  });

  test('GET /api/claim-packet/generate returns PDF', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    test.skip(!hasServiceRoleKey(), 'Service role needed to delete seeded trip after test.');
    const stamp = Date.now();
    const { packetId, tripId } = await createPacketIdForApiTest(request, token, stamp, 'api-contract-pdf');
    const res = await request.get(`/api/claim-packet/generate?packet_id=${encodeURIComponent(packetId)}`);
    expect(res.status()).toBe(200);
    expect((res.headers()['content-type'] || '').toLowerCase()).toContain('pdf');
    expect((await res.body()).byteLength).toBeGreaterThan(400);
    await serviceRoleDelete(request, 'trips', `trip_id=eq.${tripId}`);
  });

  test('POST /api/itinerary/normalize accepts txt upload', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const res = await request.post('/api/itinerary/normalize', {
      multipart: {
        file: {
          name: 'e2e-trip.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Flight Boston to Lisbon on June 15 2026 returning June 22.'),
        },
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.extracted_text === 'string').toBeTruthy();
    expect(body.proposed).toBeTruthy();
    expect(typeof body.itinerary_hash === 'string').toBeTruthy();
  });

  test('GET /api/trust/retention-policies returns policies for founder', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    test.skip((await founderTier(request, token)) !== 'FOUNDER', 'FOUNDER tier required.');
    const res = await request.get('/api/trust/retention-policies');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.policies)).toBeTruthy();
    expect(body.generated_at).toBeTruthy();
  });

  test('GET /api/platform/posture returns mode', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const res = await request.get('/api/platform/posture');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
    expect(typeof body.mode === 'string').toBeTruthy();
  });

  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
    expect(body.service).toBe('wayfarer-web');
  });

  test('GET /api/focl/notification-settings returns settings for founder', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    test.skip((await founderTier(request, token)) !== 'FOUNDER', 'FOUNDER tier required.');
    const res = await request.get('/api/focl/notification-settings');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeTruthy();
    expect(typeof body.settings.primary_ops_email === 'string').toBeTruthy();
  });

  test('GET /api/focl/erasure-audit returns rows for founder', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    test.skip((await founderTier(request, token)) !== 'FOUNDER', 'FOUNDER tier required.');
    const res = await request.get('/api/focl/erasure-audit');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBeTruthy();
    expect(Array.isArray(body.rows)).toBeTruthy();
  });
});
