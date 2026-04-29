import { expect, type APIRequestContext } from '@playwright/test';
import { supabaseRestSelect, supabaseRpc } from './supabaseRest';
import { serviceRoleDelete, serviceRolePost } from './serviceRoleRest';

export async function createE2eTripAndSeed(
  request: APIRequestContext,
  token: string,
  actorId: string,
  stamp: number,
  tag: string,
  options?: { maturityState?: 'DRAFT' | 'PRE_TRIP_STRUCTURED' },
): Promise<string> {
  const maturityState = options?.maturityState ?? 'DRAFT';
  const ct = await supabaseRpc(request, token, 'create_trip', {
    p_trip_name: `E2E graph ${tag} ${stamp}`,
    p_account_id: actorId,
    p_maturity_state: maturityState,
    p_jurisdiction_ids: [],
    p_travel_mode_primary: 'air',
    p_is_group_trip: false,
    p_group_id: null,
    p_metadata: { e2e: true, suite: tag },
    p_actor_id: actorId,
    p_idempotency_key: `e2e-graph-trip-${tag}-${stamp}`,
    p_destination_summary: 'Oslo, NO',
    p_departure_date: '2026-06-01',
    p_return_date: '2026-06-08',
  });
  expect(ct.status).toBe(200);
  const tripId = (ct.data as { trip_id?: string })?.trip_id;
  expect(tripId).toBeTruthy();
  const seed = await supabaseRpc(request, token, 'e2e_seed_minimal_coverage_for_trip', {
    p_trip_id: tripId,
    p_actor_id: actorId,
  });
  expect(seed.status).toBe(200);
  expect((seed.data as { success?: boolean })?.success).toBe(true);
  return tripId!;
}

export async function fetchVersionAndDocumentId(
  request: APIRequestContext,
  token: string,
  tripId: string,
): Promise<{ versionId: string; documentId: string }> {
  const pol = await supabaseRestSelect<Array<{ policy_id: string; active_version_id: string | null }>>(
    request,
    token,
    'policies',
    `trip_id=eq.${tripId}&select=policy_id,active_version_id&limit=1`,
  );
  const vid = pol[0]?.active_version_id;
  expect(vid).toBeTruthy();
  const docs = await supabaseRestSelect<Array<{ document_id: string }>>(
    request,
    token,
    'policy_documents',
    `policy_id=eq.${pol[0]!.policy_id}&select=document_id&limit=1`,
  );
  expect(docs[0]?.document_id).toBeTruthy();
  return { versionId: vid!, documentId: docs[0]!.document_id };
}

export async function insertOverlapClause(
  request: APIRequestContext,
  versionId: string,
  documentId: string,
): Promise<string> {
  const ins = await serviceRolePost(request, 'policy_clauses', {
    policy_version_id: versionId,
    policy_document_id: documentId,
    clause_type: 'cancellation_rule',
    canonical_text: 'E2E second cancellation overlap',
    source_citation: 'E2E',
    confidence_label: 'HIGH',
    extraction_status: 'AUTO_ACCEPTED',
  });
  expect(ins.status).toBe(201);
  const raw = ins.data as { clause_id?: string } | Array<{ clause_id?: string }>;
  const row = Array.isArray(raw) ? raw[0] : raw;
  expect(row?.clause_id).toBeTruthy();
  return row!.clause_id!;
}

export async function deleteClauseById(request: APIRequestContext, clauseId: string): Promise<void> {
  await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
}
