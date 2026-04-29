import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { getE2eProjectRoot } from './authState';
import { waitForPolicyUploadTerminal } from './policyUploadExtraction';

export function step4TxtFixturePath(): string {
  return path.join(getE2eProjectRoot(), 'document-intelligence', 'American Airlines Conditions of Carriage.txt');
}

/**
 * Upload a TXT fixture on `/policies/upload` and wait for processed UI (see `E2E_EXTRACTION_SYNC` on Next server).
 */
export async function uploadTxtPolicyAndWaitProcessed(
  page: Page,
  opts: { tripId?: string | null; label: string },
): Promise<void> {
  const q = opts.tripId ? `?trip_id=${opts.tripId}` : '';
  await page.goto(`/policies/upload${q}`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/chase sapphire/i).fill(opts.label);
  await page.locator('input[type="file"]').setInputFiles(step4TxtFixturePath());
  await page.getByRole('button', { name: /upload and review/i }).click();
  await waitForPolicyUploadTerminal(page);
}

/**
 * From trip home → Coverage tab → confirm credit → Run Deep Scan → wait for completion.
 * Requires Playwright webServer env **`NEXT_PUBLIC_E2E_DEEP_SCAN_AUTOCOMPLETE`** + **`E2E_DEEP_SCAN_AUTOCOMPLETE`** (see `playwright.config.ts`).
 */
export async function runDeepScanFromTripCoverageTab(page: Page, tripId: string): Promise<void> {
  await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(new RegExp(`/trips/${tripId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: /^coverage$/i }).click();
  await page.locator('label:has-text("Deep Scan credit") input[type="checkbox"]').check();
  await page.getByRole('button', { name: /run deep scan/i }).click();
  await expect(page.getByText(/deep scan complete/i)).toBeVisible({ timeout: 120_000 });
}
