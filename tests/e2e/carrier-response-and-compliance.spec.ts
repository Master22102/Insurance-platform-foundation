import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';
import { setupRoutingReadyIncident } from './utils/routingReadyIncident';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

test.describe('F-6.5.9 carrier responses + packet payload', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('add_carrier_response records structured rows', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now();
    const { actorId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      suiteTag: 'carrier-response',
    });

    const first = await supabaseRpc(request, accessToken, 'add_carrier_response', {
      p_incident_id: incidentId,
      p_action_type: 'rebooking_offered',
      p_action_label: 'Offered next flight',
      p_new_flight: 'ZZ999',
      p_actor_id: actorId,
    });
    expect(first.status, JSON.stringify(first.error)).toBe(200);
    expect((first.data as Record<string, unknown>)?.ok).toBe(true);

    const second = await supabaseRpc(request, accessToken, 'add_carrier_response', {
      p_incident_id: incidentId,
      p_action_type: 'meal_voucher_issued',
      p_action_label: 'Meal voucher',
      p_value_amount: 12,
      p_currency_code: 'USD',
      p_actor_id: actorId,
    });
    expect(second.status, JSON.stringify(second.error)).toBe(200);
    expect((second.data as Record<string, unknown>)?.ok).toBe(true);

    const rows = await supabaseRestSelect<Array<{ response_id: string; action_type: string }>>(
      request,
      accessToken,
      'carrier_responses',
      `select=response_id,action_type&incident_id=eq.${incidentId}`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('claim packet payload includes carrier_responses after routing', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now() + 1;
    const { actorId, tripId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      suiteTag: 'carrier-packet',
    });

    await supabaseRpc(request, accessToken, 'add_carrier_response', {
      p_incident_id: incidentId,
      p_action_type: 'no_response',
      p_action_label: 'No reply yet from carrier',
      p_actor_id: actorId,
    });

    const graph = await supabaseRpc(request, accessToken, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect((graph.data as Record<string, unknown>)?.ok).toBe(true);

    const routed = await supabaseRpc(request, accessToken, 'route_claim', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-carrier-route-${stamp}`,
    });
    expect((routed.data as Record<string, unknown>)?.success).toBe(true);

    const packetRpc = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-carrier-packet-${stamp}`,
    });
    expect((packetRpc.data as Record<string, unknown>)?.success).toBe(true);
    const packetId = (packetRpc.data as Record<string, unknown>).packet_id as string;

    const pktRows = await supabaseRestSelect<Array<{ packet_payload: { carrier_responses?: unknown[] } }>>(
      request,
      accessToken,
      'claim_packets',
      `select=packet_payload&packet_id=eq.${packetId}`,
    );
    expect(pktRows.length).toBe(1);
    const cr = pktRows[0].packet_payload?.carrier_responses;
    expect(Array.isArray(cr)).toBe(true);
    expect((cr as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('F-6.5.18 route validation banner on trip detail (Overview)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('Overview shows a schedule-conflict banner when segments overlap', async ({ page, request }) => {
    await ensureOnboarded(page);
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
    const actorId = me[0]!.user_id;
    const stamp = Date.now();

    const createTrip = await supabaseRpc(request, accessToken, 'create_trip', {
      p_trip_name: `E2E route banner ${stamp}`,
      p_account_id: actorId,
      /* Avoid /trips/:id → /draft redirect so the main trip page (Overview) loads */
      p_maturity_state: 'PRE_TRIP_STRUCTURED',
      p_jurisdiction_ids: [],
      p_travel_mode_primary: 'air',
      p_is_group_trip: false,
      p_group_id: null,
      p_metadata: { e2e: true, suite: 'route-banner' },
      p_actor_id: actorId,
      p_idempotency_key: `e2e-route-banner-trip-${stamp}`,
      p_destination_summary: 'Lisbon, PT',
      p_departure_date: '2026-05-01',
      p_return_date: '2026-05-20',
    });
    expect(createTrip.status, JSON.stringify(createTrip.error)).toBe(200);
    const tripData = createTrip.data as Record<string, unknown>;
    if (tripData?.success === false && String(tripData?.error || '').includes('governance')) {
      test.skip(true, 'precheck_mutation_guard blocked create_trip.');
    }
    expect(tripData?.success).toBe(true);
    const tripId = tripData.trip_id as string;
    expect(tripId).toBeTruthy();

    const seg1 = await supabaseRpc(request, accessToken, 'upsert_route_segment', {
      p_trip_id: tripId,
      p_segment_type: 'flight',
      p_origin: 'JFK',
      p_destination: 'LIS',
      p_depart_at: new Date('2026-05-10T10:00:00.000Z').toISOString(),
      p_arrive_at: new Date('2026-05-10T20:00:00.000Z').toISOString(),
      p_reference: null,
      p_notes: null,
      p_sort_order: 0,
      p_actor_id: actorId,
    });
    expect(seg1.status, JSON.stringify(seg1.error)).toBe(200);
    expect((seg1.data as Record<string, unknown>)?.success, JSON.stringify(seg1.data)).toBe(true);

    const seg2 = await supabaseRpc(request, accessToken, 'upsert_route_segment', {
      p_trip_id: tripId,
      p_segment_type: 'flight',
      p_origin: 'LIS',
      p_destination: 'CDG',
      p_depart_at: new Date('2026-05-10T12:00:00.000Z').toISOString(),
      p_arrive_at: new Date('2026-05-10T22:00:00.000Z').toISOString(),
      p_reference: null,
      p_notes: null,
      p_sort_order: 1,
      p_actor_id: actorId,
    });
    expect(seg2.status, JSON.stringify(seg2.error)).toBe(200);
    expect((seg2.data as Record<string, unknown>)?.success, JSON.stringify(seg2.data)).toBe(true);

    const tripIdRe = tripId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tripTitle = `E2E route banner ${stamp}`;
    /* WebKit often hydrates Supabase session after first navigation; trip detail redirects to /trips if fetch races. */
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(tripTitle)).toBeVisible({ timeout: 20_000 });
    await page.goto(`/trips/${tripId}`, { waitUntil: 'load' });
    await page.waitForURL(new RegExp(`/trips/${tripIdRe}(\\?|$)`), { timeout: 25_000 });
    await expect(page.getByText(/Route issues/i)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('GDPR erasure (service role)', () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Set SUPABASE_SERVICE_ROLE_KEY in the environment to run process_erasure_request integration checks.',
  );

  test('process_erasure_request RPC responds when migration is applied', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    test.skip(!url || !key, 'Missing Supabase URL or service role key');

    const res = await fetch(`${url}/rest/v1/rpc/process_erasure_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key!,
        Authorization: `Bearer ${key!}`,
      },
      body: JSON.stringify({
        /* Random account unlikely to collide with event_ledger.actor_id rows */
        p_account_id: randomUUID(),
        /* event_ledger.actor_id FK → auth.users; use NULL for smoke unless it is a real user id */
        p_actor_id: null,
        p_actor_kind: 'system',
        p_legal_basis: 'e2e_smoke',
      }),
    });

    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    if (res.status === 404) {
      test.skip(true, 'process_erasure_request not found — apply gdpr_erasure_processing migration.');
    }

    expect(res.status, `PostgREST body: ${JSON.stringify(body)}`).toBe(200);
    expect(body.ok, JSON.stringify(body)).toBe(true);
  });
});
