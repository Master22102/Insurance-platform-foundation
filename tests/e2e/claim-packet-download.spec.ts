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

test.describe('Claim packet PDF (F-6.5.14)', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('GET /api/claim-packet/generate returns a non-empty PDF', async ({ page }) => {
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    const stamp = Date.now();
    const { actorId, tripId, incidentId } = await setupRoutingReadyIncident(page.request, accessToken, stamp, {
      suiteTag: 'claim-packet-pdf',
    });

    const graph = await supabaseRpc(page.request, accessToken, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(graph.status, JSON.stringify(graph.error)).toBe(200);
    const g = graph.data as Record<string, unknown>;
    expect(g?.ok).toBe(true);

    const routed = await supabaseRpc(page.request, accessToken, 'route_claim', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-pdf-route-${stamp}`,
    });
    expect(routed.status, JSON.stringify(routed.error)).toBe(200);
    expect((routed.data as Record<string, unknown>)?.success).toBe(true);

    const packetRpc = await supabaseRpc(page.request, accessToken, 'create_claim_packet_from_incident', {
      p_incident_id: incidentId,
      p_actor_id: actorId,
      p_idempotency_key: `e2e-pdf-packet-${stamp}`,
    });
    expect(packetRpc.status, JSON.stringify(packetRpc.error)).toBe(200);
    const p = packetRpc.data as Record<string, unknown>;
    expect(p?.success).toBe(true);
    const packetId = p.packet_id as string;
    expect(packetId).toBeTruthy();

    const rows = await supabaseRestSelect<Array<{ packet_payload: unknown }>>(
      page.request,
      accessToken,
      'claim_packets',
      `select=packet_payload&packet_id=eq.${packetId}`,
    );
    expect(rows.length).toBe(1);
    const payload = rows[0].packet_payload as Record<string, unknown>;
    expect(payload?.incident_title).toBeTruthy();
    expect(payload?.routing_decision).toBeTruthy();

    await page.goto('/');
    const res = await page.request.get(`/api/claim-packet/generate?packet_id=${encodeURIComponent(packetId)}`);
    expect(res.status(), await res.text()).toBe(200);
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    expect(ct).toContain('application/pdf');
    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(400);
    expect(Buffer.from(body).subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });
});
