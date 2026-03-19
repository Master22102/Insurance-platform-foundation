import { test, expect } from '@playwright/test';
import { ensureOnboarded } from './utils/ensureOnboarded';

const storageStatePath = '.playwright/storageState.json';

test.describe('Navigation smoke (main tabs/routes)', () => {
  test.use({ storageState: storageStatePath });

  test('Trips, Coverage, Upload, Scan, Incidents, Claims load', async ({ page }) => {
    await ensureOnboarded(page);

    const waitForLayoutReady = async () => {
      // The app layout shows this nav link only after `useAuth()` loading=false.
      await page.getByRole('link', { name: /trips/i }).waitFor({ timeout: 60_000 });
    };

    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    await waitForLayoutReady();
    await expect(page.getByRole('heading', { name: /your trips/i })).toBeVisible({ timeout: 30_000 });

    await page.goto('/coverage', { waitUntil: 'domcontentloaded' });
    await waitForLayoutReady();
    await expect(page.getByRole('heading', { name: /coverage/i })).toBeVisible({ timeout: 30_000 });

    await page.goto('/policies/upload', { waitUntil: 'domcontentloaded' });
    await waitForLayoutReady();
    await expect(page.getByRole('heading', { name: /add a policy document/i })).toBeVisible({ timeout: 30_000 });

    await page.goto('/scan', { waitUntil: 'domcontentloaded' });
    await waitForLayoutReady();
    await expect(page.getByRole('heading', { name: /quick scan/i })).toBeVisible({ timeout: 30_000 });

    await page.goto('/incidents', { waitUntil: 'domcontentloaded' });
    await waitForLayoutReady();
    await expect(page.getByRole('heading', { name: /incidents/i })).toBeVisible({ timeout: 30_000 });

    await page.goto('/claims', { waitUntil: 'domcontentloaded' });
    await waitForLayoutReady();
    await expect(page.getByRole('heading', { name: /claims/i })).toBeVisible({ timeout: 30_000 });
  });
});

