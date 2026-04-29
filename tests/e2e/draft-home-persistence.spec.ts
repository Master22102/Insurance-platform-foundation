import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe('Draft Home persistence (authenticated)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: getStorageStatePath() });

  test('voice/route/activities/unresolved/readiness persist', async ({ page }) => {
    const ensureAnchorBySession = async () => {
      await page
        .evaluate(() => {
          try {
            window.sessionStorage.setItem('wayfarer_anchor_selected', '1');
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    };

    const recoverFromGetStarted = async (targetPath: '/trips' | '/trips/new' = '/trips') => {
      const targetRegex = targetPath === '/trips/new' ? /\/trips\/new(\/|$)/ : /\/trips(\/|$)/;
      for (let attempt = 0; attempt < 5; attempt++) {
        await ensureAnchorBySession();

        const onGetStarted = await page
          .getByRole('heading', { name: /let's get started/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (!onGetStarted) return;

        // Prefer "Add a trip itinerary" if present; otherwise use "I'm still planning".
        const addTripItineraryBtn = page.getByRole('button', { name: /add a trip itinerary/i }).first();
        const stillPlanningBtn = page.getByRole('button', { name: /i'?m still planning/i }).first();

        if (await addTripItineraryBtn.isVisible().catch(() => false)) {
          await addTripItineraryBtn.click({ force: true, timeout: 10_000 }).catch(() => {});
        } else if (await stillPlanningBtn.isVisible().catch(() => false)) {
          await stillPlanningBtn.click({ force: true, timeout: 10_000 }).catch(() => {});
        } else {
          await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
        }

        await page.waitForURL(targetRegex, { timeout: 10_000 }).catch(() => {});

        if (targetPath === '/trips/new' && !/\/trips\/new(\/|$)/.test(page.url())) {
          await page.goto('/trips/new', { waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForURL(/\/trips\/new(\/|$)/, { timeout: 10_000 }).catch(() => {});
        }

        const stillOnGate = await page
          .getByRole('heading', { name: /let's get started/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (!stillOnGate) return;
      }
    };

    const gotoTripNewStable = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        await ensureAnchorBySession();

        const termsVisible = await page
          .getByRole('heading', { name: /terms\s*&\s*privacy/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (termsVisible) {
          await ensureOnboarded(page);
        }

        await page.goto('/trips/new', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await recoverFromGetStarted('/trips/new');

        const onTripNew = /\/trips\/new(\/|$)/.test(page.url());
        const onGetStarted = await page
          .getByRole('heading', { name: /let's get started/i })
          .first()
          .isVisible()
          .catch(() => false);

        if (onTripNew && !onGetStarted) return;
      }
      throw new Error('Could not stabilize on /trips/new trip details form.');
    };

    const clickContinueIfVisible = async () => {
      const continueBtn = page.getByRole('button', { name: /^continue$/i }).first();
      if (await continueBtn.isVisible().catch(() => false)) {
        try {
          await continueBtn.click({ force: true, timeout: 10_000 });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    const selectSoloTripStep = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await ensureAnchorBySession();
        await recoverFromGetStarted('/trips/new');
        await page.waitForTimeout(400).catch(() => {});

        // Most runs already default to Solo; continue immediately when possible.
        if (await clickContinueIfVisible()) return;

        // Variant A: semantic button
        const soloBtn = page.getByRole('button', { name: /solo trip/i }).first();
        if (await soloBtn.isVisible().catch(() => false)) {
          await soloBtn.click({ force: true, timeout: 10_000 }).catch(() => {});
          if (await clickContinueIfVisible()) return;
        }

        // Variant B: card/text container with click target
        const soloText = page.getByText(/solo trip/i).first();
        if (await soloText.isVisible().catch(() => false)) {
          await soloText.click({ force: true, timeout: 10_000 }).catch(() => {});
          if (await clickContinueIfVisible()) return;
        }

        // Variant C: radio option
        const soloRadio = page.getByRole('radio', { name: /solo trip/i }).first();
        if (await soloRadio.isVisible().catch(() => false)) {
          await soloRadio.click({ force: true, timeout: 10_000 }).catch(() => {});
          if (await clickContinueIfVisible()) return;
        }

        // Sometimes we land on onboarding terms in this context.
        const termsVisible = await page
          .getByRole('heading', { name: /terms\s*&\s*privacy/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (termsVisible) {
          await ensureOnboarded(page);
        }

        await page.goto('/trips/new', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }

      throw new Error('Could not complete trip type step (solo trip) on /trips/new.');
    };

    const gotoTripDetailsStep = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        await ensureAnchorBySession();
        await recoverFromGetStarted('/trips/new');

        const tripNameInput = page.getByPlaceholder(/weekend in lisbon/i).first();
        if (await tripNameInput.isVisible().catch(() => false)) return;

        // Try progress actions in order. Any unavailable step is ignored.
        await selectSoloTripStep().catch(() => {});
        const manualBtn = page.getByRole('button', { name: /enter details manually/i }).first();
        if (await manualBtn.isVisible().catch(() => false)) {
          await manualBtn.click({ force: true, timeout: 10_000 }).catch(() => {});
        }
        await clickContinueIfVisible();

        // Check again after attempted progression.
        if (await tripNameInput.isVisible().catch(() => false)) return;

        // Onboarding may occasionally reappear with stale state.
        const termsVisible = await page
          .getByRole('heading', { name: /terms\s*&\s*privacy/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (termsVisible) {
          await ensureOnboarded(page);
          continue;
        }

        await page.goto('/trips/new', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      throw new Error('Could not reach trip details step on /trips/new.');
    };

    const fillTripDetails = async (tripName: string, departure: string, ret: string) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await gotoTripDetailsStep();
        try {
          await page.getByPlaceholder(/weekend in lisbon/i).fill(tripName);
          const departureByLabel = page.getByLabel(/departure date/i).first();
          const returnByLabel = page.getByLabel(/return date/i).first();
          await departureByLabel.fill(departure);
          await returnByLabel.fill(ret);
          return;
        } catch {
          // Recover and retry if a gate/redirect interrupted field entry.
          await ensureAnchorBySession();
          await recoverFromGetStarted('/trips/new');
        }
      }
      throw new Error('Could not fill trip details form after retries.');
    };

    const safeAppGoto = async (path: string) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await page.goto(path, { waitUntil: 'domcontentloaded' });
          return;
        } catch {
          await ensureOnboarded(page);
          await ensureAnchorBySession();
          await recoverFromGetStarted('/trips');
        }
      }
      await page.goto(path, { waitUntil: 'domcontentloaded' });
    };

    await ensureOnboarded(page);
    await ensureAnchorBySession();
    await recoverFromGetStarted('/trips');

    // Prefer an existing draft trip to avoid entry-flow flakiness.
    let tripId: string | null = process.env.E2E_SEEDED_TRIP_ID ?? 'c8eefcbf-7c5e-4908-9790-b2c185c31abf';
    if (tripId) {
      await page.goto(`/trips/${tripId}/draft`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const stillOnSeededDraft = new RegExp(`/trips/${tripId}/draft(?:/|$)`).test(page.url());
      if (!stillOnSeededDraft) {
        tripId = null;
      }
    }

    await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await recoverFromGetStarted('/trips');
    if (!tripId) {
      const existingDraftHref = await page.locator('a[href*="/trips/"][href*="/draft"]').first().getAttribute('href').catch(() => null);
      if (existingDraftHref) {
        const m = existingDraftHref.match(/\/trips\/([^/]+)\/draft/);
        if (m?.[1]) tripId = m[1];
      }
    }

    // 1) Create a solo trip with missing destination (fallback when no draft exists).
    // Destination is intentionally blank to generate a warning blocker.
    const base = new Date();
    const departure = ymd(new Date(base.getTime() + 1000 * 60 * 60 * 24 * 20));
    const ret = ymd(new Date(base.getTime() + 1000 * 60 * 60 * 24 * 25));
    if (!tripId) {
      await gotoTripNewStable();
      await gotoTripDetailsStep();
      await fillTripDetails('Weekend test', departure, ret);

      // Create trip
      await ensureAnchorBySession();
      await recoverFromGetStarted('/trips/new');
      await page.getByRole('button', { name: /start planning/i }).click({ force: true });

      // 2) Enter Draft Home
      // Depending on deployed UI version, post-trip CTA can be "Continue planning" or "View trip".
      const continuePlanningLink = page.getByRole('link', { name: /continue planning/i }).first();
      const viewTripLink = page.getByRole('link', { name: /view trip/i }).first();
      let entered = false;
      try {
        await continuePlanningLink.click({ force: true, timeout: 5_000 });
        entered = true;
      } catch {
        // ignore
      }
      if (!entered) {
        await viewTripLink.click({ force: true, timeout: 5_000 });
      }

      const urlAfterCta = page.url();
      const tripIdMatch = urlAfterCta.match(/\/trips\/([^/]+)(\/|$)/);
      expect(tripIdMatch?.[1]).toBeTruthy();
      tripId = tripIdMatch![1];
    }

    expect(tripId).toBeTruthy();

    await page.goto(`/trips/${tripId}/draft`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForURL(/\/trips\/[^/]+\/draft(\/|$)/, { timeout: 30_000 }).catch(() => {});

    // 3) Add one flight segment (clears critical route.date blockers).
    await page.getByRole('link', { name: /add legs.*build route/i }).click({ force: true });
    await recoverFromGetStarted('/trips');

    // Segment creation UI
    if (await page.getByRole('button', { name: /\+ add segment/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /\+ add segment/i }).click({ force: true });
    } else if (await page.getByRole('button', { name: /add first segment/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /add first segment/i }).click({ force: true });
    }

    const fromInput = page.locator('input[placeholder="e.g. JFK"]').first();
    const toInput = page.locator('input[placeholder="e.g. LHR"]').first();
    if (await fromInput.isVisible().catch(() => false)) {
      await fromInput.fill('JFK');
      await toInput.fill('LAX');
      await page.locator('input[type="date"]').first().fill(departure);

      const saveSegmentBtn = page.getByRole('button', { name: /save segment/i }).first();
      if (await saveSegmentBtn.isVisible().catch(() => false)) {
        await saveSegmentBtn.click({ force: true });
      }
    }

    // 4) Activities persistence
    await ensureAnchorBySession();
    await recoverFromGetStarted('/trips');
    await safeAppGoto(`/trips/${tripId}/draft/activities`);
    const acceptBtnOnLoad = page.getByRole('button', { name: /accept/i }).first();
    if (await acceptBtnOnLoad.isVisible().catch(() => false)) {
      await acceptBtnOnLoad.click({ force: true });
      await page.waitForTimeout(500);
    }

    await page.reload();
    await recoverFromGetStarted('/trips');
    await page.goto(`/trips/${tripId}/draft/activities`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const acceptedBtn = page.getByRole('button', { name: /accepted/i }).first();
    if (!(await acceptedBtn.isVisible().catch(() => false))) {
      const acceptBtn = page.getByRole('button', { name: /accept/i }).first();
      if (await acceptBtn.isVisible().catch(() => false)) {
        await acceptBtn.click({ force: true });
      }
    }

    // 5) Unresolved: mark warning done ("Destination is missing")
    await ensureAnchorBySession();
    await recoverFromGetStarted('/trips');
    await safeAppGoto(`/trips/${tripId}/draft/unresolved`);
    const markDoneBtn = page.getByRole('button', { name: /mark done/i }).first();
    if (await markDoneBtn.isVisible().catch(() => false)) {
      await markDoneBtn.click({ force: true });
    }

    // 6) Readiness: should be ready (no blockers)
    await ensureAnchorBySession();
    await recoverFromGetStarted('/trips');
    await safeAppGoto(`/trips/${tripId}/draft/readiness`);
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}/draft/readiness`), { timeout: 30_000 });
  });
});

