import type { SupabaseClient } from '@supabase/supabase-js';

/** Best-effort governance ledger emission (requires event_type registered). */
export async function emitTravelShieldEvent(
  admin: SupabaseClient,
  params: {
    eventType: string;
    featureId: string;
    metadata: Record<string, unknown>;
    scopeType?: string | null;
    scopeId?: string | null;
    actorId?: string | null;
    idempotencyKey?: string | null;
  },
): Promise<void> {
  try {
    await admin.rpc('emit_event', {
      p_event_type: params.eventType,
      p_feature_id: params.featureId,
      p_scope_type: params.scopeType ?? null,
      p_scope_id: params.scopeId ?? null,
      p_actor_id: params.actorId ?? null,
      p_actor_type: 'system',
      p_reason_code: null,
      p_previous_state: {},
      p_resulting_state: {},
      p_metadata: params.metadata,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
  } catch {
    /* non-fatal */
  }
}
