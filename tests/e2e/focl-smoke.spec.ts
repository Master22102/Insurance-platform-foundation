import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
} from './utils/supabaseRest';

const FOCL_PATHS = [
  '/focl',
  '/focl/attention',
  '/focl/status',
  '/focl/features',
  '/focl/features/intelligence',
  '/focl/inbox',
  '/focl/financials',
  '/focl/ops',
  '/focl/readiness',
  '/focl/notifications',
  '/focl/compliance',
  '/focl/security',
  '/focl/ai-monitor',
];

test.describe('FOCL smoke', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.use({ storageState: getStorageStatePath() });

  test('FOCL routes load for FOUNDER', async ({ page, request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const rows = await supabaseRestSelect<Array<{ membership_tier: string }>>(
      request,
      token,
      'user_profiles',
      'select=membership_tier&limit=1',
    );
    test.skip(rows[0]?.membership_tier !== 'FOUNDER', 'E2E user is not FOUNDER — skip FOCL load test.');
    for (const path of FOCL_PATHS) {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
      expect(page.url()).not.toMatch(/\/signin/);
    }
  });

  test('non-founder visiting /focl lands on /trips or sign-in', async ({ page, request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const rows = await supabaseRestSelect<Array<{ membership_tier: string }>>(
      request,
      token,
      'user_profiles',
      'select=membership_tier&limit=1',
    );
    test.skip(rows[0]?.membership_tier === 'FOUNDER', 'Founder account — use non-founder to assert redirect.');
    await page.goto('/focl', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForURL(/\/(trips|signin)/, { timeout: 20_000 });
  });
});
