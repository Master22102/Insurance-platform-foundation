import type { SupabaseClient } from '@supabase/supabase-js';

export async function isActiveOrganizer(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('group_participants')
    .select('role')
    .eq('trip_id', tripId)
    .eq('account_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return (data?.role as string | undefined) === 'organizer';
}

export async function isActiveGroupMember(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('group_participants')
    .select('participant_id')
    .eq('trip_id', tripId)
    .eq('account_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data?.participant_id);
}
