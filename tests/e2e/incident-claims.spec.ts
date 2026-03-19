import { test, expect } from '@playwright/test';
import { ensureOnboarded } from './utils/ensureOnboarded';

const storageStatePath = '.playwright/storageState.json';

test.describe('Incidents → Claims (Section 5 in-trip workspace)', () => {
  test.use({ storageState: storageStatePath });
  test('Report an incident → lands on Incident detail and Claims page loads', async ({ page }) => {
    await ensureOnboarded(page);

    await page.getByRole('link', { name: /plan a trip/i }).click();
    await expect(page.getByRole('heading', { name: /plan a trip/i })).toBeVisible();

    await page.getByRole('button', { name: /solo trip/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByRole('button', { name: /enter details manually/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();

    const tripName = `E2E Incident Trip ${new Date().toISOString().slice(0, 16)}`;
    await page.getByPlaceholder('Weekend in Lisbon').fill(tripName);
    await page.getByPlaceholder('Lisbon, Portugal').fill('Lisbon, Portugal');

    await page.getByRole('button', { name: /start planning/i }).click();
    await expect(page.getByText(/trip created/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: /view trip/i }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-fA-F-]+/);

    const tripIdMatch = page.url().match(/\/trips\/([0-9a-fA-F-]+)/);
    expect(tripIdMatch?.[1]).toBeTruthy();
    const tripId = tripIdMatch![1];

    // Ensure we are truly on the created trip detail page.
    await expect(page.getByText(tripName)).toBeVisible({ timeout: 30_000 });
    await page.goto(`/trips/${tripId}/incidents/new`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /what happened\?/i })).toBeVisible();

    await page.getByRole('button', { name: /flight delay/i }).click();

    const incidentTitle = `E2E Flight delay incident ${Date.now()}`;
    await page.getByPlaceholder(/e\.g\. flight delay on portugal trip/i).fill(incidentTitle);

    await page.getByRole('button', { name: /start documenting/i }).click();

    await expect(page.getByRole('heading', { name: incidentTitle })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/next step:/i)).toBeVisible();

    await page.goto('/claims', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /claims/i })).toBeVisible();
    await expect(page.getByText(/no claims yet/i)).toBeVisible();
  });
});

