import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, getRouteUser } from '@/lib/travelshield/supabase-route';
import { shouldSuppress, type PresenceAlertRow } from '@/lib/presence/fatigue-manager';
import { userOwnsTrip } from '@/lib/presence/trip-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

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

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('trip_presence_alerts')
    .select(
      'alert_id, trip_id, alert_type, alert_subtype, severity, country_code, was_displayed, was_suppressed, suppression_reason, dismissed_at, snoozed_until, metadata, created_at',
    )
    .eq('trip_id', tripId)
    .eq('account_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as PresenceAlertRow[];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const suppressedToday = rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return r.was_suppressed && t >= start.getTime() && t <= end.getTime();
  }).length;

  return NextResponse.json({ alerts: rows, suppressed_count_today: suppressedToday });
}

export async function POST(request: NextRequest) {
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

  const action = String(body.action || 'emit');

  if (action === 'snooze') {
    const alert_type = String(body.alert_type || '');
    const alert_subtype = body.alert_subtype != null ? String(body.alert_subtype) : null;
    const snoozed_until = String(body.snoozed_until || '');
    if (!alert_type || !snoozed_until) {
      return NextResponse.json({ error: 'alert_type and snoozed_until required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('trip_presence_alerts')
      .insert({
        trip_id: tripId,
        account_id: user.id,
        alert_type,
        alert_subtype,
        severity: 'info',
        was_displayed: false,
        was_suppressed: true,
        suppression_reason: 'snoozed',
        snoozed_until,
        metadata: (body.metadata as object) || {},
      })
      .select('alert_id')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, alert_id: data?.alert_id });
  }

  if (action !== 'emit') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const alert_type = String(body.alert_type || '');
  const alert_subtype = body.alert_subtype != null ? String(body.alert_subtype) : null;
  const severity = String(body.severity || 'info');
  const country_code = body.country_code != null ? String(body.country_code).slice(0, 2).toUpperCase() : null;
  const metadata = (body.metadata as Record<string, unknown>) || {};

  if (!alert_type) {
    return NextResponse.json({ error: 'alert_type required' }, { status: 400 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRaw, error: recentErr } = await supabase
    .from('trip_presence_alerts')
    .select(
      'alert_type, alert_subtype, was_displayed, was_suppressed, created_at, snoozed_until, dismissed_at',
    )
    .eq('trip_id', tripId)
    .eq('account_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  if (recentErr) {
    return NextResponse.json({ error: recentErr.message }, { status: 500 });
  }

  const recent = (recentRaw || []) as PresenceAlertRow[];
  const suppressed = shouldSuppress(recent, alert_type, alert_subtype, Date.now());
  const suppressionBypass = alert_type === 'cultural_restriction' && severity === 'critical';

  if (suppressed && !suppressionBypass) {
    const { data, error } = await supabase
      .from('trip_presence_alerts')
      .insert({
        trip_id: tripId,
        account_id: user.id,
        alert_type,
        alert_subtype,
        severity,
        country_code,
        was_displayed: false,
        was_suppressed: true,
        suppression_reason: 'duplicate_within_4hr',
        metadata,
      })
      .select('alert_id')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ displayed: false, suppressed: true, alert_id: data?.alert_id });
  }

  const { data, error } = await supabase
    .from('trip_presence_alerts')
    .insert({
      trip_id: tripId,
      account_id: user.id,
      alert_type,
      alert_subtype,
      severity,
      country_code,
      was_displayed: true,
      was_suppressed: false,
      metadata,
    })
    .select('alert_id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ displayed: true, suppressed: false, alert_id: data?.alert_id });
}
