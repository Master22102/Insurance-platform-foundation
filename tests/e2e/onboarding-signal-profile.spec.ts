import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { hasServiceRoleKey } from './utils/e2eEnv';
import {
  completeSignalOnboardingWithTypedNarration,
  markOnboardingComplete,
  reopenOnboarding,
} from './utils/onboardingSignalProfile.e2e';
import { ensureOnboarded, recoverSessionLoadingIfPresent } from './utils/ensureOnboarded';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
} from './utils/supabaseRest';

const NARR =
  'Lisbon and Porto for museums, hiking in Sintra, seafood and wine tasting, solo backpacking style.';

test.describe('Onboarding signal profile', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'SUPABASE_SERVICE_ROLE_KEY required to reopen onboarding for E2E.');
  test.use({ storageState: getStorageStatePath() });

  test('onboarding shows Terms and Conditions (capitalized)', async ({ page, request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const userId = me[0]?.user_id;
    test.skip(!userId, 'No profile');
    await reopenOnboarding(request, userId);
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await recoverSessionLoadingIfPresent(page);
    await expect(page.getByRole('heading', { name: /Terms and Conditions/i })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/Terms and Conditions/i).first()).toBeVisible();
    await markOnboardingComplete(request, userId);
  });

  test('signal capture shows category cards after typed narration', async ({ page, request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const userId = me[0]?.user_id;
    test.skip(!userId, 'No profile');
    await reopenOnboarding(request, userId);
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await recoverSessionLoadingIfPresent(page);
    await expect(page.getByRole('heading', { name: /Terms and Conditions/i })).toBeVisible({ timeout: 25_000 });
    await page.locator('label').filter({ hasText: /Terms and Conditions/i }).click();
    await page.locator('label').filter({ hasText: /Privacy Policy/i }).click();
    await page.getByRole('button', { name: /Accept and continue/i }).click();
    await page.getByRole('button', { name: /Type instead/i }).click();
    await page.getByPlaceholder(/e.g. I want help/i).fill(NARR);
    await page.getByRole('button', { name: /Preview summary/i }).click();
    await expect(page.getByRole('button', { name: /Places/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Activities/i }).first()).toBeVisible();
    await markOnboardingComplete(request, userId);
  });

  test('confirmed signal data saved to preferences.signal_profile', async ({ page, request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const userId = me[0]?.user_id;
    test.skip(!userId, 'No profile');
    await reopenOnboarding(request, userId);
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await recoverSessionLoadingIfPresent(page);
    await completeSignalOnboardingWithTypedNarration(page, NARR);
    const rows = await supabaseRestSelect<Array<{ preferences: { signal_profile?: Record<string, unknown> } }>>(
      request,
      token,
      'user_profiles',
      'select=preferences&limit=1',
    );
    const sp = rows[0]?.preferences?.signal_profile;
    expect(sp).toBeTruthy();
    expect(Array.isArray(sp?.places)).toBeTruthy();
    expect(Array.isArray(sp?.activities)).toBeTruthy();
    expect(Array.isArray(sp?.food_interests)).toBeTruthy();
    expect(typeof sp?.travel_style === 'string').toBeTruthy();
  });

  test('account page shows Travel Profile section', async ({ page }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await expect(page.getByText(/Travel Profile/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Lisbon/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('trip creation shows destination chips from signal_profile.places', async ({ page, request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    await ensureOnboarded(page);
    await page.goto('/trips/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    const continueBtn = page.getByRole('button', { name: /^Continue$/i });
    await expect(continueBtn.first()).toBeVisible({ timeout: 30_000 });
    await continueBtn.first().click();
    await continueBtn.first().click();
    await expect(page.getByRole('heading', { name: /Review your trip/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Based on your interests/i)).toBeVisible({ timeout: 25_000 });
    const rows = await supabaseRestSelect<Array<{ preferences: { signal_profile?: { places?: string[] } } }>>(
      request,
      token,
      'user_profiles',
      'select=preferences&limit=1',
    );
    const places = rows[0]?.preferences?.signal_profile?.places?.filter(Boolean) ?? [];
    expect(places.length, 'signal_profile.places should be set by prior onboarding test').toBeGreaterThan(0);
    const pattern = new RegExp(places.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
    await expect(page.getByRole('button', { name: pattern }).first()).toBeVisible({ timeout: 20_000 });
  });
});
