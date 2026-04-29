import type { SupabaseClient } from '@supabase/supabase-js';

export async function emitNotificationEvent(
  admin: SupabaseClient,
  eventType:
    | 'notification_queued'
    | 'notification_sent'
    | 'notification_failed'
    | 'notification_rate_limited'
    | 'push_subscription_created'
    | 'push_subscription_expired',
  metadata: Record<string, unknown>,
  idempotencyKey?: string | null,
): Promise<void> {
  try {
    await admin.rpc('emit_event', {
      p_event_type: eventType,
      p_feature_id: 'F-6.5.15',
      p_scope_type: 'system',
      p_scope_id: null,
      p_actor_id: (metadata.account_id as string) || null,
      p_actor_type: 'system',
      p_reason_code: null,
      p_previous_state: {},
      p_resulting_state: {},
      p_metadata: metadata,
      p_idempotency_key: idempotencyKey || null,
    });
  } catch {
    /* non-fatal — audit best-effort */
  }
}
