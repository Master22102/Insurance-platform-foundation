import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { runAxes, DEEP_SCAN_BOUNDARY_STATEMENT } from '@/lib/deep-scan/orchestrator';

function isInternational(destination?: string | null): boolean {
  if (!destination) return false;
  const lower = destination.toLowerCase();
  const domesticMarkers = ['united states', ' usa', ', us', 'u.s.', 'hawaii', 'alaska', 'puerto rico'];
  return !domesticMarkers.some((m) => lower.includes(m));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const trip_id: string | undefined = body?.trip_id;
    const user_confirmed: boolean = !!body?.user_confirmed;
    if (!trip_id) return NextResponse.json({ error: 'trip_id_required' }, { status: 400 });

    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('trip_id, account_id, destination_summary, departure_date, return_date, travel_mode_primary, adults_count, children_count, infant_count, itinerary_version, paid_unlock, deep_scan_credits_remaining')
      .eq('trip_id', trip_id)
      .maybeSingle();
    if (tripErr || !trip) return NextResponse.json({ error: 'trip_not_found' }, { status: 404 });
    if (trip.account_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const snapshot = {
      destination: trip.destination_summary,
      departure_date: trip.departure_date,
      return_date: trip.return_date,
      travel_mode: trip.travel_mode_primary,
      itinerary_version: trip.itinerary_version,
      composition: {
        adults: trip.adults_count,
        children: trip.children_count,
        infants: trip.infant_count,
      },
    };

    const { data: rpcData, error: rpcErr } = await supabase.rpc('initiate_deep_scan', {
      p_user_id: user.id,
      p_trip_id: trip_id,
      p_itinerary_snapshot: snapshot,
      p_user_confirmed: user_confirmed,
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    if (!rpcData?.success) {
      return NextResponse.json({ error: rpcData?.error || 'initiate_failed' }, { status: 400 });
    }

    const results = runAxes({
      trip,
      is_international: isInternational(trip.destination_summary),
      authority_disruption_detected: false,
    });

    const axisPayload = {
      boundary_statement: DEEP_SCAN_BOUNDARY_STATEMENT,
      scanned_at: new Date().toISOString(),
      itinerary_snapshot: snapshot,
      axes: results,
    };

    await supabase.from('scan_connector_axis_results').insert({
      trip_id,
      account_id: user.id,
      axis_results: axisPayload,
    });

    return NextResponse.json({
      success: true,
      scan_id: rpcData.scan_id,
      credits_remaining: rpcData.credits_remaining,
      axes: results,
      boundary_statement: DEEP_SCAN_BOUNDARY_STATEMENT,
    });
  } catch (err) {
    console.error('[deep-scan:initiate]', err);
    return NextResponse.json({ error: 'initiate_failed' }, { status: 500 });
  }
}
