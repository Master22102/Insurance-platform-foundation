/**
 * Asserts identical `/api/quick-scan` JSON for the same file bytes (itinerary_hash + key fields).
 * For this to run without skipping on 403, the Next server needs either available
 * `scan_credits_remaining` on the test account or `E2E_QUICK_SCAN_SKIP_CREDIT=1`
 * (see tests/e2e/README.md).
 */
import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Quick Scan determinism', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  test('same input returns same structural quick scan output', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/scan', { waitUntil: 'domcontentloaded' }).catch(() => {});

    // If this account has exhausted free scans, determinism cannot be asserted in this environment.
    const atCap = await page.getByText(/you've used your free scans/i).first().isVisible().catch(() => false);
    test.skip(atCap, 'No scan credits remaining for deterministic quick-scan assertion.');

    const sampleText = [
      'TRAVEL POLICY SAMPLE',
      'Trip Delay benefit begins after 6 hours.',
      'Maximum trip delay benefit is 500 USD.',
      'Requires itemized receipts and carrier delay letter.',
      'Claim filing deadline is 30 days.',
    ].join('\n');

    async function runQuickScanPayload() {
      const result = await page.evaluate(async (txt) => {
        const blob = new Blob([txt], { type: 'text/plain' });
        const file = new File([blob], 'quick-scan-determinism.txt', { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/quick-scan', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      }, sampleText);
      return result;
    }

    const first = await runQuickScanPayload();
    const noCredits =
      first.status === 403 &&
      typeof first.data?.error === 'string' &&
      /no scan credits remaining/i.test(first.data.error);
    test.skip(noCredits, 'No scan credits remaining for deterministic assertion in this environment.');

    const second = await runQuickScanPayload();

    expect(first.ok, `first scan failed: ${JSON.stringify(first.data)}`).toBeTruthy();
    expect(second.ok, `second scan failed: ${JSON.stringify(second.data)}`).toBeTruthy();

    expect(first.data.itinerary_hash).toBeTruthy();
    expect(second.data.itinerary_hash).toBeTruthy();
    expect(first.data.itinerary_hash).toBe(second.data.itinerary_hash);

    expect(first.data.quick_scan_tier).toBe('surface');
    expect(second.data.quick_scan_tier).toBe('surface');

    expect(first.data.coverage_categories).toEqual(second.data.coverage_categories);
    expect(first.data.action_plan).toEqual(second.data.action_plan);
    expect(first.data.transit_flags).toEqual(second.data.transit_flags);
    expect(first.data.advisory_summary).toBe(second.data.advisory_summary);
    expect(first.data.detected_locations).toEqual(second.data.detected_locations);
    expect(first.data.stay_hints).toEqual(second.data.stay_hints);
    expect(first.data.raw_rule_count).toBe(second.data.raw_rule_count);
    expect(['high', 'medium', 'low']).toContain(first.data.quality);
    expect(Array.isArray(first.data.action_plan)).toBeTruthy();
    expect(Array.isArray(first.data.transit_flags)).toBeTruthy();
    expect(first.data.action_plan.length).toBeLessThanOrEqual(3);
    expect(first.data.transit_flags.length).toBeLessThanOrEqual(3);
  });
});
