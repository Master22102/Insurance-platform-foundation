import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import {
  createE2eTripAndSeed,
  deleteClauseById,
  fetchVersionAndDocumentId,
  insertOverlapClause,
} from './utils/coverageGraphContract.e2e';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

test.describe('Coverage graph contract', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.use({ storageState: getStorageStatePath() });

  test('single policy: COMPLETE snapshot, nodes, event metadata', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]!.user_id;
    const stamp = Date.now();
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'cg-single');
    const g = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
    expect(g.status).toBe(200);
    const gd = g.data as Record<string, unknown>;
    expect(gd.ok).toBe(true);
    expect(['COMPLETE', 'CACHED']).toContain(gd.status);
    const nodes = await supabaseRestSelect<Array<{ node_id: string }>>(
      request,
      token,
      'coverage_nodes',
      `select=node_id&snapshot_id=eq.${String(gd.snapshot_id)}`,
    );
    expect(nodes.length).toBeGreaterThan(0);
    const ev = await supabaseRestSelect<Array<{ event_type: string }>>(
      request,
      token,
      'event_ledger',
      `event_type=eq.coverage_graph_computed&scope_type=eq.trip&scope_id=eq.${tripId}&select=event_type&order=created_at.desc&limit=1`,
    );
    expect(ev[0]?.event_type).toBe('coverage_graph_computed');
  });

  test('two cancellation clauses → overlap_count > 0 + overlap event', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]!.user_id;
    const stamp = Date.now() + 1;
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'cg-overlap');
    const { versionId, documentId } = await fetchVersionAndDocumentId(request, token, tripId);
    const extraClause = await insertOverlapClause(request, versionId, documentId);
    try {
      const g = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
      expect(g.status).toBe(200);
      const gd = g.data as { overlap_count?: number; ok?: boolean };
      expect(gd.ok).toBe(true);
      expect((gd.overlap_count ?? 0) > 0).toBeTruthy();
      const ev = await supabaseRestSelect<Array<{ event_type: string }>>(
        request,
        token,
        'event_ledger',
        `event_type=eq.coverage_overlap_detected&scope_id=eq.${tripId}&select=event_type&order=created_at.desc&limit=1`,
      );
      expect(ev[0]?.event_type).toBe('coverage_overlap_detected');
    } finally {
      await deleteClauseById(request, extraClause);
    }
  });

  test('second identical compute → CACHED + same snapshot_id', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]!.user_id;
    const stamp = Date.now() + 2;
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'cg-cache');
    const g1 = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
    expect(g1.status).toBe(200);
    const d1 = g1.data as { snapshot_id?: string; status?: string };
    const g2 = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
    const d2 = g2.data as { snapshot_id?: string; status?: string };
    expect(d2.status).toBe('CACHED');
    expect(d2.snapshot_id).toBe(d1.snapshot_id);
  });

  test('determinism: cached run preserves same snapshot node count', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]!.user_id;
    const stamp = Date.now() + 3;
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'cg-det');
    const g1 = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
    const sid = (g1.data as { snapshot_id?: string }).snapshot_id!;
    const n1 = await supabaseRestSelect<Array<{ node_id: string }>>(
      request,
      token,
      'coverage_nodes',
      `snapshot_id=eq.${sid}&select=node_id`,
    );
    const g2 = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
    expect((g2.data as { status?: string }).status).toBe('CACHED');
    const n2 = await supabaseRestSelect<Array<{ node_id: string }>>(
      request,
      token,
      'coverage_nodes',
      `snapshot_id=eq.${sid}&select=node_id`,
    );
    expect(n2.length).toBe(n1.length);
  });

  test('coverage_nodes reference valid version + clause', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, E2E_AUTH_SKIP_REASON);
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]!.user_id;
    const stamp = Date.now() + 4;
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'cg-fk');
    const g = await supabaseRpc(request, token, 'compute_coverage_graph', { p_trip_id: tripId, p_actor_id: actorId });
    const snap = (g.data as { snapshot_id?: string }).snapshot_id!;
    const nodes = await supabaseRestSelect<
      Array<{ policy_version_id: string; coverage_trigger_clause_id: string | null }>
    >(request, token, 'coverage_nodes', `snapshot_id=eq.${snap}&select=policy_version_id,coverage_trigger_clause_id`);
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      const pv = await supabaseRestSelect<Array<{ version_id: string }>>(
        request,
        token,
        'policy_versions',
        `version_id=eq.${n.policy_version_id}&select=version_id&limit=1`,
      );
      expect(pv.length).toBe(1);
      if (n.coverage_trigger_clause_id) {
        const pc = await supabaseRestSelect<Array<{ clause_id: string }>>(
          request,
          token,
          'policy_clauses',
          `clause_id=eq.${n.coverage_trigger_clause_id}&select=clause_id&limit=1`,
        );
        expect(pc.length).toBe(1);
      }
    }
  });
});
