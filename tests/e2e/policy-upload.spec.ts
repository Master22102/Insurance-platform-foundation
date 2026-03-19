import { test, expect } from '@playwright/test';
import path from 'node:path';
import { ensureOnboarded } from './utils/ensureOnboarded';

const storageStatePath = '.playwright/storageState.json';

test.describe('Policy upload', () => {
  test.use({ storageState: storageStatePath });

  test('Create trip → upload policy PDF starts processing', async ({ page }) => {
    await ensureOnboarded(page);

    await page.getByRole('link', { name: /plan a trip/i }).click();
    await expect(page.getByRole('heading', { name: /plan a trip/i })).toBeVisible();

    // Current UI requires picking trip type first.
    await page.getByRole('button', { name: /solo trip/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByRole('button', { name: /enter details manually/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    const tripName = `E2E Trip — Policy Upload ${new Date().toISOString().slice(0, 16)}`;
    await page.getByPlaceholder('Weekend in Lisbon').fill(tripName);
    await page.getByPlaceholder('Lisbon, Portugal').fill('Lisbon, Portugal');
    await page.getByRole('button', { name: /start planning/i }).click();

    await expect(page.getByText(/trip created/i)).toBeVisible({ timeout: 30_000 });

    const addPolicyLink = page.getByRole('link', { name: /add a policy/i });
    const href = await addPolicyLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!).toContain('trip_id=');

    await addPolicyLink.click();
    await expect(page).toHaveURL(/\/policies\/upload\?trip_id=/);

    await expect(page.getByRole('heading', { name: /add a policy document/i })).toBeVisible();

    await page.getByPlaceholder(/chase sapphire reserve/i).fill('E2E Policy Upload — ACIS');

    const pdfPath = path.join(process.cwd(), 'document-intelligence', '2026-2027-ACIS-International-Protection-Plans.pdf');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole('button', { name: /upload and extract/i }).click();

    await expect(page.getByText(/processing your document/i)).toBeVisible({ timeout: 30_000 });

    // We don't require extraction completion in E2E because the async worker may be offline in dev.
    // We do require that we remain in a non-error processing state.
    await expect(page.getByText(/something went wrong during the upload/i)).toHaveCount(0);
    await expect(page.getByText(/we had trouble reading this document/i)).toHaveCount(0);
  });
});



