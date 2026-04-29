import type { SupabaseClient } from '@supabase/supabase-js';

export async function userOwnsTrip(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('trips')
    .select('trip_id')
    .eq('trip_id', tripId)
    .or(`created_by.eq.${userId},account_id.eq.${userId}`)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.trip_id);
}
