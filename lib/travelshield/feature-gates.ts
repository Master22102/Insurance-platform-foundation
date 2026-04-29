import type { SupabaseClient } from '@supabase/supabase-js';

export const FOCL_GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';

export async function isFeatureEnabledForRegion(
  admin: SupabaseClient,
  featureId: string,
  regionId: string = FOCL_GLOBAL_REGION,
): Promise<boolean> {
  const { data, error } = await admin
    .from('feature_activation_state')
    .select('enabled')
    .eq('feature_id', featureId)
    .eq('region_id', regionId)
    .maybeSingle();
  if (error || !data) return false;
  return Boolean((data as { enabled?: boolean }).enabled);
}

export async function isTravelShieldLocationEnabled(admin: SupabaseClient): Promise<boolean> {
  return isFeatureEnabledForRegion(admin, 'F-6.6.13-location');
}

export async function isTravelShieldCheckinEnabled(admin: SupabaseClient): Promise<boolean> {
  return isFeatureEnabledForRegion(admin, 'F-6.6.13-checkin');
}
