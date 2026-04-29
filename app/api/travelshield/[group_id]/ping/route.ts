import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isTravelShieldLocationEnabled } from '@/lib/travelshield/feature-gates';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(request: NextRequest, { params }: { params: { group_id: string } }) {
  const groupId = params.group_id;
  if (!isUuid(groupId)) {
    return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  }

  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  if (!(await isTravelShieldLocationEnabled(admin))) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  const { data: mem } = await admin
    .from('travelshield_members')
    .select('member_id')
    .eq('group_id', groupId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.pause_for_battery_saver === true) {
    await emitTravelShieldEvent(admin, {
      eventType: 'travelshield_location_paused',
      featureId: 'F-6.6.13-location',
      metadata: {
        group_id: groupId,
        account_id: user.id,
        reason: 'battery_saver',
      },
      actorId: user.id,
      idempotencyKey: `ts:loc:pause:${groupId}:${user.id}:${Math.floor(Date.now() / 60_000)}`,
    });
    return NextResponse.json({ ok: true, paused: true });
  }

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'latitude and longitude required' }, { status: 400 });
  }

  const row = {
    group_id: groupId,
    account_id: user.id,
    latitude: lat,
    longitude: lng,
    accuracy_meters: body.accuracy_meters != null ? Number(body.accuracy_meters) : null,
    battery_level: body.battery_level != null ? Math.round(Number(body.battery_level)) : null,
    connection_type: typeof body.connection_type === 'string' ? body.connection_type.slice(0, 32) : null,
    is_moving: typeof body.is_moving === 'boolean' ? body.is_moving : null,
    speed_mps: body.speed_mps != null ? Number(body.speed_mps) : null,
    heading: body.heading != null ? Number(body.heading) : null,
    altitude: body.altitude != null ? Number(body.altitude) : null,
  };

  const { error } = await admin.from('travelshield_location_pings').insert(row);
  if (error) {
    console.warn('[travelshield/ping]', error.message);
    return NextResponse.json({ error: 'Could not save ping' }, { status: 500 });
  }

  await emitTravelShieldEvent(admin, {
    eventType: 'travelshield_location_shared',
    featureId: 'F-6.6.13-location',
    metadata: { group_id: groupId, account_id: user.id },
    actorId: user.id,
    idempotencyKey: `ts:loc:shared:${groupId}:${user.id}:${Math.floor(Date.now() / 300_000)}`,
  });

  return NextResponse.json({ ok: true });
}
