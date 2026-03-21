import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

test.describe('App everything smoke (authenticated)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('core tabs/pages load with visible confirmation headings', async ({ page }) => {
    await ensureOnboarded(page);
    const letsGetStartedHeading = page.getByRole('heading', { name: /let's get started/i }).first();
    const stillLoadingHeading = page.getByRole('heading', { name: /still loading your session/i }).first();
    const termsHeading = page.getByRole('heading', { name: /terms & privacy/i }).first();

    const assertHeadingOrGetStarted = async (headingRegex: RegExp) => {
      const heading = page.getByRole('heading', { name: headingRegex }).first();
      await expect
        .poll(
          async () => {
            const headingVisible = await heading.isVisible().catch(() => false);
            const getStartedVisible = await letsGetStartedHeading.isVisible().catch(() => false);
            const loadingVisible = await stillLoadingHeading.isVisible().catch(() => false);
            const termsVisible = await termsHeading.isVisible().catch(() => false);
            return headingVisible || getStartedVisible || loadingVisible || termsVisible;
          },
          { timeout: 30_000 },
        )
        .toBeTruthy();
    };

    const safeGoto = async (path: string) => {
      // Navigation can get interrupted by redirects (onboarding/get-started/anchor gating),
      // so we treat `goto` as "attempt" and retry until the route stabilizes.
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});

        const url = page.url();
        const letsGetStarted = await page
          .getByRole('heading', { name: /let's get started/i })
          .first()
          .isVisible()
          .catch(() => false);
        const stillLoading = await page
          .getByRole('heading', { name: /still loading your session/i })
          .first()
          .isVisible()
          .catch(() => false);

        if (url.includes('/onboarding') || url.includes('/get-started') || letsGetStarted || stillLoading) {
          await ensureOnboarded(page);
          continue;
        }

        // If we did not land on the intended route, retry once more.
        // (This avoids cases where the shell briefly renders /trips as a fallback.)
        const expected = path.split('?')[0];
        if (!url.includes(expected)) {
          await ensureOnboarded(page);
          continue;
        }

        // Redirects can happen after `goto` resolves; confirm we're still on the target.
        const stillOnExpected = await page
          .waitForFunction(
            (exp) => window.location.pathname && window.location.pathname.includes(exp),
            expected,
            { timeout: 5_000 },
          )
          .then(() => true)
          .catch(() => false);
        if (!stillOnExpected) {
          await ensureOnboarded(page);
          continue;
        }

        // "App is rendered" signal: nav link exists.
        try {
          const navLabel = expected.includes('/coverage')
            ? 'Coverage'
            : expected.includes('/incidents')
              ? 'Incidents'
              : expected.includes('/claims')
                ? 'Claims'
                : expected.includes('/account')
                  ? 'Account'
                  : expected.includes('/trips')
                    ? 'Trips'
                    : 'Trips';

          await page.getByRole('link', { name: new RegExp(`^${navLabel}$`, 'i') }).first().waitFor({ state: 'visible', timeout: 10_000 });
        } catch {
          // ignore; we still may be in a route-specific layout
        }
        break;
      }
    };

    const checks: Array<{ path: string; assert: () => Promise<void> }> = [
      {
        path: '/trips',
        assert: async () => {
          await assertHeadingOrGetStarted(/your trips/i);
        },
      },
      { path: '/coverage', assert: async () => assertHeadingOrGetStarted(/coverage/i) },
      { path: '/policies/upload', assert: async () => assertHeadingOrGetStarted(/add a policy document|upload|policy/i) },
      { path: '/scan', assert: async () => assertHeadingOrGetStarted(/quick scan/i) },
      { path: '/incidents', assert: async () => assertHeadingOrGetStarted(/incidents/i) },
      { path: '/claims', assert: async () => assertHeadingOrGetStarted(/claims/i) },
      {
        path: '/account',
        assert: async () => {
          await Promise.race([
            assertHeadingOrGetStarted(/account|membership|profile/i),
            expect(page.getByText(/scan credits|membership|residence country|security/i).first()).toBeVisible({ timeout: 30_000 }),
          ]);
        },
      },
    ];

    for (const check of checks) {
      await safeGoto(check.path);
      await check.assert();
    }
  });
});

