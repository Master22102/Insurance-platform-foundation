import type { SupabaseClient } from '@supabase/supabase-js';

export async function remainingCreatorSearchesToday(
  supabase: SupabaseClient,
  accountId: string,
  limitPerDay = 100,
): Promise<{ remaining: number; used: number }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('creator_search_log')
    .select('log_id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('created_at', start.toISOString());
  const used = count ?? 0;
  return { used, remaining: Math.max(0, limitPerDay - used) };
}

