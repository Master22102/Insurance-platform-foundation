import { expect, test, type Page } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';

type TripKind = 'solo' | 'group';

const STAGED_ROUTES: Array<{ slug: string; title: string }> = [
  { slug: 'insurance-options', title: 'Insurance options (off-platform)' },
  { slug: 'post-purchase-policy', title: 'After you buy coverage' },
  { slug: 'policy-alignment', title: 'Align trip and policies' },
  { slug: 'trip-end-reminder', title: 'Trip-end reminder' },
  { slug: 'trip-extension', title: 'Continue your trip' },
];

const UUID_RX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function parseTripIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = href.match(/^\/trips\/([^/]+)\/draft$/);
  const tripId = m?.[1];
  return tripId && UUID_RX.test(tripId) ? tripId : null;
}

function tripPrefix(kind: TripKind): string {
  return kind === 'group' ? 'E2E Smoke Group' : 'E2E Smoke Solo';
}

/** Match anchor-gating session flag used elsewhere in E2E. */
async function setAnchorSessionFlag(page: Page) {
  await page.evaluate(() => {
    try {
      window.sessionStorage.setItem('wayfarer_anchor_selected', '1');
    } catch {
      /* ignore */
    }
  });
}

/**
 * If we're on the "Let's get started" surface, pick "Add a trip itinerary" so
 * profile anchor_selection is persisted and we land on /trips.
 */
async function dismissGetStartedIfPresent(page: Page) {
  await setAnchorSessionFlag(page);

  const onUrl = page.url().includes('/get-started');
  const headingVisible = await page
    .getByRole('heading', { name: /let's get started/i })
    .first()
    .isVisible()
    .catch(() => false);

  if (!onUrl && !headingVisible) return;

  const addTrip = page.getByRole('button', { name: /add a trip itinerary/i }).first();
  await expect(addTrip).toBeVisible({ timeout: 20_000 });
  await Promise.all([
    page.waitForURL(/\/trips(\/|$)/, { timeout: 90_000 }),
    addTrip.click(),
  ]);

  await page
    .getByRole('heading', { name: /your trips/i })
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 })
    .catch(() => {});
}

/**
 * Create a solo or group trip through the same UI a user would (names are unique per run).
 */
async function createTripViaUi(page: Page, kind: TripKind): Promise<string> {
  const tripName = `${tripPrefix(kind)} ${Date.now()}`;

  await setAnchorSessionFlag(page);
  await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await dismissGetStartedIfPresent(page);

  // Still on get-started (e.g. slow profile refresh): try once more from explicit route.
  if (page.url().includes('/get-started')) {
    await page.goto('/get-started', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await dismissGetStartedIfPresent(page);
  }

  // Open `/trips/new` from whichever authenticated surface we currently land on.
  const openNewTripUi = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await setAnchorSessionFlag(page);
      await dismissGetStartedIfPresent(page);

      // Try user-like client navigation from the Trips list first.
      await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await dismissGetStartedIfPresent(page);

      const planTripLink = page.getByRole('link', { name: /^plan a trip$/i }).first();
      const planFirstLink = page.getByRole('link', { name: /plan your first trip/i }).first();
      const canUsePrimary = await planTripLink.isVisible().catch(() => false);
      const canUseEmpty = await planFirstLink.isVisible().catch(() => false);

      if (canUsePrimary || canUseEmpty) {
        const entry = canUsePrimary ? planTripLink : planFirstLink;
        await Promise.all([
          page.waitForURL((u) => /\/trips\/new(\/|$|\?)/.test(u.pathname), { timeout: 60_000 }).catch(() => {}),
          entry.click(),
        ]);
      } else {
        // Fallback for intermittent list rendering/routing races.
        await page.goto('/trips/new', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }

      const onNewTripUrl = /\/trips\/new(\/|$|\?)/.test(page.url());
      const hasSoloTypeButton = await page.getByRole('button', { name: /solo trip/i }).first().isVisible().catch(() => false);
      if (onNewTripUrl && hasSoloTypeButton) return;
    }

    await expect(page).toHaveURL(/\/trips\/new(\/|$|\?)/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /solo trip/i }).first()).toBeVisible({ timeout: 60_000 });
  };

  await openNewTripUi();

  const typeBtn = page.getByRole('button', { name: kind === 'group' ? /group trip/i : /solo trip/i }).first();
  await expect(typeBtn).toBeVisible({ timeout: 30_000 });
  await typeBtn.click();
  await page.getByRole('button', { name: /^continue$/i }).first().click();
  await page.getByRole('button', { name: /enter details manually/i }).first().click();

  await page.getByPlaceholder('Weekend in Lisbon').fill(tripName);
  await page.getByPlaceholder('Lisbon, Portugal').fill('Lisbon, Portugal');
  await page.getByRole('button', { name: /^air$/i }).first().click();

  if (kind === 'group') {
    await page.getByRole('button', { name: /add travelers/i }).first().click();
    await page.getByRole('button', { name: /skip and create without travelers/i }).first().click();
  } else {
    await page.getByRole('button', { name: /start planning/i }).first().click();
  }

  await expect(page.getByText(/trip created/i).first()).toBeVisible({ timeout: 120_000 });

  const continueHref = await page.getByRole('link', { name: /continue planning/i }).first().getAttribute('href');
  const tripId = parseTripIdFromHref(continueHref);
  expect(tripId).toBeTruthy();
  return tripId!;
}

