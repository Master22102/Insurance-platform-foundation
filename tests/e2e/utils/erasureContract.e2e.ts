import { expect, type APIRequestContext } from '@playwright/test';
import {
  serviceRoleDelete,
  serviceRolePatch,
  serviceRolePost,
  serviceRoleRpc,
} from './serviceRoleRest';

export type ErasureFixtureIds = {
  tripId: string;
  incidentId: string;
  evidenceId: string;
  contactId: string;
  responseId: string;
};

function row(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  return (data ?? {}) as Record<string, unknown>;
}

/** Inserts trip → incident → evidence → contact → carrier_response for `process_erasure_request` tests. */
export async function insertErasureContractFixture(
  request: APIRequestContext,
  uid: string,
  stamp: number,
): Promise<ErasureFixtureIds> {
  const t = await serviceRolePost(request, 'trips', {
    trip_name: `E2E erasure trip ${stamp}`,
    created_by: uid,
    account_id: uid,
    maturity_state: 'DRAFT',
    jurisdiction_ids: [],
    travel_mode_primary: 'air',
    is_group_trip: false,
    lifecycle_flags: { e2e_erasure: true },
    destination_summary: 'Secret Lisbon HQ',
    departure_date: '2026-08-01',
    return_date: '2026-08-09',
  });
  expect(t.status, JSON.stringify(t.data)).toBe(201);
  const tripId = row(t.data).trip_id as string;

  const inc = await serviceRolePost(request, 'incidents', {
    trip_id: tripId,
    title: 'Secret incident title',
    description: 'Secret incident body',
    status: 'Capture',
    canonical_status: 'OPEN',
    classification: 'External',
    control_type: 'External',
    created_by: uid,
    metadata: {},
  });
  expect(inc.status, JSON.stringify(inc.data)).toBe(201);
  const incidentId = row(inc.data).id as string;

  const ev = await serviceRolePost(request, 'evidence', {
    incident_id: incidentId,
    type: 'other',
    name: 'secret-receipt.pdf',
    description: 'Secret evidence notes',
    created_by: uid,
  });
  expect(ev.status, JSON.stringify(ev.data)).toBe(201);
  const evidenceId = row(ev.data).id as string;

  const c = await serviceRolePost(request, 'contacts', {
    account_id: uid,
    contact_type: 'other',
    name: 'Secret Contact',
    phone: '+15551212',
    email: 'secret@example.com',
    organization: 'ACME',
    notes: 'call me',
  });
  expect(c.status, JSON.stringify(c.data)).toBe(201);
  const contactId = row(c.data).contact_id as string;

  const cr = await serviceRolePost(request, 'carrier_responses', {
    incident_id: incidentId,
    trip_id: tripId,
    account_id: uid,
    action_type: 'rebooking_offered',
    action_label: 'Rebook',
    notes: 'Carrier confidential notes',
    carrier_ref: 'ABC123',
  });
  expect(cr.status, JSON.stringify(cr.data)).toBe(201);
  const responseId = row(cr.data).response_id as string;

  return { tripId, incidentId, evidenceId, contactId, responseId };
}

export async function runProcessErasure(
  request: APIRequestContext,
  accountId: string,
  actorId: string,
): Promise<{ data: unknown; status: number }> {
  return serviceRoleRpc(request, 'process_erasure_request', {
    p_account_id: accountId,
    p_actor_id: actorId,
    p_actor_kind: 'system',
    p_legal_basis: 'right_to_erasure',
    p_jurisdiction: 'EU',
    p_request_reference: `e2e-erasure-${Date.now()}`,
  });
}

/** Removes seeded rows; best-effort restore disposable profile display name. */
export async function teardownErasureFixture(
  request: APIRequestContext,
  ids: ErasureFixtureIds,
  uid: string,
): Promise<void> {
  await serviceRoleDelete(request, 'trips', `trip_id=eq.${ids.tripId}`);
  await serviceRoleDelete(request, 'contacts', `contact_id=eq.${ids.contactId}`);
  await serviceRolePatch(request, 'user_profiles', `user_id=eq.${uid}`, {
    display_name: 'E2E Erasure Disposable',
  });
}
