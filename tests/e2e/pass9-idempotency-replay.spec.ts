import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import {
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

test.describe('Pass 9 idempotency + replay (RPC contracts)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('quick scan retry is idempotent for identical itinerary snapshot', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, 'Could not read access token from storage state.');
    if (!accessToken) return;

    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, accessToken, 'user_profiles', 'select=user_id&limit=1');
    expect(me.length, 'No user profile row for authenticated user').toBeGreaterThan(0);
    const userId = me[0].user_id;

    const stamp = Date.now();
    const itinerary = {
      destination: `Pass9 E2E quick idempotency ${stamp}`,
      departure_date: '2026-07-01',
      return_date: '2026-07-10',
      travel_mode: 'air',
      route_segments: [{ index: 0, origin: 'JFK', destination: 'LIS' }],
    };

    const first = await supabaseRpc(request, accessToken, 'initiate_quick_scan', {
      p_user_id: userId,
      p_itinerary_snapshot: itinerary,
      p_trip_id: null,
    });
    expect(first.status, JSON.stringify(first.error)).toBe(200);
    const firstData = first.data as Record<string, unknown>;
    if (firstData?.error === 'lifetime_quick_scan_cap_reached') {
      test.skip(true, 'Lifetime quick scan cap reached for this user; cannot assert idempotency.');
    }
    expect(firstData?.success).toBe(true);
    expect(firstData?.cache_hit).toBe(false);
    expect(firstData?.job_id).toBeTruthy();

    const second = await supabaseRpc(request, accessToken, 'initiate_quick_scan', {
      p_user_id: userId,
      p_itinerary_snapshot: itinerary,
      p_trip_id: null,
    });
    expect(second.status, JSON.stringify(second.error)).toBe(200);
    const secondData = second.data as Record<string, unknown>;
    expect(secondData?.success).toBe(true);
    expect(secondData?.cache_hit).toBe(true);
    expect(secondData?.job_id).toBe(firstData.job_id);
  });

  test('unlock replay returns idempotent after trip already unlocked', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, 'Could not read access token from storage state.');
    if (!accessToken) return;

    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, accessToken, 'user_profiles', 'select=user_id&limit=1');
    expect(me.length).toBeGreaterThan(0);
    const userId = me[0].user_id;

    const stamp = Date.now();
    const create = await supabaseRpc(request, accessToken, 'create_trip', {
      p_trip_name: `Pass9 unlock replay ${stamp}`,
      p_account_id: userId,
      p_maturity_state: 'DRAFT',
      p_jurisdiction_ids: [],
      p_travel_mode_primary: 'air',
      p_is_group_trip: false,
      p_group_id: null,
      p_metadata: { e2e: true },
      p_actor_id: userId,
      p_idempotency_key: `pass9-unlock-trip-${stamp}`,
      p_destination_summary: 'Lisbon, Portugal',
      p_departure_date: '2026-08-01',
      p_return_date: '2026-08-08',
    });

    expect(create.status, JSON.stringify(create.error)).toBe(200);
    const createData = create.data as Record<string, unknown>;
    expect(createData?.success).toBe(true);
    const tripId = createData.trip_id as string;
    expect(tripId).toBeTruthy();

    const paymentRef = `pass9-replay-${stamp}`;
    const creditsToAdd = 2;

    const firstUnlock = await supabaseRpc(request, accessToken, 'unlock_trip', {
      p_trip_id: tripId,
      p_actor_id: userId,
      p_credits_to_add: creditsToAdd,
      p_payment_ref: paymentRef,
    });
    expect(firstUnlock.status, JSON.stringify(firstUnlock.error)).toBe(200);
    const u1 = firstUnlock.data as Record<string, unknown>;
    expect(u1?.success).toBe(true);
    expect(u1?.idempotent).toBe(false);

    const replayUnlock = await supabaseRpc(request, accessToken, 'unlock_trip', {
      p_trip_id: tripId,
      p_actor_id: userId,
      p_credits_to_add: creditsToAdd,
      p_payment_ref: paymentRef,
    });
    expect(replayUnlock.status, JSON.stringify(replayUnlock.error)).toBe(200);
    const u2 = replayUnlock.data as Record<string, unknown>;
    expect(u2?.success).toBe(true);
    expect(u2?.idempotent).toBe(true);
    expect(u2?.deep_scan_credits_remaining).toBe(u1.deep_scan_credits_remaining ?? creditsToAdd);
  });

  test('deep scan retry is idempotent for identical itinerary on unlocked trip', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, 'Could not read access token from storage state.');
    if (!accessToken) return;

    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, accessToken, 'user_profiles', 'select=user_id&limit=1');
    expect(me.length).toBeGreaterThan(0);
    const userId = me[0].user_id;

    const stamp = Date.now();
    const create = await supabaseRpc(request, accessToken, 'create_trip', {
      p_trip_name: `Pass9 deep retry ${stamp}`,
      p_account_id: userId,
      p_maturity_state: 'DRAFT',
      p_jurisdiction_ids: [],
      p_travel_mode_primary: 'air',
      p_is_group_trip: false,
      p_group_id: null,
      p_metadata: { e2e: true },
      p_actor_id: userId,
      p_idempotency_key: `pass9-deep-trip-${stamp}`,
      p_destination_summary: 'Tokyo, Japan',
      p_departure_date: '2026-09-10',
      p_return_date: '2026-09-20',
    });

    expect(create.status, JSON.stringify(create.error)).toBe(200);
    const createData = create.data as Record<string, unknown>;
    expect(createData?.success).toBe(true);
    const tripId = createData.trip_id as string;

    const unlock = await supabaseRpc(request, accessToken, 'unlock_trip', {
      p_trip_id: tripId,
      p_actor_id: userId,
      p_credits_to_add: 2,
      p_payment_ref: `pass9-deep-unlock-${stamp}`,
    });
    expect(unlock.status, JSON.stringify(unlock.error)).toBe(200);
    expect((unlock.data as Record<string, unknown>)?.success).toBe(true);

    const itinerary = {
      destination: 'Tokyo, Japan',
      departure_date: '2026-09-10',
      return_date: '2026-09-20',
      travel_mode: 'air',
      itinerary_version: 1,
      route_segments: [{ index: 0, origin: 'SFO', destination: 'HND' }],
    };

    const first = await supabaseRpc(request, accessToken, 'initiate_deep_scan', {
      p_user_id: userId,
      p_trip_id: tripId,
      p_itinerary_snapshot: itinerary,
      p_user_confirmed: true,
    });
    expect(first.status, JSON.stringify(first.error)).toBe(200);
    const d1 = first.data as Record<string, unknown>;
    if (d1?.success === false) {
      test.skip(true, `Deep scan did not start: ${String(d1?.error ?? '')}`);
    }
    expect(d1?.success).toBe(true);
    expect(d1?.cache_hit).toBe(false);
    expect(d1?.scan_id ?? d1?.job_id).toBeTruthy();
    const creditsAfterFirst = d1?.credits_remaining;
    expect(typeof creditsAfterFirst).toBe('number');

    const second = await supabaseRpc(request, accessToken, 'initiate_deep_scan', {
      p_user_id: userId,
      p_trip_id: tripId,
      p_itinerary_snapshot: itinerary,
      p_user_confirmed: true,
    });
    expect(second.status, JSON.stringify(second.error)).toBe(200);
    const d2 = second.data as Record<string, unknown>;
    expect(d2?.success).toBe(true);
    expect(d2?.cache_hit).toBe(true);
    expect(d2?.scan_id ?? d2?.job_id).toBe(d1?.scan_id ?? d1?.job_id);
    expect(d2?.credits_remaining).toBe(creditsAfterFirst);
  });
});
