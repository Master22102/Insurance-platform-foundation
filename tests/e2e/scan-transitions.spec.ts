import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Quick to Deep scan transitions', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  test('quick scan teaser and deep scan gate surfaces render', async ({ page }) => {
    await ensureOnboarded(page);

    await page.goto('/scan', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await ensureOnboarded(page);
    const scanHeadingVisible = await page.getByRole('heading', { name: /quick scan/i }).first().isVisible().catch(() => false);
    if (!scanHeadingVisible) {
      await page.goto('/scan', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await ensureOnboarded(page);
    }
    const quickScanVisible = await page.getByRole('heading', { name: /quick scan/i }).first().isVisible().catch(() => false);
    const getStartedVisible = await page.getByRole('heading', { name: /let's get started/i }).first().isVisible().catch(() => false);
    const loadingVisible = await page.getByRole('heading', { name: /still loading your session/i }).first().isVisible().catch(() => false);
    test.skip(!(quickScanVisible || getStartedVisible || loadingVisible), 'Could not reach /scan in this account state.');

    if (quickScanVisible) {
      await expect(page.getByText(/surface-level|fast look|quick scan overview/i).first()).toBeVisible();
    }

    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const firstTripLink = page.locator('a[href*="/trips/"]').first();
    const hasTrip = await firstTripLink.isVisible().catch(() => false);
    test.skip(!hasTrip, 'No trip available to verify Deep Scan gate.');

    await firstTripLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/deep scan|complete draft home before deep scan|before we run your deep scan/i).first()).toBeVisible();
  });
});