async function findExistingTripIdByNamePrefix(page: Page, kind: TripKind): Promise<string | null> {
  const prefix = tripPrefix(kind);
  await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await dismissGetStartedIfPresent(page);

  const link = page.getByRole('link', { name: new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
  if (!(await link.isVisible().catch(() => false))) return null;

  const href = await link.getAttribute('href');
  if (!href) return null;
  const m = href.match(/^\/trips\/([0-9a-fA-F-]{36})(?:\/|$)/);
  const id = m?.[1];
  return id && UUID_RX.test(id) ? id : null;
}

async function findAnyTripId(page: Page): Promise<string | null> {
  await page.goto('/trips', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await dismissGetStartedIfPresent(page);
  await page.waitForLoadState('networkidle').catch(() => {});

  const draftLink = page.locator('a[href^="/trips/"][href$="/draft"]').first();
  const href = await draftLink.getAttribute('href').catch(() => null);
  const parsed = parseTripIdFromHref(href);
  if (parsed) return parsed;

  const continuePlanning = page.getByRole('link', { name: /continue planning/i }).first();
  const fallbackHref = await continuePlanning.getAttribute('href').catch(() => null);
  return parseTripIdFromHref(fallbackHref);
}

/** Prefer an existing E2E-named trip; otherwise create one (solo vs group organizer trip). */
async function ensureTripIdForKind(page: Page, kind: TripKind): Promise<string> {
  await ensureOnboarded(page);
  await setAnchorSessionFlag(page);

  const existing = await findExistingTripIdByNamePrefix(page, kind);
  if (existing) return existing;

  const anyTrip = await findAnyTripId(page);
  if (anyTrip) return anyTrip;

  return createTripViaUi(page, kind);
}

test.describe('Section 5 staged routes smoke (solo + group)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.use({ storageState: STORAGE_STATE_PATH });

  for (const kind of ['solo', 'group'] as const) {
    test(`${kind} staged routes render and FOCL link exists`, async ({ page }) => {
      test.setTimeout(240_000);

      const tripId = await ensureTripIdForKind(page, kind);

      for (const route of STAGED_ROUTES) {
        await page.goto(`/trips/${tripId}/section-5-staged/${route.slug}`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('STAGED · NOT ACTIVATED')).toBeVisible();
        await expect(page.getByRole('heading', { name: route.title })).toBeVisible();
        await expect(page.getByRole('link', { name: /back to trip/i }).first()).toHaveAttribute('href', `/trips/${tripId}`);
        await expect(page.getByRole('link', { name: /open feature intelligence panel/i }).first()).toHaveAttribute('href', '/focl/features/intelligence');
      }

      const foclRes = await page.request.get('/focl/features/intelligence');
      expect(foclRes.ok()).toBeTruthy();
    });

    test(`${kind} invalid staged slug is blocked from staged surface`, async ({ page }) => {
      test.setTimeout(180_000);
      const tripId = await ensureTripIdForKind(page, kind);
      await page.goto(`/trips/${tripId}/section-5-staged/not-a-real-flow`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await expect(page.getByText('STAGED · NOT ACTIVATED')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /insurance options|after you buy coverage|align trip and policies|trip-end reminder|continue your trip/i })).toHaveCount(0);
    });
  }
});
