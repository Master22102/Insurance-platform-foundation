import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';
import { createDraftTripForStep4, unlockTripForStep4 } from './utils/step4TripSetup';
import { runDeepScanFromTripCoverageTab, uploadTxtPolicyAndWaitProcessed } from './utils/step4UploadAndScan';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

/**
 * Step 4D readiness gate: DRAFT trips stay on Draft Home until `confirm_trip_readiness`
 * advances to PRE_TRIP_STRUCTURED. Requires migration
 * `20260331140000_step4d_draft_home_readiness_gate.sql` on the linked Supabase project.
 *
 * Deep Scan UI path reuses S32 helpers (upload + E2E autocomplete flags from `playwright.config.ts`).
 *
 * If this file **skips**: open `npx playwright show-report` and read the skip reason, or run
 * **`npm run e2e:draft-readiness`** (Chromium only). Typical fixes: `.env.local` with
 * `NEXT_PUBLIC_SUPABASE_*`, then **`npm run e2e:auth`** while **`npm run dev`** is up.
 */
test.describe('Draft readiness gate (Step 4D)', () => {
  // Avoid loading a missing path (Playwright errors). When absent, test body skips with a full path.
  if (hasStorageState()) {
    test.use({ storageState: getStorageStatePath() });
  }

  test('DRAFT routing gate → RPC readiness → PRE_TRIP_STRUCTURED → Deep Scan', async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);

    test.skip(
      !hasSupabaseEnv(),
      [
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        'Add both to .env.local in the app root (Insurance-platform-foundation-main).',
        'Playwright loads .env.local in playwright.config.ts; run tests from that folder.',
      ].join(' '),
    );

    test.skip(
      !hasStorageState(),
      [
        `No auth storage at: ${getStorageStatePath()}`,
        'Run: npm run e2e:auth (with npm run dev on http://127.0.0.1:3000).',
        'Windows: use desktop PowerShell or scripts/e2e/open-e2e-auth.cmd if no browser opens from the IDE.',
        'See tests/e2e/README.md § Fresh clone.',
      ].join(' — '),
    );

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
    const actorId = me[0]!.user_id;
    const stamp = Date.now();
    const tag = 'readiness-gate';

    const tripId = await createDraftTripForStep4(request, accessToken, actorId, stamp, tag, {
      maturityState: 'DRAFT',
    });
    const tripIdRe = tripId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1) Draft Home — canonical DRAFT surface (Step 4D).
    //
    // We open `/trips/:id/draft` directly instead of `/trips/:id` because the trip detail page
    // fetches with `.eq('created_by', user.id)`; if the Supabase session is still hydrating
    // (often WebKit when `storageState.json` was saved with another channel, e.g. Edge in
    // `npm run e2e:auth`), that fetch can return empty → `router.replace('/trips')` interrupts
    // `page.goto` with "Navigation interrupted…".
    await page.goto(`/trips/${tripId}/draft`, { waitUntil: 'load' });
    await page.waitForURL(new RegExp(`/trips/${tripIdRe}/draft`), { timeout: 25_000 });
    await expect(page.getByRole('heading', { name: /draft home/i })).toBeVisible({ timeout: 20_000 });

    // 2) At least one route segment with departure time (server readiness requires depart_at).
    const departIso = new Date('2026-05-10T14:00:00.000Z').toISOString();
    const arriveIso = new Date('2026-05-10T22:00:00.000Z').toISOString();
    const seg = await supabaseRpc(request, accessToken, 'upsert_route_segment', {
      p_trip_id: tripId,
      p_segment_type: 'flight',
      p_origin: 'JFK',
      p_destination: 'LIS',
      p_depart_at: departIso,
      p_arrive_at: arriveIso,
      p_reference: null,
      p_notes: null,
      p_sort_order: 0,
      p_actor_id: actorId,
    });
    expect(seg.status, JSON.stringify(seg.error)).toBe(200);
    const segData = seg.data as Record<string, unknown>;
    expect(segData?.success, JSON.stringify(seg.data)).toBe(true);

    // 3) evaluate_trip_readiness
    const ev = await supabaseRpc(request, accessToken, 'evaluate_trip_readiness', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    if (ev.status !== 200) {
      test.skip(
        true,
        `evaluate_trip_readiness failed HTTP ${ev.status}: ${JSON.stringify(ev.data)} — apply migration 20260331140000_step4d_draft_home_readiness_gate.sql`,
      );
    }
    const evData = ev.data as Record<string, unknown>;
    expect(evData?.success, JSON.stringify(ev.data)).toBe(true);
    expect(evData?.ready, JSON.stringify(ev.data)).toBe(true);

    // 4) confirm_trip_readiness
    const conf = await supabaseRpc(request, accessToken, 'confirm_trip_readiness', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(conf.status, JSON.stringify(conf.error)).toBe(200);
    const confData = conf.data as Record<string, unknown>;
    if (confData?.ok === false && confData?.reason === 'Blocked by governance guard') {
      test.skip(true, 'precheck_mutation_guard blocked confirm (region LOCKDOWN / governance).');
    }
    expect(confData?.ok, JSON.stringify(conf.data)).toBe(true);
    expect(confData?.new_state).toBe('PRE_TRIP_STRUCTURED');

    // 5) Trip row
    const rows = await supabaseRestSelect<Array<{ maturity_state: string; itinerary_hash: string | null }>>(
      request,
      accessToken,
      'trips',
      `trip_id=eq.${tripId}&select=maturity_state,itinerary_hash&limit=1`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0]?.maturity_state).toBe('PRE_TRIP_STRUCTURED');
    expect(rows[0]?.itinerary_hash).toBeTruthy();

    // 6) Event ledger — trip_readiness_confirmed
    const ledger = await supabaseRestSelect<Array<{ event_type: string; reason_code: string | null }>>(
      request,
      accessToken,
      'event_ledger',
      `scope_id=eq.${tripId}&event_type=eq.trip_readiness_confirmed&select=event_type,reason_code&order=created_at.desc&limit=5`,
    );
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.some((r) => r.event_type === 'trip_readiness_confirmed')).toBe(true);

    // 7) Trip home loads (no Draft Home redirect); Coverage → upload → Deep Scan (E2E stub completion).
    await unlockTripForStep4(request, accessToken, tripId, actorId, `e2e-${tag}-unlock-${stamp}`);
    await uploadTxtPolicyAndWaitProcessed(page, {
      tripId,
      label: `E2E readiness gate ${stamp}`,
    });

    await runDeepScanFromTripCoverageTab(page, tripId);
  });
});
