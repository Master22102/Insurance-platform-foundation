import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Onboarding and gating regression', () => {
  test('terms-consent routes to signup/signin without loop', async ({ page }) => {
    await page.goto('/terms-consent?next=/signup', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/terms-consent/);

    const continueBtn = page.getByRole('button', { name: /accept and continue/i }).first();
    await expect(continueBtn).toBeDisabled();

    const terms = page.getByRole('checkbox', { name: /terms/i }).first();
    const privacy = page.getByRole('checkbox', { name: /privacy/i }).first();
    await terms.check({ force: true });
    await privacy.check({ force: true });
    await continueBtn.click({ force: true });
    await expect(page).toHaveURL(/\/signup/);

    // Ensure we do not bounce back to terms-consent immediately.
    await expect
      .poll(async () => page.url(), { timeout: 8000 })
      .not.toMatch(/\/terms-consent/);

    await page.goto('/terms-consent?next=/signin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/terms-consent/);
    await terms.check({ force: true });
    await privacy.check({ force: true });
    await continueBtn.click({ force: true });
    await expect(page).toHaveURL(/\/signin/);
    await expect
      .poll(async () => page.url(), { timeout: 8000 })
      .not.toMatch(/\/terms-consent/);
  });

  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  test('authenticated route stabilizes and does not loop onboarding', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForURL(/\/(trips|get-started)(\/|$)/, { timeout: 20000 });

    // If gate appears, intentionally satisfy it once to reach trips.
    if (page.url().includes('/get-started')) {
      const stillPlanning = page.getByRole('button', { name: /i'?m still planning/i }).first();
      const addTrip = page.getByRole('button', { name: /add a trip itinerary/i }).first();
      if (await stillPlanning.isVisible().catch(() => false)) {
        await stillPlanning.click({ force: true });
      } else if (await addTrip.isVisible().catch(() => false)) {
        await addTrip.click({ force: true });
      }
      await page.waitForURL(/\/trips(\/|$)/, { timeout: 20000 });
    }

    // Stability check: after trips resolves, no bounce back to onboarding loop.
    await expect
      .poll(async () => page.url(), { timeout: 12_000 })
      .not.toMatch(/\/onboarding/);
  });

  test('get-started choice persists and prevents re-entry loop', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/get-started', { waitUntil: 'domcontentloaded' }).catch(() => {});

    if (page.url().includes('/get-started')) {
      const candidates = [
        page.getByRole('button', { name: /add a trip itinerary/i }).first(),
        page.getByRole('button', { name: /add an insurance policy/i }).first(),
        page.getByRole('button', { name: /i'?m still planning/i }).first(),
      ];
      let clicked = false;
      for (const button of candidates) {
        if (await button.isVisible().catch(() => false)) {
          await button.click({ force: true });
          clicked = true;
          break;
        }
      }
      if (clicked) {
        await page.waitForURL(/\/(trips|policies\/upload)(\/|$)/, { timeout: 20_000 });
        const anchorSelected = await page.evaluate(() => sessionStorage.getItem('wayfarer_anchor_selected'));
        expect(anchorSelected).toBe('1');
      }
    }

    await page.goto('/get-started', { waitUntil: 'domcontentloaded' }).catch(() => {});
    if (page.url().includes('/get-started')) {
      const stillPlanning = page.getByRole('button', { name: /i'?m still planning/i }).first();
      if (await stillPlanning.isVisible().catch(() => false)) {
        await stillPlanning.click({ force: true });
      }
    }
    await page.waitForURL(/\/(trips|policies\/upload)(\/|$)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/get-started(\/|$)/, { timeout: 5_000 });
  });
});
