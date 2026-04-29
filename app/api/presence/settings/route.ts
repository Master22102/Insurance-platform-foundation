import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, getRouteUser } from '@/lib/travelshield/supabase-route';
import { userOwnsTrip } from '@/lib/presence/trip-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

const DEFAULT_TOGGLES = {
  ski_resorts: true,
  dive_centers: true,
  climbing_areas: true,
  motorbike_rental: true,
  water_sports: true,
  high_altitude: true,
};

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createSupabaseRouteClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const tripId = request.nextUrl.searchParams.get('trip_id') || '';
  if (!isUuid(tripId)) {
    return NextResponse.json({ error: 'Invalid trip_id' }, { status: 400 });
  }
  const ok = await userOwnsTrip(supabase, tripId, user.id);
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('trip_presence_settings')
    .select('*')
    .eq('trip_id', tripId)
    .eq('account_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      settings: {
        trip_id: tripId,
        account_id: user.id,
        enabled: true,
        activity_zones_enabled: true,
        border_crossings_enabled: true,
        missed_connection_enabled: true,
        risk_alerts_enabled: true,
        daily_summary_enabled: true,
        daily_summary_time: '20:00:00',
        snooze_default_hours: 2,
        activity_zone_toggles: DEFAULT_TOGGLES,
      },
      persisted: false,
    });
  }

  return NextResponse.json({ settings: data, persisted: true });
}

export async function PUT(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = createSupabaseRouteClient(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = String(body.trip_id || '');
  if (!isUuid(tripId)) {
    return NextResponse.json({ error: 'Invalid trip_id' }, { status: 400 });
  }
  const ok = await userOwnsTrip(supabase, tripId, user.id);
  if (!ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {
    trip_id: tripId,
    account_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const boolKeys = [
    'enabled',
    'activity_zones_enabled',
    'border_crossings_enabled',
    'missed_connection_enabled',
    'risk_alerts_enabled',
    'daily_summary_enabled',
  ] as const;
  for (const k of boolKeys) {
    if (typeof body[k] === 'boolean') patch[k] = body[k];
  }
  if (typeof body.daily_summary_time === 'string') patch.daily_summary_time = body.daily_summary_time;
  if (typeof body.snooze_default_hours === 'number') patch.snooze_default_hours = body.snooze_default_hours;
  if (body.activity_zone_toggles && typeof body.activity_zone_toggles === 'object') {
    patch.activity_zone_toggles = body.activity_zone_toggles;
  }

  const { data, error } = await supabase
    .from('trip_presence_settings')
    .upsert(patch, { onConflict: 'trip_id,account_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
