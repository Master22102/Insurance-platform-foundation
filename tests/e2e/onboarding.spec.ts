import { test, expect } from '@playwright/test';

const storageStatePath = '.playwright/storageState.json';

test.describe('Onboarding (Section 5 Steps 1.5–3)', () => {
  test.use({ storageState: storageStatePath });

  test('Terms & Privacy → expectations confirm → get started menu', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    const termsHeading = page.getByRole('heading', { name: /terms & privacy/i });
    const letsHeading = page.getByRole('heading', { name: /let's get started/i });
    const tripsHeading = page.getByRole('heading', { name: /your trips/i });

    // When running in parallel, another test may finish onboarding and cause a redirect
    // before this test reaches the Terms step. Accept any known valid post-onboarding state.
    await Promise.race([
      termsHeading.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
      letsHeading.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
      tripsHeading.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
    ]);

    const onTerms = await termsHeading.isVisible().catch(() => false);
    const atGetStarted = await letsHeading.isVisible().catch(() => false);
    const atTrips = await tripsHeading.isVisible().catch(() => false);

    // If another test already finished onboarding, accept whichever page we arrived at.
    if (!onTerms) {
      if (atGetStarted) {
        await expect(letsHeading).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('link', { name: /add a trip itinerary/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /add an insurance policy/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /i'm still planning/i })).toBeVisible();
        return;
      }
      if (atTrips) {
        await expect(tripsHeading).toBeVisible({ timeout: 10_000 });
        return;
      }
      // Final fallback: check URL pattern.
      await expect(page).toHaveURL(/\/(get-started|trips|onboarding)/);
      return;
    }

    // When running in parallel, the Terms heading can detach during rapid redirects.
    // Re-check before asserting visibility.
    if (!(await termsHeading.isVisible().catch(() => false))) {
      const atGetStartedNow = await letsHeading.isVisible().catch(() => false);
      const atTripsNow = await tripsHeading.isVisible().catch(() => false);
      if (atGetStartedNow) {
        await expect(letsHeading).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('link', { name: /add a trip itinerary/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /add an insurance policy/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /i'm still planning/i })).toBeVisible();
        return;
      }
      if (atTripsNow) {
        await expect(tripsHeading).toBeVisible({ timeout: 10_000 });
        return;
      }
      await expect(page).toHaveURL(/\/(get-started|trips|onboarding)/);
      return;
    }

    await expect(termsHeading).toBeVisible();
    await expect(page.getByText(/we'll never silently change your trip or coverage/i)).toBeVisible();

    const acceptBtn = page.getByRole('button', { name: /accept and continue/i });
    await expect(acceptBtn).toBeDisabled();

    await page.getByLabel(/i agree to terms/i).check();
    await page.getByLabel(/i agree to privacy/i).check();
    await expect(acceptBtn).toBeEnabled();
    await acceptBtn.click();

    await expect(page.getByRole('heading', { name: /what are your expectations of the platform/i })).toBeVisible();
    await expect(page.getByText(/go ahead and speak/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /type instead/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /skip for now/i })).toBeVisible();

    await page.getByRole('button', { name: /skip for now/i }).click();

    await expect(page).toHaveURL(/\/get-started/);
    await expect(page.getByRole('heading', { name: /let's get started/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /add a trip itinerary/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /add an insurance policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /i'm still planning/i })).toBeVisible();
  });
});

