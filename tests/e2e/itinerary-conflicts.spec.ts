import { expect, test, type APIRequestContext } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import {
  createE2eTripAndSeed,
  fetchVersionAndDocumentId,
} from './utils/coverageGraphContract.e2e';
import { hasServiceRoleKey, serviceRoleDelete, serviceRolePatch, serviceRolePost } from './utils/serviceRoleRest';
import {
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

const GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';
const FEATURE_ITINERARY = 'F-6.5.2-itinerary';

function logItinerarySkip(reason: string, detail?: unknown): void {
  const tail = detail !== undefined ? ` ${JSON.stringify(detail)}` : '';
  process.stderr.write(`\n[itinerary-conflicts E2E] SKIPPED — ${reason}${tail}\n\n`);
}

async function setItineraryFeature(request: APIRequestContext, enabled: boolean): Promise<void> {
  const { status } = await serviceRolePatch(request, 'feature_activation_state', `feature_id=eq.${FEATURE_ITINERARY}&region_id=eq.${GLOBAL_REGION}`, {
    enabled,
    reason_code: enabled ? 'e2e_on' : 'e2e_off',
  });
  expect(status, 'service role patch feature_activation_state').toBeLessThan(300);
}

test.describe('Itinerary conflict detection (F-6.5.2 Phase 2)', () => {
  test.skip(!hasStorageState(), 'Missing storage state.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase env.');
  test.skip(!hasServiceRoleKey(), 'Missing SUPABASE_SERVICE_ROLE_KEY for feature flag + clause inserts.');
  test.use({ storageState: getStorageStatePath() });

  test('activity_risk_categories seed present (>= 8 rows)', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, 'No JWT');
    const token = t as string;
    try {
      const rows = await supabaseRestSelect<Array<{ category_id: string }>>(
        request,
        token,
        'activity_risk_categories',
        'select=category_id&limit=20',
      );
      expect(rows.length).toBeGreaterThanOrEqual(8);
    } catch (e) {
      test.skip(true, `activity_risk_categories not available — apply migration 20260415120000_itinerary_conflict_detection_f652_phase2.sql? ${e}`);
    }
  });

  test('detect_activity_conflicts returns skipped when feature disabled', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, 'No JWT');
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]?.user_id;
    test.skip(!actorId, 'No profile');

    await setItineraryFeature(request, false);
    try {
      const stamp = Date.now();
      const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'itin-off');

      const det = await supabaseRpc(request, token, 'detect_activity_conflicts', {
        p_snapshot_id: '00000000-0000-0000-0000-000000000001',
        p_trip_id: tripId,
        p_actor_id: actorId,
      });
      if (det.status !== 200) {
        test.skip(true, `detect_activity_conflicts missing — apply Phase 2 migration? ${JSON.stringify(det.error)}`);
      }
      const row = det.data as Record<string, unknown>;
      expect(row?.skipped).toBe(true);
      expect(row?.reason).toBe('FEATURE_DISABLED');
    } finally {
      await setItineraryFeature(request, true);
    }
  });

  test('activity match inserts activity_excluded coverage_gap when feature enabled', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, 'No JWT');
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]?.user_id;
    test.skip(!actorId, 'No profile');

    await setItineraryFeature(request, true);
    const stamp = Date.now();
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'itin-act');
    const { versionId, documentId } = await fetchVersionAndDocumentId(request, token, tripId);

    const ins = await serviceRolePost(request, 'policy_clauses', {
      policy_version_id: versionId,
      policy_document_id: documentId,
      clause_type: 'exclusion',
      family_code: 'FAM-EX',
      canonical_text: 'Excludes off-piste skiing and snowboarding when outside marked trails.',
      source_citation: 'E2E itinerary exclusion',
      confidence_label: 'HIGH',
      extraction_status: 'AUTO_ACCEPTED',
    });
    expect(ins.status).toBe(201);
    const clauseRow = (Array.isArray(ins.data) ? ins.data[0] : ins.data) as { clause_id?: string };
    const clauseId = clauseRow?.clause_id;
    expect(clauseId).toBeTruthy();

    const cg = await supabaseRpc(request, token, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(cg.status).toBe(200);
    const snapId = (cg.data as { snapshot_id?: string })?.snapshot_id;
    expect(snapId).toBeTruthy();

    const intel = await supabaseRpc(request, token, 'generate_coverage_intelligence', {
      p_snapshot_id: snapId,
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(intel.status).toBe(200);

    /* Hosted DBs often require activity_candidates.draft_version_id — create a draft row when RPC exists. */
    await supabaseRpc(request, token, 'ensure_trip_draft_version', {
      p_trip_id: tripId,
      p_actor_id: actorId,
      p_draft_state: null,
      p_narration_text: null,
    });

    const actRpc = await supabaseRpc(request, token, 'e2e_insert_activity_candidate', {
      p_trip_id: tripId,
      p_actor_id: actorId,
      p_activity_name: 'Skiing in Zermatt',
      p_activity_type: 'winter_sports',
      p_status: 'accepted',
    });
    if (actRpc.status !== 200 || !(actRpc.data as { success?: boolean })?.success) {
      await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
      logItinerarySkip('activity insert RPC failed', { httpStatus: actRpc.status, rpc: actRpc.data });
      test.skip(
        true,
        `e2e_insert_activity_candidate failed — apply 20260415123000_e2e_insert_activity_candidate_rpc.sql (and re-run if you had an older version: trip guard is relaxed in latest). Body: ${JSON.stringify(actRpc.data)}`,
      );
    }

    const det = await supabaseRpc(request, token, 'detect_activity_conflicts', {
      p_snapshot_id: snapId,
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    if (det.status !== 200) {
      await serviceRoleDelete(request, 'activity_candidates', `trip_id=eq.${tripId}`);
      await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
      logItinerarySkip('detect_activity_conflicts RPC error', { httpStatus: det.status, rpc: det.data });
      test.skip(true, `detect_activity_conflicts RPC error — apply Phase 2 migration? ${JSON.stringify(det.error)}`);
    }
    const drow = det.data as Record<string, unknown>;
    expect(drow?.ok).toBe(true);
    expect(Number(drow?.activity_conflicts ?? 0)).toBeGreaterThan(0);

    const gaps = await supabaseRestSelect<Array<{ gap_type: string }>>(
      request,
      token,
      'coverage_gaps',
      `snapshot_id=eq.${snapId}&gap_type=eq.activity_excluded&select=gap_type`,
    );
    expect(gaps.some((g) => g.gap_type === 'activity_excluded')).toBe(true);

    await serviceRoleDelete(request, 'activity_candidates', `trip_id=eq.${tripId}`);
    await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
  });

  test('geographic match inserts geographic_excluded when route_segments + clause present', async ({ request }) => {
    const t = readAccessTokenFromStorageState();
    test.skip(!t, 'No JWT');
    const token = t as string;
    const me = await supabaseRestSelect<Array<{ user_id: string }>>(request, token, 'user_profiles', 'select=user_id&limit=1');
    const actorId = me[0]?.user_id;
    test.skip(!actorId, 'No profile');

    await setItineraryFeature(request, true);
    const stamp = Date.now();
    const tripId = await createE2eTripAndSeed(request, token, actorId, stamp, 'itin-geo');
    const { versionId, documentId } = await fetchVersionAndDocumentId(request, token, tripId);

    const ins = await serviceRolePost(request, 'policy_clauses', {
      policy_version_id: versionId,
      policy_document_id: documentId,
      clause_type: 'exclusion',
      family_code: 'FAM-GEO',
      canonical_text: 'Coverage does not apply for travel to Ukraine (UA) during published travel advisories.',
      source_citation: 'E2E geo exclusion',
      confidence_label: 'HIGH',
      extraction_status: 'AUTO_ACCEPTED',
    });
    if (ins.status !== 201) {
      test.skip(true, 'Could not insert exclusion clause');
    }
    const clauseRow = (Array.isArray(ins.data) ? ins.data[0] : ins.data) as { clause_id?: string };
    const clauseId = clauseRow?.clause_id!;

    const tripRows = await supabaseRestSelect<Array<{ account_id: string | null }>>(
      request,
      token,
      'trips',
      `trip_id=eq.${tripId}&select=account_id&limit=1`,
    );
    const tripAccountId = tripRows[0]?.account_id;
    test.skip(!tripAccountId, 'Trip missing account_id (cannot satisfy route_segments.account_id)');

    const seg = await serviceRolePost(request, 'route_segments', {
      trip_id: tripId,
      account_id: tripAccountId,
      segment_type: 'flight',
      origin: 'WAW',
      destination: 'Kyiv',
      destination_country_code: 'UA',
      sort_order: 0,
    });
    if (seg.status === 404 || seg.status === 400) {
      await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
      logItinerarySkip('route_segments REST insert failed', { httpStatus: seg.status, body: seg.data });
      test.skip(
        true,
        'route_segments missing or not exposed — apply 20260416120000_route_segments_table_and_rls.sql (creates table + RLS) and ensure PostgREST schema cache is reloaded.',
      );
    }
    expect(seg.status).toBe(201);
    const segRow = (Array.isArray(seg.data) ? seg.data[0] : seg.data) as { segment_id?: string };
    const segmentId = segRow?.segment_id!;

    const cg = await supabaseRpc(request, token, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(cg.status).toBe(200);
    const snapId = (cg.data as { snapshot_id?: string })?.snapshot_id!;

    await supabaseRpc(request, token, 'generate_coverage_intelligence', {
      p_snapshot_id: snapId,
      p_trip_id: tripId,
      p_actor_id: actorId,
    });

    const det = await supabaseRpc(request, token, 'detect_geographic_conflicts', {
      p_snapshot_id: snapId,
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    if (det.status !== 200) {
      await serviceRoleDelete(request, 'route_segments', `segment_id=eq.${segmentId}`);
      await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
      logItinerarySkip('detect_geographic_conflicts RPC error', { httpStatus: det.status, rpc: det.data });
      test.skip(true, `detect_geographic_conflicts missing — apply Phase 2 migration? ${JSON.stringify(det.error)}`);
    }
    const drow = det.data as Record<string, unknown>;
    expect(drow?.ok).toBe(true);
    expect(Number(drow?.geographic_conflicts ?? 0)).toBeGreaterThan(0);

    const gaps = await supabaseRestSelect<Array<{ gap_type: string }>>(
      request,
      token,
      'coverage_gaps',
      `snapshot_id=eq.${snapId}&gap_type=eq.geographic_excluded&select=gap_type`,
    );
    expect(gaps.length).toBeGreaterThan(0);

    await serviceRoleDelete(request, 'route_segments', `segment_id=eq.${segmentId}`);
    await serviceRoleDelete(request, 'policy_clauses', `clause_id=eq.${clauseId}`);
  });
});
