import { test, expect } from '@playwright/test';
import { ensureOnboarded } from './utils/ensureOnboarded';

const storageStatePath = '.playwright/storageState.json';

test.describe('Trips (narrate path, Section 4D.1 voice equivalent)', () => {
  test.use({ storageState: storageStatePath });

  test('Describe your trip → Parse itinerary → autopopulates fields → Trip created', async ({ page }) => {
    await ensureOnboarded(page);

    await page.getByRole('link', { name: /plan a trip/i }).click();
    await expect(page.getByRole('heading', { name: /plan a trip/i })).toBeVisible();

    await page.getByRole('button', { name: /solo trip/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();

    await page.getByRole('button', { name: /describe your trip/i }).click();

    const narration = `I'm traveling to Paris on June 12th 2026, returning June 16th 2026. Visiting museums and markets.`;
    await page.getByPlaceholder(/e\.g\. flying to/i).fill(narration);

    await page.getByRole('button', { name: /parse itinerary/i }).click();
    await expect(page.getByText(/details extracted/i)).toBeVisible();

    // Destination + dates should be auto-filled from narration.
    await expect(page.locator('input[placeholder="Lisbon, Portugal"]').first()).toHaveValue(/Paris/i);
    await expect(page.locator('input[type="date"]').nth(0)).toHaveValue('2026-06-12');
    await expect(page.locator('input[type="date"]').nth(1)).toHaveValue('2026-06-16');

    await page.getByRole('button', { name: /start planning/i }).click();
    await expect(page.getByText(/trip created/i)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: /view trip/i }).click();
    await expect(page).toHaveURL(/\/trips\/[^/]+/);
    // Trip title is of the form "Paris on June 2026" from narration parsing.
    await expect(page.getByRole('heading', { name: /Paris on/i })).toBeVisible();
  });
});

