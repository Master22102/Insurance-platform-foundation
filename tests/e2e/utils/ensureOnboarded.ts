import { expect, type Page } from '@playwright/test';

export async function ensureOnboarded(page: Page) {
  const tripsHeading = page.getByRole('heading', { name: /your trips|trips/i });
  const planTripLink = page.getByRole('link', { name: /plan a trip|trips/i });
  const letsGetStartedHeading = page.getByRole('heading', { name: /let's get started/i });
  const addTripItineraryAction = page.getByRole('button', { name: /add a trip itinerary/i });
  const stillPlanningAction = page.getByRole('button', { name: /i'?m still planning/i });

  const completeOnboardingIfVisible = async () => {
    const acceptBtn = page.getByRole('button', { name: /accept and continue/i }).first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      const terms = page.getByLabel(/i agree to terms/i).first();
      const privacy = page.getByLabel(/i agree to privacy/i).first();
      if (await terms.isVisible().catch(() => false)) await terms.check({ force: true });
      if (await privacy.isVisible().catch(() => false)) await privacy.check({ force: true });
      await acceptBtn.click({ force: true }).catch(() => {});
      await page.waitForURL(/\/(onboarding|get-started|trips)/, { timeout: 10_000 }).catch(() => {});
    }

    const skipBtn = page.getByRole('button', { name: /skip for now/i }).first();
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click({ force: true }).catch(() => {});
      await page.waitForURL(/\/(get-started|trips)/, { timeout: 10_000 }).catch(() => {});
    }
  };

  const waitForTripsUI = async () => {
    // Some accounts route via "Let's get started" before showing trips.
    if (await letsGetStartedHeading.isVisible().catch(() => false)) return;
    await Promise.race([
      tripsHeading.waitFor({ state: 'visible', timeout: 60_000 }),
      planTripLink.waitFor({ state: 'visible', timeout: 60_000 }),
      page.getByRole('link', { name: /^trips$/i }).first().waitFor({ state: 'visible', timeout: 60_000 }),
      letsGetStartedHeading.waitFor({ state: 'visible', timeout: 60_000 }),
    ]);
  };

  await page.goto('/trips', { waitUntil: 'domcontentloaded' });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 40_000) {
    const [atTrips, atTripsLink, atMenu, onTerms] = await Promise.all([
      tripsHeading.isVisible().catch(() => false),
      planTripLink.isVisible().catch(() => false),
      letsGetStartedHeading.isVisible().catch(() => false),
      page.getByRole('button', { name: /accept and continue/i }).first().isVisible().catch(() => false),
    ]);

    if (atTrips || atTripsLink) {
      // Give parallel redirects a moment to settle; then re-check onboarding gate.
      await page.waitForTimeout(750);
      if (page.url().includes('/onboarding')) {
        await completeOnboardingIfVisible();
        await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      }
      await waitForTripsUI();
      return;
    }

    if (atMenu) {
      if (await stillPlanningAction.isVisible().catch(() => false)) {
        await Promise.all([
          page.waitForURL(/\/trips/, { timeout: 30_000 }).catch(() => {}),
          stillPlanningAction.click({ force: true }),
        ]);
      } else if (await addTripItineraryAction.isVisible().catch(() => false)) {
        await Promise.all([
          page.waitForURL(/\/trips/, { timeout: 30_000 }).catch(() => {}),
          addTripItineraryAction.click({ force: true }),
        ]);
      } else {
        await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      }
      await waitForTripsUI();
      return;
    }

    if (onTerms) {
      await completeOnboardingIfVisible();
      await page.goto('/trips', { waitUntil: 'domcontentloaded' });
      await waitForTripsUI();
      return;
    }

    await page.waitForTimeout(250);
  }

  // Final fallback: ensure we end up with the trips surface.
  await page.goto('/trips', { waitUntil: 'domcontentloaded' });
  await waitForTripsUI();
}

