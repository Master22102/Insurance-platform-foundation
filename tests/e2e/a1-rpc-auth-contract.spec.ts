import { expect, test } from '@playwright/test';
import { hasStorageState, STORAGE_STATE_PATH } from './utils/authState';
import { setupRoutingReadyIncident } from './utils/routingReadyIncident';
import { hasSupabaseEnv, readAccessTokenFromStorageState, supabaseRpc } from './utils/supabaseRest';

/**
 * A1 — Negative RPC checks: SECURITY DEFINER helpers must bind actor to JWT.
 * Requires DB migrations `20260325100000_*` and `20260325101000_*` applied on Supabase.
 */
test.describe('A1 RPC auth contract (actor vs JWT)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: STORAGE_STATE_PATH });

  test('advance_trip_maturity returns forbidden when p_actor_id mismatches auth user', async ({
    request,
  }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, 'Could not read access token from storage state.');
    if (!accessToken) return;

    const badActor = '00000000-0000-0000-0000-000000000001';
    const res = await supabaseRpc(request, accessToken, 'advance_trip_maturity', {
      p_trip_id: '00000000-0000-0000-0000-000000000000',
      p_target_state: 'PRE_TRIP_STRUCTURED',
      p_actor_id: badActor,
      p_reason_code: 'e2e_a1_bad_actor',
      p_idempotency_key: null,
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      success: false,
      error: 'forbidden',
    });
  });

  test('route_claim returns forbidden when p_actor_id mismatches auth user', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, 'Could not read access token from storage state.');
    if (!accessToken) return;

    const stamp = Date.now();
    const { incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      suiteTag: 'a1-rpc-auth',
    });

    const badActor = '00000000-0000-0000-0000-000000000002';
    const res = await supabaseRpc(request, accessToken, 'route_claim', {
      p_incident_id: incidentId,
      p_actor_id: badActor,
      p_idempotency_key: `e2e-a1-route-claim-bad-actor-${stamp}`,
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      success: false,
      error: 'forbidden',
    });
  });
});
