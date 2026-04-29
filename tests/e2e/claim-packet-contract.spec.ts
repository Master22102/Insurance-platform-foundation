import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { setupRoutingReadyIncident } from './utils/routingReadyIncident';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

test.describe('Claim packet RPC contract (ownership + idempotency)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('returns routing_not_ready when incident is not CLAIM_ROUTING_READY', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now();
    const { actorId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      stopAt: 'REVIEW_PENDING',
    });

    const res = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-packet-not-ready-${stamp}`,
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      success: false,
      error: 'routing_not_ready',
    });
  });

  test('returns forbidden when actor_id mismatches auth user', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now();
    const { incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp);

    const badActor = '00000000-0000-0000-0000-000000000000';
    const res = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: badActor,
      p_idempotency_key: `e2e-packet-bad-actor-${stamp}`,
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      success: false,
      error: 'forbidden',
    });
  });

  test('is idempotent for same incident + idempotency key', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now();
    const { actorId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp);
    const idemKey = `e2e-packet-idem-${stamp}`;

    const first = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: idemKey,
    });

    expect(first.status, JSON.stringify(first.error)).toBe(200);
    const f = first.data as Record<string, unknown>;
    expect(f?.success).toBe(true);
    expect(f?.idempotent).toBe(false);
    expect(f?.packet_id).toBeTruthy();

    const second = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: idemKey,
    });

    expect(second.status, JSON.stringify(second.error)).toBe(200);
    const s = second.data as Record<string, unknown>;
    expect(s?.success).toBe(true);
    expect(s?.idempotent).toBe(true);
    expect(s?.packet_id).toBe(f.packet_id);

    const rows = await supabaseRestSelect<Array<{ packet_id: string }>>(
      request,
      accessToken,
      'claim_packets',
      `select=packet_id&incident_id=eq.${incidentId}`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].packet_id).toBe(f.packet_id);
  });

  test('creates a new packet when idempotency key changes', async ({ request }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now();
    const { actorId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp);

    const first = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-packet-k1-${stamp}`,
    });
    expect(first.status, JSON.stringify(first.error)).toBe(200);
    expect((first.data as Record<string, unknown>)?.success).toBe(true);

    const second = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-packet-k2-${stamp}`,
    });
    expect(second.status, JSON.stringify(second.error)).toBe(200);
    const s = second.data as Record<string, unknown>;
    expect(s?.success).toBe(true);
    expect(s?.idempotent).toBe(false);

    expect(s?.packet_id).not.toBe((first.data as Record<string, unknown>)?.packet_id);
  });
});
