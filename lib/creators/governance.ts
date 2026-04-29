import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const FOCL_GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';
export const CREATOR_FEATURE_ID = 'F-6.6.11';

export function createCookieSupabase(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createServerClient(url, anon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
}

export async function isCreatorDiscoveryEnabled(supabase: ReturnType<typeof createCookieSupabase>): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from('feature_activation_state')
    .select('enabled')
    .eq('region_id', FOCL_GLOBAL_REGION)
    .eq('feature_id', CREATOR_FEATURE_ID)
    .maybeSingle();
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

/**
 * Unlimited creator search + full tag/activity visibility (vs free caps).
 * Uses account membership so trip-unlock state cannot widen/narrow browse limits
 * and parallel sessions stay consistent. "Add to trip" remains trip-unlocked-only.
 */
export async function hasPaidCreatorMembership(
  supabase: ReturnType<typeof createCookieSupabase>,
  userId: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from('user_profiles')
    .select('membership_tier')
    .eq('user_id', userId)
    .maybeSingle();
  const tier = (data as { membership_tier?: string } | null)?.membership_tier;
  return tier === 'CORPORATE' || tier === 'FOUNDER';
}

