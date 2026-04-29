import type { SupabaseClient } from '@supabase/supabase-js';

export type Channel = 'push' | 'email' | 'sms' | 'in_app';

const LIMITS: Record<'push' | 'email' | 'sms', { windowMs: number; max: number }> = {
  push: { windowMs: 60 * 60 * 1000, max: 10 },
  email: { windowMs: 24 * 60 * 60 * 1000, max: 5 },
  sms: { windowMs: 24 * 60 * 60 * 1000, max: 3 },
};

/**
 * Counts notification_queue rows in the rolling window for rate limiting.
 * Includes queued/sent/delivered/suppressed/rate_limited (attempts to notify), excludes failed-only noise.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  accountId: string,
  channel: Channel,
): Promise<{ allowed: boolean; reason?: string }> {
  if (channel === 'in_app') return { allowed: true };
  const cfg = LIMITS[channel as 'push' | 'email' | 'sms'];
  if (!cfg) return { allowed: true };

  const since = new Date(Date.now() - cfg.windowMs).toISOString();
  const { count, error } = await admin
    .from('notification_queue')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('channel', channel)
    .gte('created_at', since)
    .in('delivery_status', ['queued', 'sent', 'delivered', 'suppressed', 'rate_limited']);

  if (error) {
    return { allowed: false, reason: 'rate_check_failed' };
  }
  const n = count ?? 0;
  if (n >= cfg.max) {
    return { allowed: false, reason: `rate_limited_${channel}_${cfg.max}_per_${cfg.windowMs}ms` };
  }
  return { allowed: true };
}
