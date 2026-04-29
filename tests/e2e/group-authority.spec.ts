import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Group authority surfaces', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  test('group controls and deep scan gate remain stable under repeated navigation', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});

    // "utilized a lot": repeated route churn to surface guard regressions.
    const routes = ['/trips', '/coverage', '/scan', '/trips'];
    for (let i = 0; i < 3; i++) {
      for (const path of routes) {
        await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    }

    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const groupControlLink = page.getByRole('link', { name: /open group controls/i }).first();
    const hasGroupTrip = await groupControlLink.isVisible().catch(() => false);
    test.skip(!hasGroupTrip, 'No group trip is available in this test account.');

    await groupControlLink.click();
    await expect(page.getByRole('heading', { name: /group authority & participants/i })).toBeVisible();
    await expect(page.getByText(/organizer controls coordination only/i).first()).toBeVisible();
    await expect(page.getByText(/missing residence profiles/i).first()).toBeVisible();
  });
});

