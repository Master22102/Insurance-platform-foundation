import type { SupabaseClient } from '@supabase/supabase-js';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

const DONE = new Set(['verified', 'uploaded', 'waived', 'waived_by_itinerary_change']);

/**
 * Recomputes group_coverage_summary rows for all active participants on a trip.
 * Caller must enforce organizer authorization.
 */
export async function refreshCoverageSummaryCore(
  admin: SupabaseClient,
  tripId: string,
  actorId: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const { data: participants, error: pErr } = await admin
    .from('group_participants')
    .select('account_id')
    .eq('trip_id', tripId)
    .eq('status', 'active');

  if (pErr) return { ok: false, error: pErr.message };

  const now = new Date().toISOString();

  for (const row of participants ?? []) {
    const aid = row.account_id as string;

    const { count: polCount } = await admin
      .from('policies')
      .select('policy_id', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('account_id', aid);

    const { data: prp } = await admin
      .from('participant_risk_profiles')
      .select('coverage_gap_flags')
      .eq('trip_id', tripId)
      .eq('account_id', aid)
      .maybeSingle();

    const flags = (prp?.coverage_gap_flags as string[] | null) || [];
    const gapCount = Array.isArray(flags) ? flags.length : 0;

    const { data: items } = await admin
      .from('participant_checklist_items')
      .select('status,itinerary_version')
      .eq('trip_id', tripId)
      .eq('participant_account_id', aid);

    let pct = 0;
    if (items && items.length > 0) {
      const vMax = Math.max(...items.map((i) => Number(i.itinerary_version) || 1), 1);
      const cur = items.filter((i) => Number(i.itinerary_version) === vMax);
      const done = cur.filter((i) => DONE.has(String(i.status))).length;
      pct = cur.length ? Math.min(100, Math.round((100 * done) / cur.length)) : 0;
    }

    const payload = {
      trip_id: tripId,
      account_id: aid,
      has_any_policy: (polCount ?? 0) > 0,
      coverage_gap_count: gapCount,
      checklist_completion_pct: pct,
      last_evaluated_at: now,
      updated_at: now,
    };

    const { error: upErr } = await admin.from('group_coverage_summary').upsert(payload, { onConflict: 'trip_id,account_id' });

    if (upErr) return { ok: false, error: upErr.message };

    await emitTravelShieldEvent(admin, {
      eventType: 'group_coverage_summary_updated',
      featureId: 'F-6.6.13',
      scopeType: 'trip',
      scopeId: tripId,
      actorId,
      metadata: { trip_id: tripId, account_id: aid },
      idempotencyKey: `gcs_refresh:${tripId}:${aid}:${now}`,
    });
  }

  return { ok: true, updated: (participants ?? []).length };
}
