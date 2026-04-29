import { expect, type Page } from '@playwright/test';

/**
 * Client auth sometimes never leaves "Still loading your session" (storage / cookie timing in CI).
 * Prefer **Retry loading** (web-first) instead of assuming the next screen is already there.
 */
export async function recoverSessionLoadingIfPresent(page: Page, maxAttempts = 4) {
  const stillLoading = page.getByRole('heading', { name: /still loading your session/i });
  const retry = page.getByRole('button', { name: /retry loading/i });
  for (let i = 0; i < maxAttempts; i++) {
    if (!(await stillLoading.isVisible().catch(() => false))) return;
    await retry.click({ force: true, timeout: 10_000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await expect(stillLoading).toBeHidden({ timeout: 30_000 }).catch(() => {});
  }
}

function pathnameNoTrailing(u: string): string {
  try {
    const p = new URL(u).pathname.replace(/\/$/, '') || '/';
    return p;
  } catch {
    return '/';
  }
}

/**
 * Dismiss a Terms / Privacy gate (onboarding shell or account overlay).
 * Mirrors the stable pattern in onboarding E2Es: label clicks + checkbox fallback + web-first enabled check.
 */
export async function acceptTermsGateIfPresent(page: Page) {
  const termsHeading = page.getByRole('heading', { name: /terms and conditions/i });
  const acceptBtn = page.getByRole('button', { name: /accept and continue/i }).first();

  const gateLikely =
    (await termsHeading.isVisible({ timeout: 2_000 }).catch(() => false)) ||
    (await acceptBtn.isVisible({ timeout: 2_000 }).catch(() => false));
  if (!gateLikely) return;

  await page.locator('label').filter({ hasText: /Terms and Conditions/i }).first().click().catch(() => {});
  await page.locator('label').filter({ hasText: /Privacy Policy/i }).first().click().catch(() => {});

  const termsCb = page.getByRole('checkbox', { name: /terms/i }).first();
  const privacyCb = page.getByRole('checkbox', { name: /privacy/i }).first();
  if (await termsCb.isVisible().catch(() => false)) {
    if (!(await termsCb.isChecked().catch(() => false))) {
      await termsCb.check({ force: true, timeout: 8_000 });
    }
  }
  if (await privacyCb.isVisible().catch(() => false)) {
    if (!(await privacyCb.isChecked().catch(() => false))) {
      await privacyCb.check({ force: true, timeout: 8_000 });
    }
  }

  await expect(acceptBtn).toBeEnabled({ timeout: 20_000 });
  await acceptBtn.click({ timeout: 12_000 });
  await expect(acceptBtn).toBeHidden({ timeout: 25_000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

export type GotoAuthPathOptions = {
  /** Default: skip dismissing terms when navigating to `/onboarding` (specs assert that screen). */
  dismissTermsGate?: boolean;
};

/**
 * `page.goto` plus recovery for aborted navigations (Firefox) and shared-user races where
 * `reopenOnboarding` redirects to `/onboarding` while another spec navigates to a protected path.
 */
export async function gotoAuthPathWithRecovery(page: Page, path: string, options?: GotoAuthPathOptions) {
  const want = pathnameNoTrailing(
    path.startsWith('http') ? path : `http://local.invalid${path.startsWith('/') ? path : `/${path}`}`,
  );
  const onOnboardingUrl = want === '/onboarding' || want.startsWith('/onboarding/');
  const dismissTerms = options?.dismissTermsGate ?? !onOnboardingUrl;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    await recoverSessionLoadingIfPresent(page);
    if (dismissTerms) {
      await acceptTermsGateIfPresent(page);
    }

    const cur = pathnameNoTrailing(page.url());
    if (cur.includes('/onboarding') && !onOnboardingUrl) {
      await ensureOnboarded(page);
      continue;
    }

    if (cur === want || cur.startsWith(`${want}/`)) {
      return;
    }
  }

  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
}

export async function ensureOnboarded(page: Page) {
  const letsGetStartedHeading = page.getByRole('heading', { name: /let's get started/i });
  const addTripItineraryAction = page.getByRole('button', { name: /add a trip itinerary/i });
  const stillPlanningAction = page.getByRole('button', { name: /i'?m still planning/i });
  const tripsNavLink = page.getByRole('link', { name: /^trips$/i }).first();

  const stillLoadingHeading = page.getByRole('heading', { name: /still loading your session/i }).first();

  const completeOnboardingIfVisible = async () => {
    const acceptBtn = page.getByRole('button', { name: /accept and continue/i }).first();

    const skipBtn = page.getByRole('button', { name: /skip for now/i }).first();
    const expectationsHeading = page.getByRole('heading', { name: /what are your expectations\??/i }).first();

    // Terms step (label clicks + enabled — matches onboarding E2Es)
    if (await acceptBtn.isVisible().catch(() => false)) {
      await page.locator('label').filter({ hasText: /Terms and Conditions/i }).first().click().catch(() => {});
      await page.locator('label').filter({ hasText: /Privacy Policy/i }).first().click().catch(() => {});
      const termsByRole = page.getByRole('checkbox', { name: /terms/i }).first();
      const privacyByRole = page.getByRole('checkbox', { name: /privacy/i }).first();
      if (await termsByRole.isVisible().catch(() => false) && !(await termsByRole.isChecked().catch(() => false))) {
        await termsByRole.check({ force: true, timeout: 6_000 }).catch(() => {});
      }
      if (await privacyByRole.isVisible().catch(() => false) && !(await privacyByRole.isChecked().catch(() => false))) {
        await privacyByRole.check({ force: true, timeout: 6_000 }).catch(() => {});
      }
      await expect(acceptBtn).toBeEnabled({ timeout: 15_000 });
      await acceptBtn.click({ force: true, timeout: 8_000 }).catch(() => {});
      await page
        .waitForURL(/\/(onboarding|get-started|trips)/, { timeout: 10_000 })
        .catch(() => {});
      return;
    }

    // Skip step
    if ((await skipBtn.isVisible().catch(() => false)) || (await expectationsHeading.isVisible().catch(() => false))) {
      await skipBtn.click({ force: true, timeout: 5_000 }).catch(() => {});
      await page.waitForURL(/\/(get-started|trips)/, { timeout: 10_000 }).catch(() => {});
    }
  };

  const recoverFromLoadingTimeout = async () => {
    if (await stillLoadingHeading.isVisible().catch(() => false)) {
      await recoverSessionLoadingIfPresent(page, 2);
      return true;
    }
    return false;
  };

  const chooseGetStartedDestination = async () => {
    // Anchor gating checks sessionStorage; set it explicitly to keep the flow unblocked.
    await page.evaluate(() => {
      try {
        window.sessionStorage.setItem('wayfarer_anchor_selected', '1');
      } catch {
        // ignore
      }
    }).catch(() => {});

    if (await stillPlanningAction.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL(/\/trips(\/|$)/, { timeout: 30_000 }),
        stillPlanningAction.click({ force: true, timeout: 30_000 }),
      ]);
      return;
    }

    if (await addTripItineraryAction.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL(/\/trips(\/|$)/, { timeout: 30_000 }),
        addTripItineraryAction.click({ force: true, timeout: 30_000 }),
      ]);
      return;
    }

    // If neither button is visible for some reason, just try to go to trips.
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
  };

  // Ensure anchor-gating session flag is set early in this browser context.
  // This avoids cases where we navigate away before the get-started handler
  // has persisted state.
  await page.evaluate(() => {
    try {
      window.sessionStorage.setItem('wayfarer_anchor_selected', '1');
    } catch {
      // ignore
    }
  }).catch(() => {});

  await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});

  const startedAt = Date.now();
  while (Date.now() - startedAt < 25_000) {
    await recoverFromLoadingTimeout();

    const url = page.url();
    const stillLoading = await stillLoadingHeading.isVisible().catch(() => false);
    const navVisible = await tripsNavLink.isVisible().catch(() => false);
    if (url.includes('/trips') && !url.includes('/get-started') && !url.includes('/onboarding') && !stillLoading && navVisible) {
      return;
    }

    if (url.includes('/onboarding')) {
      await completeOnboardingIfVisible();
      await page.waitForURL(/\/(get-started|trips|onboarding)/, { timeout: 8000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    // Some transitions briefly render onboarding content before URL settles.
    const expectationsVisible = await page
      .getByRole('heading', { name: /what are your expectations\??/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (expectationsVisible) {
      await completeOnboardingIfVisible();
      await page.waitForURL(/\/(get-started|trips|onboarding)/, { timeout: 8000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    const onGetStarted = url.includes('/get-started') || (await letsGetStartedHeading.isVisible().catch(() => false));
    if (onGetStarted) {
      await chooseGetStartedDestination();
      await page.waitForURL(/\/trips(\/|$)/, { timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  // Final fallback: ensure we end up with the trips surface.
  if (!page.isClosed()) {
    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForURL(/\/trips(\/|$)/, { timeout: 10_000 }).catch(() => {});
  }
}

