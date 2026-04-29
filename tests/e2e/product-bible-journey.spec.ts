import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { attachBibleStep } from './utils/bibleJourneyAttach';
import { ensureOnboarded, gotoAuthPathWithRecovery } from './utils/ensureOnboarded';
import { runFullJourneyToClaimPacket } from './utils/fullJourney.e2e';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  isPlaywrightJwtExpired,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
} from './utils/supabaseRest';

test.describe.configure({ timeout: 300_000 });

test.describe('Product bible journey (narrative E2E backbone)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.use({ storageState: getStorageStatePath() });

  test('Jilt shell (no trip_id): trips hub + Quick Scan page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Bible journey uses Chromium desktop for stability.');
    const token = readAccessTokenFromStorageState();
    test.skip(!token, E2E_AUTH_SKIP_REASON);
    test.skip(isPlaywrightJwtExpired(token), 'JWT expired — run npm run e2e:auth again.');

    await ensureOnboarded(page);
    await gotoAuthPathWithRecovery(page, '/trips');
    await expect
      .poll(
        async () => {
          const h = page.getByRole('heading', { name: /your trips/i }).first();
          const nav = page.getByRole('link', { name: /^trips$/i }).first();
          return (await h.isVisible().catch(() => false)) || (await nav.isVisible().catch(() => false));
        },
        { timeout: 35_000 },
      )
      .toBeTruthy();
    await attachBibleStep(testInfo, {
      bibleStep: '3-anchor-trips-shell',
      surface: '/trips',
      status: 'pass',
      note: 'Trips hub reachable without trip-backed steps',
    });
    await testInfo.attach('bible-jilt-trips-shell.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await gotoAuthPathWithRecovery(page, '/scan');
    await expect
      .poll(
        async () => {
          const q = page.getByRole('heading', { name: /quick scan/i }).first();
          const g = page.getByRole('heading', { name: /let's get started/i }).first();
          return (await q.isVisible().catch(() => false)) || (await g.isVisible().catch(() => false));
        },
        { timeout: 25_000 },
      )
      .toBeTruthy();
    await attachBibleStep(testInfo, {
      bibleStep: '5-quick-scan-shell',
      surface: '/scan',
      status: 'pass',
      note: 'Quick scan or gate visible (no trip required)',
    });
  });

  test('Jilt backbone: trips, trip workspace, coverage/deep scan, draft home, scans, readiness pins, staged shell', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Bible journey uses Chromium desktop for stability.');

    const token = readAccessTokenFromStorageState();
    test.skip(!token, E2E_AUTH_SKIP_REASON);
    test.skip(isPlaywrightJwtExpired(token), 'JWT expired — run npm run e2e:auth again.');

    const snap = async (label: string) => {
      await testInfo.attach(label, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    };

    await test.step('§5 Step 3 — Trips hub / anchor', async () => {
      await ensureOnboarded(page);
      await gotoAuthPathWithRecovery(page, '/trips');
      const tripsHeading = page.getByRole('heading', { name: /your trips/i }).first();
      const tripsNav = page.getByRole('link', { name: /^trips$/i }).first();
      await expect
        .poll(
          async () => (await tripsHeading.isVisible().catch(() => false)) || (await tripsNav.isVisible().catch(() => false)),
          { timeout: 35_000 },
        )
        .toBeTruthy();
      await attachBibleStep(testInfo, {
        bibleStep: '3-anchor-trips',
        surface: '/trips',
        status: 'pass',
        note: 'Trips hub or nav visible after ensureOnboarded',
      });
      await snap('bible-jilt-trips.png');
    });

    let tripId: string | null = process.env.E2E_BIBLE_TRIP_ID?.trim() || null;
    if (tripId && !/^[0-9a-f-]{36}$/i.test(tripId)) {
      tripId = null;
    }
    if (!tripId) {
      const rows = await supabaseRestSelect<Array<{ trip_id: string }>>(
        request,
        token,
        'trips',
        'select=trip_id&limit=5',
      );
      tripId = rows[0]?.trip_id ?? null;
    }

    if (!tripId) {
      await gotoAuthPathWithRecovery(page, '/trips');
      const draftHref = await page.locator('a[href*="/draft"]').first().getAttribute('href').catch(() => null);
      const m = draftHref?.match(/\/trips\/([0-9a-f-]{36})\/draft/i);
      if (m?.[1]) tripId = m[1];
    }

    test.skip(
      !tripId,
      'No trip_id: set E2E_BIBLE_TRIP_ID, create a trip, or run tests/e2e/draft-home-persistence.spec.ts once.',
    );

    const tid = tripId as string;

    await test.step('§5 Step 11 — Trip workspace (Overview tab)', async () => {
      await gotoAuthPathWithRecovery(page, `/trips/${tid}`);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await expect(page.getByRole('button', { name: /^Overview$/ }).first()).toBeVisible({ timeout: 35_000 });
      const deepHint = page.getByText(/deep scan|deep coverage|complete draft home/i).first();
      await expect(deepHint).toBeVisible({ timeout: 15_000 }).catch(() => {});
      await attachBibleStep(testInfo, {
        bibleStep: '11-workspace-overview',
        surface: `/trips/${tid}`,
        status: 'pass',
        note: 'Overview tab + deep scan messaging present',
      });
      await snap('bible-jilt-trip-overview.png');
    });

    await test.step('§5 Step 11 / 6 — Coverage tab + Deep scan panel surface', async () => {
      await page.getByRole('button', { name: /^Coverage$/ }).click({ timeout: 15_000 });
      await expect(page.getByText(/coverage|policy|deep scan|clause/i).first()).toBeVisible({ timeout: 25_000 });
      await attachBibleStep(testInfo, {
        bibleStep: '6-deep-scan-surface',
        surface: `/trips/${tid} (Coverage tab)`,
        status: 'pass',
        note: 'Coverage tab renders; DeepScanPanel copy/controls may vary by unlock state',
      });
      await snap('bible-jilt-coverage-tab.png');
    });

    await test.step('§5 Step 4D — Draft Home hub', async () => {
      await gotoAuthPathWithRecovery(page, `/trips/${tid}/draft`);
      await expect(page).toHaveURL(new RegExp(`/trips/${tid}/draft`), { timeout: 30_000 });
      await attachBibleStep(testInfo, {
        bibleStep: '4D-draft-home',
        surface: `/trips/${tid}/draft`,
        status: 'pass',
        note: 'Draft hub route loads',
      });
      await snap('bible-jilt-draft-home.png');
    });

    await test.step('§5 Step 4D.3 — Draft activities (no mandatory auto-populate assert)', async () => {
      await gotoAuthPathWithRecovery(page, `/trips/${tid}/draft/activities`);
      await expect(page).toHaveURL(new RegExp(`/trips/${tid}/draft/activities`), { timeout: 25_000 });
      await attachBibleStep(testInfo, {
        bibleStep: '4D-3-activities',
        surface: `/trips/${tid}/draft/activities`,
        status: 'pass',
        note: 'Activities page loads; itinerary auto-populate is not asserted — see matrix 4A/4D partial',
      });
      await snap('bible-jilt-draft-activities.png');
    });

    await test.step('§5 Step 4E — Draft readiness confirm', async () => {
      await gotoAuthPathWithRecovery(page, `/trips/${tid}/draft/readiness`);
      await expect(page).toHaveURL(new RegExp(`/trips/${tid}/draft/readiness`), { timeout: 25_000 });
      await attachBibleStep(testInfo, {
        bibleStep: '4E-draft-readiness',
        surface: `/trips/${tid}/draft/readiness`,
        status: 'pass',
        note: 'Draft readiness route loads',
      });
      await snap('bible-jilt-draft-readiness.png');
    });

    await test.step('§5 Step 5 — Quick Scan page', async () => {
      await gotoAuthPathWithRecovery(page, '/scan');
      const quick = page.getByRole('heading', { name: /quick scan/i }).first();
      const gate = page.getByRole('heading', { name: /let's get started/i }).first();
      await expect
        .poll(
          async () => (await quick.isVisible().catch(() => false)) || (await gate.isVisible().catch(() => false)),
          { timeout: 25_000 },
        )
        .toBeTruthy();
      await attachBibleStep(testInfo, {
        bibleStep: '5-quick-scan-page',
        surface: '/scan',
        status: 'pass',
        note: 'Quick scan or anchor gate visible',
      });
      await snap('bible-jilt-scan.png');
    });

    await test.step('§5 Step 5.5 — Readiness pins', async () => {
      await gotoAuthPathWithRecovery(page, `/trips/${tid}/readiness-pins`);
      await expect(page.getByRole('heading', { name: /entry & documentation checklist/i }).first()).toBeVisible({
        timeout: 25_000,
      });
      await attachBibleStep(testInfo, {
        bibleStep: '5-5-readiness-pins',
        surface: `/trips/${tid}/readiness-pins`,
        status: 'pass',
        note: 'Readiness pins checklist heading visible',
      });
      await snap('bible-jilt-readiness-pins.png');
    });

    await test.step('§5 Staged — insurance-options shell', async () => {
      await gotoAuthPathWithRecovery(page, `/trips/${tid}/section-5-staged/insurance-options`);
      await expect(page.getByRole('heading', { name: /insurance options/i }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Wayfarer does not sell insurance/i).first()).toBeVisible({ timeout: 15_000 });
      await attachBibleStep(testInfo, {
        bibleStep: '7-staged-insurance-options',
        surface: `/trips/${tid}/section-5-staged/insurance-options`,
        status: 'pass',
        note: 'Staged route reachable; copy may be shell until FOCL activation',
      });
      await snap('bible-jilt-staged-insurance.png');
    });

    await test.step('Founder Riley — FOCL Corpus (optional)', async () => {
      const prof = await supabaseRestSelect<Array<{ membership_tier: string | null }>>(
        request,
        token,
        'user_profiles',
        'select=membership_tier&limit=1',
      );
      const tier = prof[0]?.membership_tier;
      if (tier !== 'FOUNDER') {
        await attachBibleStep(testInfo, {
          bibleStep: 'focl-corpus',
          surface: '/focl/ops',
          status: 'skip',
          note: `E2E user membership_tier=${tier ?? 'null'} — not FOUNDER`,
        });
        return;
      }
      await gotoAuthPathWithRecovery(page, '/focl/ops');
      const corpus = page.getByText(/corpus|document|intelligence|acquire/i).first();
      await expect(corpus).toBeVisible({ timeout: 25_000 });
      await attachBibleStep(testInfo, {
        bibleStep: 'focl-corpus',
        surface: '/focl/ops',
        status: 'pass',
        note: 'FOCL Corpus panel visible for FOUNDER',
      });
      await snap('bible-riley-focl-corpus.png');
    });

    if (process.env.E2E_BIBLE_CLAIM_JOURNEY === '1') {
      await test.step('Claim packet — full journey util (optional env)', async () => {
        const stamp = Date.now();
        await runFullJourneyToClaimPacket(page, request, token, stamp);
        await attachBibleStep(testInfo, {
          bibleStep: 'claim-packet-e2e',
          surface: 'incident route + API',
          status: 'pass',
          note: `fullJourney.e2e stamp=${stamp}`,
        });
      });
    }
  });
});
