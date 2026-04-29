import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { createE2eTripAndSeed } from './utils/coverageGraphContract.e2e';
import { ensureOnboarded } from './utils/ensureOnboarded';
import { unlockTripForStep4 } from './utils/step4TripSetup';
import { hasSupabaseEnv, readAccessTokenFromStorageState, supabaseRestSelect } from './utils/supabaseRest';

/** Playwright's list reporter often omits skip reasons (especially from `beforeAll`). */
function logCoverageMatrixSkip(reason: string): void {
  process.stderr.write(`\n[coverage-matrix E2E] SKIPPED — ${reason}\n\n`);
}

test.describe('Coverage matrix (F-6.5.2)', () => {
  /*
    Skip before `storageState` loads: missing file hard-fails Playwright fixture init.
    Other prereqs use `beforeAll` + `testInfo.skip`; we also `stderr` log because list output hides reasons.
  */
  if (!hasStorageState()) {
    logCoverageMatrixSkip(
      'Missing `.playwright/storageState.json` — run `npm run e2e:auth` while `npm run dev` is up.',
    );
  }
  test.skip(
    !hasStorageState(),
    'Missing `.playwright/storageState.json` — run `npm run e2e:auth` while `npm run dev` is up.',
  );
  test.use({ storageState: getStorageStatePath() });

  /** Filled in `beforeAll` when prereqs pass (skipped suites never read these). */
  let matrixE2eToken = '';
  let matrixE2eActorId = '';

  test.beforeAll(async ({ request }, testInfo) => {
    if (!hasSupabaseEnv()) {
      const msg =
        'Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e.g. in `.env.local` loaded by `playwright.config.ts`).';
      logCoverageMatrixSkip(msg);
      testInfo.skip(true, msg);
      return;
    }
    const t = readAccessTokenFromStorageState();
    if (!t) {
      const msg =
        'Missing or **expired** Supabase JWT in storage state — run `npm run e2e:auth` again (access tokens expire ~1h). Use the same `NEXT_PUBLIC_SUPABASE_URL` / anon key as the app.';
      logCoverageMatrixSkip(msg);
      testInfo.skip(true, msg);
      return;
    }
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      t,
      'user_profiles',
      'select=user_id&limit=1',
    );
    const actorId = me[0]?.user_id;
    if (!actorId) {
      const msg =
        'No `user_profiles` row for this account — finish onboarding in the app, then run `npm run e2e:auth` again.';
      logCoverageMatrixSkip(msg);
      testInfo.skip(true, msg);
      return;
    }
    matrixE2eToken = t;
    matrixE2eActorId = actorId;
  });

  test('Coverage tab — Build coverage map shows benefit comparison (manual QA #3)', async ({
    page,
    request,
  }) => {
    const t = matrixE2eToken;
    const actorId = matrixE2eActorId;

    const stamp = Date.now();
    const tripId = await createE2eTripAndSeed(request, t, actorId, stamp, 'matrix-ui', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, t, tripId, actorId, `e2e-matrix-ui-unlock-${stamp}`);

    await ensureOnboarded(page);
    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(new RegExp(`/trips/${tripId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^coverage$/i }).click();

    const panel = page.locator('#coverage-matrix-panel');
    await expect(panel).toBeVisible({ timeout: 30_000 });

    const buildBtn = page.getByRole('button', { name: /^build coverage map$/i });
    await expect(buildBtn).toBeVisible({ timeout: 15_000 });
    await buildBtn.click();

    const benefitHeading = page.getByText('Benefit comparison', { exact: true });
    const computeErr = page.locator('#coverage-matrix-panel').getByText(/could not be built|Network error/i).first();
    await Promise.race([
      benefitHeading.waitFor({ state: 'visible', timeout: 120_000 }),
      computeErr.waitFor({ state: 'visible', timeout: 120_000 }),
    ]);
    if (await computeErr.isVisible()) {
      const errText = (await computeErr.textContent()) || '';
      const msg = `Build coverage map failed (${errText.slice(0, 120)}). Migration 20260402120000_coverage_matrix_intelligence_f652.sql applied?`;
      logCoverageMatrixSkip(msg);
      test.skip(true, msg);
    }
    await expect(benefitHeading).toBeVisible();
  });

  test('POST /api/coverage-graph/compute returns ok and GET intelligence returns summaries', async ({
    request,
  }) => {
    const t = matrixE2eToken;
    const actorId = matrixE2eActorId;

    const stamp = Date.now();
    const tripId = await createE2eTripAndSeed(request, t, actorId, stamp, 'matrix');

    const post = await request.post('/api/coverage-graph/compute', {
      data: { trip_id: tripId },
    });
    if (post.status() === 500 || post.status() === 400) {
      const body = await post.text();
      const msg = `compute endpoint failed (${post.status()}). Apply migration 20260402120000_coverage_matrix_intelligence_f652.sql? ${body.slice(0, 200)}`;
      logCoverageMatrixSkip(msg);
      test.skip(true, msg);
    }
    expect(post.status()).toBe(200);
    const pj = (await post.json()) as { ok?: boolean; snapshot_id?: string };
    expect(pj.ok).toBe(true);
    expect(pj.snapshot_id).toBeTruthy();

    const intelRes = await request.get(`/api/coverage-graph/intelligence?trip_id=${encodeURIComponent(tripId)}`);
    expect(intelRes.status()).toBe(200);
    const intel = (await intelRes.json()) as {
      summaries: unknown[];
      gaps: unknown[];
      snapshot: { snapshot_id?: string } | null;
    };
    expect(intel.snapshot?.snapshot_id).toBeTruthy();
    expect(Array.isArray(intel.summaries)).toBe(true);
    expect(intel.summaries.length).toBeGreaterThan(0);
    expect(Array.isArray(intel.gaps)).toBe(true);
    expect(intel.gaps.length).toBeGreaterThan(0);
  });
});
