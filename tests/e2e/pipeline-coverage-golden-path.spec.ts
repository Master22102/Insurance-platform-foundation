import { expect, test } from '@playwright/test';
import { getStorageStatePath, hasStorageState } from './utils/authState';
import { ensureOnboarded } from './utils/ensureOnboarded';
import { setupRoutingReadyIncident } from './utils/routingReadyIncident';
import {
  E2E_AUTH_SKIP_REASON,
  hasSupabaseEnv,
  readAccessTokenFromStorageState,
  supabaseRestSelect,
  supabaseRpc,
} from './utils/supabaseRest';

/**
 * Golden path: e2e trip seed → CLAIM_ROUTING_READY → browser /route submit
 * (compute_coverage_graph + route_claim + packet) → REST asserts graph + claim_routing_decisions.
 *
 * Requires DB migrations:
 * - 20260326120000_e2e_seed_minimal_coverage_for_trip.sql
 * - 20260327120000_fix_compute_coverage_graph_no_itr_updates.sql (no ITR UPDATE)
 * - 20260328100000_interpretive_trace_records_extended_columns.sql (trace_category / scope_* columns)
 * - 20260328110000_route_claim_normalize_alignment_confidence.sql (HIGH → high for routing row CHECK)
 */
test.describe('Pipeline: coverage graph + route_claim golden path', () => {
  test.skip(!hasStorageState(), 'Missing .playwright/storageState.json; run npm run e2e:auth first.');
  test.skip(!hasSupabaseEnv(), 'Missing Supabase public env vars.');
  test.use({ storageState: getStorageStatePath() });

  test('REST + UI: graph COMPLETE, routing row, packet, SUBMITTED', async ({ page, request }) => {
    test.setTimeout(240_000);
    const accessToken = readAccessTokenFromStorageState();
    test.skip(!accessToken, E2E_AUTH_SKIP_REASON);
    if (!accessToken) return;

    await ensureOnboarded(page);
    const stamp = Date.now();
    const { actorId, tripId, incidentId } = await setupRoutingReadyIncident(request, accessToken, stamp, {
      suiteTag: 'pipeline-golden-path',
    });

    const graphBefore = await supabaseRpc(request, accessToken, 'compute_coverage_graph', {
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    expect(graphBefore.status, JSON.stringify(graphBefore.error ?? graphBefore.data)).toBe(200);
    const g0 = graphBefore.data as Record<string, unknown>;
    expect(g0?.ok).toBe(true);
    expect(['COMPLETE', 'CACHED']).toContain(g0?.status);

    const snapRows = await supabaseRestSelect<
      Array<{ snapshot_id: string; graph_status: string; input_hash: string }>
    >(
      request,
      accessToken,
      'coverage_graph_snapshots',
      `trip_id=eq.${tripId}&graph_status=eq.COMPLETE&select=snapshot_id,graph_status,input_hash&order=computation_timestamp.desc&limit=1`,
    );
    expect(snapRows.length).toBe(1);

    await page.goto(`/trips/${tripId}/incidents/${incidentId}/route`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /route this claim/i })).toBeVisible({ timeout: 30_000 });

    await page
      .getByText('Which option best matches what happened?', { exact: true })
      .locator('..')
      .locator('select')
      .selectOption('airline_clear');
    await page
      .getByText('Recipient type', { exact: true })
      .locator('..')
      .locator('select')
      .selectOption('travel_insurer');
    const recipient = `E2E Golden ${stamp}`;
    await page.getByPlaceholder(/allianz travel insurance/i).fill(recipient);
    await page.getByRole('button', { name: /save routing details/i }).click();

    await expect(page.getByRole('heading', { name: /claim packet prepared/i })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/engine alignment/i)).toBeVisible({ timeout: 15_000 });

    const routingRows = await supabaseRestSelect<
      Array<{ routing_id: string; structural_alignment_category: string; matched_benefit_type: string | null }>
    >(
      request,
      accessToken,
      'claim_routing_decisions',
      `incident_id=eq.${incidentId}&select=routing_id,structural_alignment_category,matched_benefit_type&order=created_at.desc&limit=3`,
    );
    expect(routingRows.length).toBeGreaterThan(0);
    expect(routingRows[0]?.structural_alignment_category).toBe('ALIGNED');
    expect(routingRows[0]?.matched_benefit_type).toBe('trip_cancellation');

    const incidentRows = await supabaseRestSelect<Array<{ canonical_status: string }>>(
      request,
      accessToken,
      'incidents',
      `id=eq.${incidentId}&select=canonical_status&limit=1`,
    );
    expect(incidentRows[0]?.canonical_status).toBe('SUBMITTED');

    const packetRows = await supabaseRestSelect<Array<{ packet_id: string }>>(
      request,
      accessToken,
      'claim_packets',
      `incident_id=eq.${incidentId}&select=packet_id&limit=5`,
    );
    expect(packetRows.length).toBeGreaterThan(0);
  });
});
