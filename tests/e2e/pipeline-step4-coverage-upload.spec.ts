import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';
import { createDraftTripForStep4, unlockTripForStep4 } from './utils/step4TripSetup';
import {
  runDeepScanFromTripCoverageTab,
  uploadTxtPolicyAndWaitProcessed,
} from './utils/step4UploadAndScan';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestPost,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

/**
 * Step 4 scenarios from docs/CORE_PIPELINE_STATUS.md (upload + coverage UX).
 * Uses **PDF/TXT** only — `/policies/upload` rejects other types today.
 *
 * DB: **`20260328120000_scan_connector_axis_results.sql`** for REST axis persistence test.
 */
test.describe('Pipeline step 4: coverage + upload (CORE_PIPELINE_STATUS)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('S30 locked trip — Coverage shows unlock gate (no per-trip policy list)', async ({ page, request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    /* DRAFT trips redirect to /draft — use PRE_TRIP + locked to reach main trip Coverage tab (CORE S30). */
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's30', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });

    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(new RegExp(`/trips/${tripId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^coverage$/i }).click();
    await expect(page.getByText(/coverage analysis requires an unlocked trip/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('link', { name: /upload a policy/i })).toHaveCount(0);
  });

  test('S04 unlocked trip — Upload a policy opens /policies/upload with trip_id', async ({ page, request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's04', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s04-unlock-${stamp}`);

    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^coverage$/i }).click();
    await page.getByRole('link', { name: /upload a policy/i }).click();
    await expect(page).toHaveURL(new RegExp(`/policies/upload\\?trip_id=${tripId}`));
  });

  test('S01 global upload — no trip_id, policy row with null trip_id', async ({ page, request }) => {
    test.setTimeout(240_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();

    await uploadTxtPolicyAndWaitProcessed(page, { tripId: null, label: `E2E S01 global ${stamp}` });

    const rows = await supabaseRestSelect<Array<{ policy_id: string; trip_id: string | null }>>(
      request,
      accessToken,
      'policies',
      `account_id=eq.${actorId}&trip_id=is.null&select=policy_id,trip_id&order=created_at.desc&limit=3`,
    );
    expect(
      rows.some((r) => r.trip_id === null),
      'Expected at least one policy with trip_id IS NULL after global upload',
    ).toBe(true);
  });

  test('S02 TXT upload with trip_id reaches processed UI', async ({ page, request }) => {
    test.setTimeout(240_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's02', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s02-unlock-${stamp}`);

    await uploadTxtPolicyAndWaitProcessed(page, { tripId, label: `E2E AA CoC ${stamp}` });
  });

  test('S20 two policies on trip — + Add policy second upload', async ({ page, request }) => {
    test.setTimeout(360_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's20', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s20-unlock-${stamp}`);

    const runUpload = async (label: string) => {
      await uploadTxtPolicyAndWaitProcessed(page, { tripId, label });
    };

    await runUpload(`E2E Policy A ${stamp}`);

    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^coverage$/i }).click();
    await page.getByRole('link', { name: /\+ add policy/i }).click();
    await expect(page).toHaveURL(new RegExp(`/policies/upload\\?trip_id=${tripId}`));

    await runUpload(`E2E Policy B ${stamp}`);

    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^coverage$/i }).click();
    await expect(page.getByText(/^2 policies$/i)).toBeVisible({ timeout: 60_000 });
  });

  test('S31 unlocked trip with zero policies — no Deep Scan panel until first policy', async ({ page, request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's31', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s31-unlock-${stamp}`);

    await page.goto(`/trips/${tripId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(new RegExp(`/trips/${tripId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^coverage$/i }).click();
    /* Copy is a <p>, not a heading role */
    await expect(page.getByText(/no policies attached yet/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /run deep scan/i })).toHaveCount(0);
  });

  test('S32 upload → Deep Scan complete (job_queue) + policies_analyzed ≥ 1', async ({ page, request }) => {
    test.setTimeout(300_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's32', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s32-unlock-${stamp}`);

    await uploadTxtPolicyAndWaitProcessed(page, { tripId, label: `E2E S32 policy ${stamp}` });
    await runDeepScanFromTripCoverageTab(page, tripId);

    await expect(page.getByText(/1 policy analyzed|2 policies analyzed/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('S40 graph COMPLETE after real upload + Deep Scan (no e2e_seed)', async ({ page, request }) => {
    test.setTimeout(360_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's40', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s40-unlock-${stamp}`);

    await uploadTxtPolicyAndWaitProcessed(page, { tripId, label: `E2E S40 policy ${stamp}` });
    await runDeepScanFromTripCoverageTab(page, tripId);

    const deadline = Date.now() + 90_000;
    let snapRows: Array<{ snapshot_id: string; graph_status: string }> = [];
    while (Date.now() < deadline) {
      snapRows = await supabaseRestSelect<Array<{ snapshot_id: string; graph_status: string }>>(
        request,
        accessToken,
        'coverage_graph_snapshots',
        `trip_id=eq.${tripId}&graph_status=eq.COMPLETE&select=snapshot_id,graph_status&order=computation_timestamp.desc&limit=1`,
      );
      if (snapRows.length >= 1) break;
      await new Promise((r) => setTimeout(r, 2500));
    }
    expect(
      snapRows.length,
      'Expected coverage_graph_snapshots COMPLETE after Deep Scan → computeCoverageGraphForTrip (apply migrations + SUPABASE_SERVICE_ROLE_KEY for extraction sync).',
    ).toBe(1);
  });

  test('S41 second policy changes coverage graph input_hash or node count', async ({ page, request }) => {
    test.setTimeout(420_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 's41', {
      maturityState: 'PRE_TRIP_STRUCTURED',
    });
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-s41-unlock-${stamp}`);

    await uploadTxtPolicyAndWaitProcessed(page, { tripId, label: `E2E S41 A ${stamp}` });

    const g1 = await supabaseRpc(request, accessToken, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(g1.status, JSON.stringify(g1.error ?? g1.data)).toBe(200);
    const row1 = g1.data as Record<string, unknown>;
    expect(row1?.ok).toBe(true);
    const hash1 = String(row1?.input_hash ?? '');
    const nodes1 = Number(row1?.total_nodes ?? 0);

    await uploadTxtPolicyAndWaitProcessed(page, { tripId, label: `E2E S41 B ${stamp}` });

    const g2 = await supabaseRpc(request, accessToken, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(g2.status, JSON.stringify(g2.error ?? g2.data)).toBe(200);
    const row2 = g2.data as Record<string, unknown>;
    expect(row2?.ok).toBe(true);
    const hash2 = String(row2?.input_hash ?? '');
    const nodes2 = Number(row2?.total_nodes ?? 0);

    expect(
      hash2 !== hash1 || nodes2 !== nodes1,
      `Expected graph to change after second policy (hash1=${hash1} hash2=${hash2} nodes1=${nodes1} nodes2=${nodes2})`,
    ).toBe(true);
  });

  test('scan_connector_axis_results: authenticated insert + select', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const me = await supabaseRestSelect<Array<{ user_id: string }>>(
      request,
      accessToken,
      'user_profiles',
      'select=user_id&limit=1',
    );
    expect(me.length).toBeGreaterThan(0);
    const actorId = me[0].user_id;
    const stamp = Date.now();
    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, 'axis-row');
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-axis-unlock-${stamp}`);

    const axisPayload = [
      {
        axis: 'transit_reliability',
        status: 'degraded',
        source: 'e2e',
        summary: 'fixture',
        fetchedAt: new Date().toISOString(),
      },
    ];

    const ins = await supabaseRestPost<unknown[]>(
      request,
      accessToken,
      'scan_connector_axis_results',
      {
        trip_id: tripId,
        account_id: actorId,
        job_queue_id: null,
        axis_results: axisPayload,
      },
      'return=representation',
    );

    expect(
      ins.status,
      `Expected 201 from scan_connector_axis_results insert — apply migration 20260328120000_scan_connector_axis_results.sql if missing table. Body: ${JSON.stringify(ins.data)}`,
    ).toBe(201);

    const rows = await supabaseRestSelect<Array<{ id: string; axis_results: unknown }>>(
      request,
      accessToken,
      'scan_connector_axis_results',
      `trip_id=eq.${tripId}&select=id,axis_results&limit=1`,
    );
    expect(rows.length).toBe(1);
    expect(Array.isArray(rows[0]?.axis_results)).toBe(true);
  });
});
