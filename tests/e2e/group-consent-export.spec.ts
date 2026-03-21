import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Group consent and export controls', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('group controls surface dual-approval and export sections', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});

    const controls = page.getByRole('link', { name: /open group controls/i }).first();
    const hasGroup = await controls.isVisible().catch(() => false);
    test.skip(!hasGroup, 'No group trip available for this account state.');

    await controls.click();
    await expect(page.getByRole('heading', { name: /group authority & participants/i })).toBeVisible();
    await expect(page.getByText(/minor account \(guardian also required\)/i)).toBeVisible();
    await expect(page.getByText(/exports are never implicit/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /revoke export/i })).toBeVisible();
    await expect(page.getByText(/verification requests/i)).toBeVisible();
  });
});

