import { test, expect } from '@playwright/test';
import { ensureOnboarded } from './utils/ensureOnboarded';

const storageStatePath = '.playwright/storageState.json';

test.describe('FOCL founder surfaces', () => {
  test.use({ storageState: storageStatePath });

  test('Founder can access feature intelligence and notification destinations', async ({ page }) => {
    await ensureOnboarded(page);

    await page.goto('/focl/features/intelligence', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /feature intelligence/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: /notification destinations/i })).toBeVisible();

    await page.goto('/focl/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /focl notification destinations/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel(/primary operations email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible();
  });
});
