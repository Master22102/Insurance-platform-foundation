import type { SupabaseClient } from '@supabase/supabase-js';

export type AnchorPath = 'first_trip' | 'returning' | 'imported' | 'browsing' | 'anchor_pending' | null;
export type LocationCertainty = 'confirmed' | 'likely' | 'approximate' | 'unknown';

export interface RightNowState {
  anchor: {
    path: AnchorPath;
    first_anchored_at: string | null;
  };
  signal_profile: {
    confirmed: boolean;
    version_id: string | null;
    proposed_at: string | null;
  };
  active_trip: {
    trip_id: string | null;
    trip_name: string | null;
    destination_summary: string | null;
    departure_date: string | null;
    return_date: string | null;
    maturity_state: string | null;
  } | null;
  presence: {
    certainty: LocationCertainty;
    source: string | null;
    updated_at: string | null;
    display_label: string;
  };
  recommended_next: {
    key: string;
    label: string;
    href: string;
  };
}

export function presenceLabel(certainty: LocationCertainty): string {
  switch (certainty) {
    case 'confirmed': return 'Confirmed location';
    case 'likely': return 'Likely location';
    case 'approximate': return 'Approximate (IP inferred)';
    default: return 'Location unknown';
  }
}

function deriveRecommendedNext(state: {
  anchor: RightNowState['anchor'];
  active_trip: RightNowState['active_trip'];
  signal_profile: RightNowState['signal_profile'];
}): { key: string; label: string; href: string } {
  if (!state.anchor.path) {
    return { key: 'anchor', label: 'Plan your first trip', href: '/trips/new' };
  }
  if (!state.signal_profile.confirmed) {
    return { key: 'signal', label: 'Confirm your travel preferences', href: '/account' };
  }
  if (!state.active_trip) {
    return { key: 'trip', label: 'Plan your next trip', href: '/trips/new' };
  }
  return { key: 'deep_scan', label: `Run a Deep Scan for ${state.active_trip.trip_name}`, href: `/deep-scan/${state.active_trip.trip_id}` };
}

export async function loadRightNowState(supabase: SupabaseClient, accountId: string): Promise<RightNowState> {
  const [anchorRes, signalRes, tripRes, pingRes] = await Promise.all([
    supabase.from('account_anchor_state').select('anchor_path, first_anchored_at').eq('account_id', accountId).maybeSingle(),
    supabase.from('user_signal_profile_versions').select('version_id, proposed_at, confirmed_at').eq('account_id', accountId).order('proposed_at', { ascending: false }).limit(1),
    supabase.from('trips').select('trip_id, trip_name, destination_summary, departure_date, return_date, maturity_state, created_at').eq('account_id', accountId).is('archived_at', null).order('created_at', { ascending: false }).limit(1),
    supabase.from('travelshield_location_pings').select('location_source, location_certainty, created_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(1),
  ]);

  const anchorRow: any = anchorRes.data;
  const signalRow: any = signalRes.data?.[0];
  const tripRow: any = tripRes.data?.[0];
  const pingRow: any = pingRes.data?.[0];

  const certainty: LocationCertainty = (pingRow?.location_certainty as LocationCertainty) || 'unknown';

  const anchor = {
    path: (anchorRow?.anchor_path as AnchorPath) ?? null,
    first_anchored_at: anchorRow?.first_anchored_at ?? null,
  };

  const signal_profile = {
    confirmed: !!signalRow?.confirmed_at,
    version_id: signalRow?.version_id ?? null,
    proposed_at: signalRow?.proposed_at ?? null,
  };

  const active_trip = tripRow ? {
    trip_id: tripRow.trip_id,
    trip_name: tripRow.trip_name,
    destination_summary: tripRow.destination_summary ?? null,
    departure_date: tripRow.departure_date ?? null,
    return_date: tripRow.return_date ?? null,
    maturity_state: tripRow.maturity_state ?? null,
  } : null;

  const recommended_next = deriveRecommendedNext({ anchor, active_trip, signal_profile });

  return {
    anchor,
    signal_profile,
    active_trip,
    presence: {
      certainty,
      source: pingRow?.location_source ?? null,
      updated_at: pingRow?.created_at ?? null,
      display_label: presenceLabel(certainty),
    },
    recommended_next,
  };
}
