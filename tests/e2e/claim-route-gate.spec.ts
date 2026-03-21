import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

/**
 * Browser smoke: claim routing page must not render for non-ready / missing incidents.
 * Full happy path remains RPC-heavy (`claim-packet-contract.spec.ts`).
 */
test.describe('Claim route page gate (browser)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('does not stay on /route for unlikely UUIDs (redirects to incident or trips)', async ({ page }) => {
    test.setTimeout(120_000);
    await ensureOnboarded(page);

    const fakeTrip = '00000000-0000-4000-8000-000000000001';
    const fakeInc = '00000000-0000-4000-8000-000000000002';
    await page.goto(`/trips/${fakeTrip}/incidents/${fakeInc}/route`, { waitUntil: 'domcontentloaded' });

    await expect
      .poll(
        async () => {
          const u = page.url();
          return !u.includes(`/incidents/${fakeInc}/route`);
        },
        { timeout: 35_000 },
      )
      .toBeTruthy();

    const routeHeading = page.getByRole('heading', { name: /route this claim/i });
    await expect(routeHeading).toBeHidden();
  });
});
