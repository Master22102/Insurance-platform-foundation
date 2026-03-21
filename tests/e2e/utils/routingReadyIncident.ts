import { expect, type APIRequestContext } from '@playwright/test';
import { supabaseRestSelect, supabaseRpc } from './supabaseRest';

export type RoutingReadySetup = { actorId: string; tripId: string; incidentId: string };

/**
 * Creates trip → incident → evidence → status chain up to CLAIM_ROUTING_READY (or stops at REVIEW_PENDING).
 */
export async function setupRoutingReadyIncident(
  request: APIRequestContext,
  accessToken: string,
  suiteStamp: number,
  options?: { stopAt?: 'REVIEW_PENDING' | 'CLAIM_ROUTING_READY'; suiteTag?: string },
): Promise<RoutingReadySetup> {
  const suiteTag = options?.suiteTag ?? 'claim-packet-contract';
  const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, accessToken, 'user_profiles', 'select=user_id&limit=1');
  expect(me.length).toBeGreaterThan(0);
  const actorId = me[0].user_id;

  const createTrip = await supabaseRpc(request, accessToken, 'create_trip', {
    p_trip_name: `E2E routing-ready ${suiteStamp}`,
    p_account_id: actorId,
    p_maturity_state: 'DRAFT',
    p_jurisdiction_ids: [],
    p_travel_mode_primary: 'air',
    p_is_group_trip: false,
    p_group_id: null,
    p_metadata: { e2e: true, suite: suiteTag },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-trip-${suiteTag}-${suiteStamp}`,
    p_destination_summary: 'Lisbon, PT',
    p_departure_date: '2026-04-10',
    p_return_date: '2026-04-16',
  });
  expect(createTrip.status, JSON.stringify(createTrip.error)).toBe(200);
  const tripData = createTrip.data as Record<string, unknown>;
  expect(tripData?.success).toBe(true);
  const tripId = tripData.trip_id as string;
  expect(tripId).toBeTruthy();

  const createIncident = await supabaseRpc(request, accessToken, 'create_incident', {
    p_trip_id: tripId,
    p_title: `E2E disruption ${suiteStamp}`,
    p_description: 'Carrier delay and missed connection',
    p_classification: 'External',
    p_control_type: 'External',
    p_metadata: { disruption_type: 'flight_delay', e2e: true },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-incident-${suiteTag}-${suiteStamp}`,
  });
  expect(createIncident.status, JSON.stringify(createIncident.error)).toBe(200);
  const incData = createIncident.data as Record<string, unknown>;
  expect(incData?.success).toBe(true);
  const incidentId = incData.incident_id as string;
  expect(incidentId).toBeTruthy();

  const evidence = await supabaseRpc(request, accessToken, 'register_evidence', {
    p_incident_id: incidentId,
    p_type: 'other',
    p_name: 'E2E routing evidence',
    p_description: 'Receipt + delay email',
    p_metadata: { category: 'claim_submission_record', e2e: true },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-evidence-${suiteTag}-${suiteStamp}`,
  });
  expect(evidence.status, JSON.stringify(evidence.error)).toBe(200);
  expect((evidence.data as Record<string, unknown>)?.success).toBe(true);

  const chain = ['EVIDENCE_GATHERING', 'REVIEW_PENDING', 'CLAIM_ROUTING_READY'] as const;
  const stopAt = options?.stopAt ?? 'CLAIM_ROUTING_READY';
  const endIdx = chain.indexOf(stopAt);
  expect(endIdx).toBeGreaterThanOrEqual(0);
  for (let i = 0; i <= endIdx; i++) {
    const status = chain[i];
    const res = await supabaseRpc(request, accessToken, 'change_incident_status', {
      p_incident_id: incidentId,
      p_new_status: status,
      p_actor_id: actorId,
      p_reason_code: 'e2e_setup',
    });
    expect(res.status, JSON.stringify(res.error)).toBe(200);
    const r = res.data as Record<string, unknown>;
    expect(r?.success).toBe(true);
    expect(r?.new_status).toBe(status);
  }

  return { actorId, tripId, incidentId };
}
