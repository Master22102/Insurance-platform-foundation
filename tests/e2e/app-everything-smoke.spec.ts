import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('App everything smoke (authenticated)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('core tabs/pages load with visible confirmation headings', async ({ page }) => {
    await ensureOnboarded(page);

    const checks: Array<{ path: string; assert: () => Promise<void> }> = [
      {
        path: '/trips',
        assert: async () => {
          await Promise.race([
            expect(page.getByRole('heading', { name: /your trips|trips/i }).first()).toBeVisible({ timeout: 30_000 }),
            expect(page.getByRole('link', { name: /plan a trip/i }).first()).toBeVisible({ timeout: 30_000 }),
            expect(page.getByRole('link', { name: /^trips$/i }).first()).toBeVisible({ timeout: 30_000 }),
          ]);
        },
      },
      { path: '/coverage', assert: async () => expect(page.getByRole('heading', { name: /coverage/i }).first()).toBeVisible({ timeout: 30_000 }) },
      { path: '/policies/upload', assert: async () => expect(page.getByRole('heading', { name: /add a policy document|upload|policy/i }).first()).toBeVisible({ timeout: 30_000 }) },
      { path: '/scan', assert: async () => expect(page.getByRole('heading', { name: /quick scan/i }).first()).toBeVisible({ timeout: 30_000 }) },
      { path: '/incidents', assert: async () => expect(page.getByRole('heading', { name: /incidents/i }).first()).toBeVisible({ timeout: 30_000 }) },
      { path: '/claims', assert: async () => expect(page.getByRole('heading', { name: /claims/i }).first()).toBeVisible({ timeout: 30_000 }) },
      { path: '/account', assert: async () => expect(page.getByRole('heading', { name: /account|membership|profile/i }).first()).toBeVisible({ timeout: 30_000 }) },
    ];

    for (const check of checks) {
      await page.goto(check.path, { waitUntil: 'domcontentloaded' });
      if (page.url().includes('/onboarding') || page.url().includes('/get-started')) {
        await ensureOnboarded(page);
        await page.goto(check.path, { waitUntil: 'domcontentloaded' });
      }
      if (page.url().includes('/onboarding') || page.url().includes('/get-started')) {
        await ensureOnboarded(page);
        await page.goto(check.path, { waitUntil: 'domcontentloaded' });
      }
      await check.assert();
    }
  });
});

