import { expect, type Page } from '@playwright/test';

export async function ensureOnboarded(page: Page) {
  const tripsHeading = page.getByRole('heading', { name: /your trips/i });
  const planTripLink = page.getByRole('link', { name: /plan a trip/i });
  const termsHeading = page.getByRole('heading', { name: /terms/i });
  const letsGetStartedHeading = page.getByRole('heading', { name: /let's get started/i });
  const addTripItineraryAction = page.getByRole('button', { name: /add a trip itinerary/i });
  const stillPlanningAction = page.getByRole('button', { name: /i'?m still planning/i });

  const completeTermsStep = async () => {
    const acceptBtn = page.getByRole('button', { name: /accept and continue/i });
    await expect(termsHeading).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/i agree to terms/i).first().check({ force: true });
    await page.getByLabel(/i agree to privacy/i).first().check({ force: true });
    await expect(acceptBtn).toBeEnabled();

    await Promise.all([
      page.getByRole('heading', { name: /what are your expectations of the platform/i }).waitFor({ timeout: 20_000 }),
      acceptBtn.click({ force: true }),
    ]);

    const skipBtn = page.getByRole('button', { name: /skip for now/i });
    await Promise.all([
      page.waitForURL(/\/get-started/, { timeout: 30_000 }).catch(() => {}),
      skipBtn.click({ force: true }),
    ]);
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
      termsHeading.isVisible().catch(() => false),
    ]);

    if (atTrips || atTripsLink) {
      // Give parallel redirects a moment to settle; then re-check onboarding terms.
      await page.waitForTimeout(750);
      if (page.url().includes('/onboarding') || (await termsHeading.isVisible().catch(() => false))) {
        await completeTermsStep();
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
      await completeTermsStep();
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

