import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
} from './utils/supabaseRest';

const skipLive =
  process.env.SKIP_LIVE_TESTS === '1' || process.env.SKIP_LIVE_TESTS === 'true';

test.describe('FOCL corpus API — unauthenticated', () => {
  test('POST /api/focl/corpus/acquire returns 401 without session', async ({ request }) => {
    const res = await request.post('/api/focl/corpus/acquire', {
      data: { source_id: 'eu261' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/focl/corpus/status returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/focl/corpus/status');
    expect(res.status()).toBe(401);
  });
});

test.describe('FOCL corpus API — founder session', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.use({ storageState: getStorageStatePath() });

  test('founder POST invalid source_id returns 400', async ({ request }) => {
    test.skip(skipLive, 'SKIP_LIVE_TESTS set — skipping founder corpus API checks.');
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const rows = await supabaseRestSelect<Array<{ membership_tier: string }>>(
      request,
      token,
      'user_profiles',
      'select=membership_tier&limit=1',
    );
    test.skip(rows[0]?.membership_tier !== 'FOUNDER', 'E2E user is not FOUNDER — skip FOCL corpus contract.');

    const res = await request.post('/api/focl/corpus/acquire', {
      data: { source_id: 'BAD-ID!!!' },
    });
    expect(res.status()).toBe(400);
    const j = await res.json();
    expect(j.ok).toBeFalsy();
  });

  test('founder GET /api/focl/corpus/status returns structured JSON', async ({ request }) => {
    test.skip(skipLive, 'SKIP_LIVE_TESTS set — skipping founder corpus API checks.');
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const rows = await supabaseRestSelect<Array<{ membership_tier: string }>>(
      request,
      token,
      'user_profiles',
      'select=membership_tier&limit=1',
    );
    test.skip(rows[0]?.membership_tier !== 'FOUNDER', 'E2E user is not FOUNDER — skip FOCL corpus contract.');

    const res = await request.get('/api/focl/corpus/status');
    expect([200, 503].includes(res.status())).toBeTruthy();
    const j = await res.json();
    expect(typeof j.ok).toBe('boolean');
    if (res.status() === 200 && j.ok) {
      expect(Array.isArray(j.sources)).toBeTruthy();
    }
    if (res.status() === 503) {
      expect(j.error).toBeTruthy();
    }
  });
});
