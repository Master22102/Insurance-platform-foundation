/**
 * Client-side helpers for the coverage graph + claim routing engine RPCs.
 * DB contracts: compute_coverage_graph(trip, actor), route_claim(incident, actor, ...).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ComputeCoverageGraphRow = {
  ok?: boolean;
  status?: string;
  reason?: string;
  snapshot_id?: string;
  total_nodes?: number;
  overlap_count?: number;
  conflict_count?: number;
  /** F-6.5.2 — rows from generate_coverage_intelligence (0 if skipped/failed). */
  intelligence_gaps?: number;
  intelligence_summaries?: number;
  /** F-6.5.2 Phase 2 — itinerary conflict RPCs (0 if skipped/disabled/failed). */
  activity_conflicts?: number;
  geographic_conflicts?: number;
};

export type RouteClaimRow = {
  success?: boolean;
  error?: string;
  hint?: string;
  routing_id?: string;
  idempotent?: boolean;
  alignment_category?: string;
  matched_benefit_type?: string;
  alignment_confidence?: string;
  guidance_steps?: unknown;
  trip_maturity_advanced_to?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Builds or returns a cached COMPLETE coverage graph snapshot for the trip.
 */
export async function computeCoverageGraphForTrip(
  client: SupabaseClient,
  tripId: string,
  actorId: string,
): Promise<{ ok: true; data: ComputeCoverageGraphRow } | { ok: false; message: string }> {
  const { data, error } = await client.rpc('compute_coverage_graph', {
    p_trip_id: tripId,
    p_actor_id: actorId,
  });

  if (error) {
    return { ok: false, message: error.message || 'Coverage graph request failed' };
  }

  const row = asRecord(data) as ComputeCoverageGraphRow | null;
  if (!row?.ok) {
    const reason = row?.reason ? String(row.reason) : 'Coverage graph could not be computed';
    return { ok: false, message: reason };
  }

  return { ok: true, data: row };
}

/**
 * Builds coverage graph then runs deterministic intelligence (summaries + gaps). Intelligence
 * failure is non-fatal — the graph remains valid.
 */
export async function computeCoverageGraphWithIntelligence(
  client: SupabaseClient,
  tripId: string,
  actorId: string,
): Promise<{ ok: true; data: ComputeCoverageGraphRow } | { ok: false; message: string }> {
  const graphResult = await computeCoverageGraphForTrip(client, tripId, actorId);
  if (!graphResult.ok) return graphResult;

  const snapId = graphResult.data.snapshot_id;
  if (!snapId) {
    return {
      ok: true,
      data: {
        ...graphResult.data,
        intelligence_gaps: 0,
        intelligence_summaries: 0,
      },
    };
  }

  const { data: intel, error: intelError } = await client.rpc('generate_coverage_intelligence', {
    p_snapshot_id: snapId,
    p_trip_id: tripId,
    p_actor_id: actorId,
  });

  if (intelError) {
    console.warn('[generate_coverage_intelligence]', intelError.message);
    return {
      ok: true,
      data: {
        ...graphResult.data,
        intelligence_gaps: 0,
        intelligence_summaries: 0,
      },
    };
  }

  const intelRow = asRecord(intel);
  const baseGaps = typeof intelRow?.gaps_detected === 'number' ? intelRow.gaps_detected : 0;
  const baseSummaries =
    typeof intelRow?.summaries_generated === 'number' ? intelRow.summaries_generated : 0;

  let activityConflicts = 0;
  let geographicConflicts = 0;

  try {
    const { data: actData, error: actErr } = await client.rpc('detect_activity_conflicts', {
      p_snapshot_id: snapId,
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    if (actErr) {
      console.warn('[detect_activity_conflicts]', actErr.message);
    } else {
      const ar = asRecord(actData);
      if (typeof ar?.activity_conflicts === 'number') activityConflicts = ar.activity_conflicts;
    }
  } catch (e) {
    console.warn('[detect_activity_conflicts]', e);
  }

  try {
    const { data: geoData, error: geoErr } = await client.rpc('detect_geographic_conflicts', {
      p_snapshot_id: snapId,
      p_trip_id: tripId,
      p_actor_id: actorId,
    });
    if (geoErr) {
      console.warn('[detect_geographic_conflicts]', geoErr.message);
    } else {
      const gr = asRecord(geoData);
      if (typeof gr?.geographic_conflicts === 'number') geographicConflicts = gr.geographic_conflicts;
    }
  } catch (e) {
    console.warn('[detect_geographic_conflicts]', e);
  }

  return {
    ok: true,
    data: {
      ...graphResult.data,
      intelligence_gaps: baseGaps + activityConflicts + geographicConflicts,
      intelligence_summaries: baseSummaries,
      activity_conflicts: activityConflicts,
      geographic_conflicts: geographicConflicts,
    },
  };
}

/**
 * Runs the routing engine for an incident (requires COMPLETE coverage graph for the trip).
 */
export async function routeClaimForIncident(
  client: SupabaseClient,
  incidentId: string,
  actorId: string,
  idempotencyKey: string,
): Promise<{ ok: true; data: RouteClaimRow } | { ok: false; message: string }> {
  const { data, error } = await client.rpc('route_claim', {
    p_incident_id: incidentId,
    p_actor_id: actorId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { ok: false, message: error.message || 'Claim routing request failed' };
  }

  const row = asRecord(data) as RouteClaimRow | null;
  if (!row?.success) {
    const err = row?.error ? String(row.error) : 'Claim routing did not complete';
    const hint = row?.hint ? String(row.hint) : '';
    return { ok: false, message: hint ? `${err} (${hint})` : err };
  }

  return { ok: true, data: row };
}

export function normalizeGuidanceSteps(raw: unknown): Array<{ step?: number; action?: string; note?: string }> {
  if (!Array.isArray(raw)) return [];
  const rows: Record<string, unknown>[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (o) rows.push(o);
  }
  return rows.map((o) => ({
    step: typeof o.step === 'number' ? o.step : undefined,
    action: typeof o.action === 'string' ? o.action : undefined,
    note: typeof o.note === 'string' ? o.note : undefined,
  }));
}
