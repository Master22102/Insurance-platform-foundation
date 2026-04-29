import type { SupabaseClient } from '@supabase/supabase-js';

export type BridgeResult = { ok: boolean; bridged_count?: number; reason?: string };

/**
 * Syncs TravelShield members into `group_participants` + `travelshield_trip_bridge`.
 * Uses DB RPC (service_role or authenticated JWT).
 */
export async function bridgeTravelShieldToTrip(
  admin: SupabaseClient,
  params: { groupId: string; tripId: string; actorId: string },
): Promise<BridgeResult> {
  const { data, error } = await admin.rpc('bridge_travelshield_to_trip', {
    p_travelshield_group_id: params.groupId,
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
  });

  if (error) {
    console.warn('[travelshield/bridge]', error.message);
    return { ok: false, reason: error.message };
  }

  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    return { ok: false, reason: String(row?.reason ?? 'BRIDGE_FAILED') };
  }

  return { ok: true, bridged_count: Number(row.bridged_count) || 0 };
}
