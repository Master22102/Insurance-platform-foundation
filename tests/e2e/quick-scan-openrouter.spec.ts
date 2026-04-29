import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('Quick Scan OpenRouter', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!process.env.OPENROUTER_API_KEY, 'Set OPENROUTER_API_KEY for OpenRouter-backed quick scan assertions.');
  test.use({ storageState: getStorageStatePath() });

  test('POST /api/quick-scan returns rules, action plan, and confidence', async ({ page }) => {
    await ensureOnboarded(page);

    const sampleText = [
      'TRAVEL POLICY SAMPLE',
      'Trip Delay benefit begins after 6 hours.',
      'Maximum trip delay benefit is 500 USD.',
      'Requires itemized receipts and carrier delay letter.',
      'Claim filing deadline is 30 days.',
    ].join('\n');

    const payload = await page.evaluate(async (txt) => {
      const blob = new Blob([txt], { type: 'text/plain' });
      const file = new File([blob], 'quick-scan-openrouter.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/quick-scan', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }, sampleText);

    const noCredits =
      payload.status === 403 &&
      typeof payload.data?.error === 'string' &&
      /no scan credits remaining/i.test(payload.data.error);
    test.skip(noCredits, 'No scan credits remaining for this account.');

    expect(payload.ok, JSON.stringify(payload.data)).toBeTruthy();
    expect(Array.isArray(payload.data.promotedRules)).toBeTruthy();
    expect(payload.data.promotedRules.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.data.action_plan) || Array.isArray(payload.data.actionPlan)).toBeTruthy();
    const plan = payload.data.action_plan ?? payload.data.actionPlan;
    expect(Array.isArray(plan)).toBeTruthy();
    expect(payload.data.confidence?.confidence_label).toBeTruthy();
    expect(payload.data.confidence?.confidence_version).toBeTruthy();
  });
});
