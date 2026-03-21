import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Readiness pins', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('renders and keeps checklist interactions after reload', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});

    const draftLink = page.locator('a[href*="/trips/"]').first();
    const canOpenTrip = await draftLink.isVisible().catch(() => false);
    test.skip(!canOpenTrip, 'No trip available for readiness test in this account.');

    await draftLink.click();
    await page.waitForLoadState('domcontentloaded');

    const openChecklist = page.getByRole('link', { name: /open checklist/i }).first();
    await expect(openChecklist).toBeVisible();
    await openChecklist.click();
    await expect(page.getByRole('heading', { name: /entry & documentation checklist/i })).toBeVisible();

    const firstUpdate = page.getByRole('button', { name: /update status/i }).first();
    await firstUpdate.click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /entry & documentation checklist/i })).toBeVisible();
    await expect(page.getByText(/in progress|ready|not started/i).first()).toBeVisible();
  });
});

