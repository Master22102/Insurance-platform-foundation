import { test, expect } from '@playwright/test';
import { ensureOnboarded } from './utils/ensureOnboarded';

const storageStatePath = '.playwright/storageState.json';

test.describe('Core product flow (Section 5)', () => {
  test.use({ storageState: storageStatePath });

  test('Trips page loads (authenticated)', async ({ page }) => {
    await ensureOnboarded(page);
  });

  test('Create a trip (manual entry)', async ({ page }) => {
    await ensureOnboarded(page);
    await page.getByRole('link', { name: /plan a trip/i }).click();

    await expect(page.getByRole('heading', { name: /plan a trip/i })).toBeVisible();

    // Step: choose solo/group
    await page.getByRole('button', { name: /solo trip/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();

    // Step: choose build method
    await page.getByRole('button', { name: /enter details manually/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();

    const tripName = `E2E Trip ${new Date().toISOString().slice(0, 16)}`;
    await page.getByPlaceholder('Weekend in Lisbon').fill(tripName);
    await page.getByPlaceholder('Lisbon, Portugal').fill('Lisbon, Portugal');

    // "Start planning" triggers create_trip() RPC.
    await page.getByRole('button', { name: /start planning/i }).click();

    // Expect "Trip created" confirmation, then view trip.
    await expect(page.getByText(/trip created/i)).toBeVisible();
    await page.getByRole('link', { name: /view trip/i }).click();

    await expect(page).toHaveURL(/\/trips\/[^/]+/);
    await expect(page.getByText(tripName)).toBeVisible();
  });
});

