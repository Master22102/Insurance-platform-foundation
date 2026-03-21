import { expect, type Page } from '@playwright/test';

export async function ensureOnboarded(page: Page) {
  const letsGetStartedHeading = page.getByRole('heading', { name: /let's get started/i });
  const addTripItineraryAction = page.getByRole('button', { name: /add a trip itinerary/i });
  const stillPlanningAction = page.getByRole('button', { name: /i'?m still planning/i });
  const tripsNavLink = page.getByRole('link', { name: /^trips$/i }).first();

  const stillLoadingHeading = page.getByRole('heading', { name: /still loading your session/i }).first();
  const retryLoadingBtn = page.getByRole('button', { name: /retry loading/i }).first();

  const completeOnboardingIfVisible = async () => {
    const acceptBtn = page.getByRole('button', { name: /accept and continue/i }).first();

    const skipBtn = page.getByRole('button', { name: /skip for now/i }).first();
    const expectationsHeading = page.getByRole('heading', { name: /what are your expectations\??/i }).first();

    // Terms step
    if (await acceptBtn.isVisible().catch(() => false)) {
      const terms = page.getByLabel(/i agree to terms/i).first();
      const privacy = page.getByLabel(/i agree to privacy/i).first();
      const termsByRole = page.getByRole('checkbox', { name: /terms/i }).first();
      const privacyByRole = page.getByRole('checkbox', { name: /privacy/i }).first();

      if (await terms.isVisible().catch(() => false)) {
        if (!(await terms.isChecked().catch(() => false))) {
          await terms.check({ force: true, timeout: 5_000 }).catch(() => {});
        }
      } else if (await termsByRole.isVisible().catch(() => false)) {
        if (!(await termsByRole.isChecked().catch(() => false))) {
          await termsByRole.check({ force: true, timeout: 5_000 }).catch(() => {});
        }
      }
      if (await privacy.isVisible().catch(() => false)) {
        if (!(await privacy.isChecked().catch(() => false))) {
          await privacy.check({ force: true, timeout: 5_000 }).catch(() => {});
        }
      } else if (await privacyByRole.isVisible().catch(() => false)) {
        if (!(await privacyByRole.isChecked().catch(() => false))) {
          await privacyByRole.check({ force: true, timeout: 5_000 }).catch(() => {});
        }
      }

      await acceptBtn.click({ force: true, timeout: 5_000 }).catch(() => {});
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
      await retryLoadingBtn.click({ force: true, timeout: 5_000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
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

