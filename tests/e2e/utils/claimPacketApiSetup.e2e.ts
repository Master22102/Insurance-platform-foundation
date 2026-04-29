import { expect, type APIRequestContext } from '@playwright/test';
import { setupRoutingReadyIncident } from './routingReadyIncident';
import { supabaseRpc } from './supabaseRest';

/** Minimal graph + route + packet for `/api/claim-packet/generate` contract tests. */
export async function createPacketIdForApiTest(
  request: APIRequestContext,
  accessToken: string,
  stamp: number,
  suiteTag: string,
): Promise<{ packetId: string; tripId: string }> {
  const { actorId, tripId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
    suiteTag,
  });
  const graph = await supabaseRpc(request, accessToken, 'compute_coverage_graph', {
    p_trip_id: tripId,
    p_actor_id: actorId,
  });
  expect(graph.status, JSON.stringify(graph.error)).toBe(200);
  expect((graph.data as { ok?: boolean }).ok).toBe(true);
  const routed = await supabaseRpc(request, accessToken, 'route_claim', {
    p_incident_id: incidentId,
    p_actor_id: actorId,
    p_idempotency_key: `e2e-api-contract-route-${stamp}`,
  });
  expect(routed.status, JSON.stringify(routed.error)).toBe(200);
  expect((routed.data as Record<string, unknown>)?.success).toBe(true);
  const packetRpc = await supabaseRpc(request, accessToken, 'create_claim_packet_from_incident', {
    p_incident_id: incidentId,
    p_actor_id: actorId,
    p_idempotency_key: `e2e-api-contract-packet-${stamp}`,
  });
  expect(packetRpc.status, JSON.stringify(packetRpc.error)).toBe(200);
  const p = packetRpc.data as Record<string, unknown>;
  expect(p?.success).toBe(true);
  const packetId = p.packet_id as string;
  expect(packetId).toBeTruthy();
  return { packetId, tripId };
}
