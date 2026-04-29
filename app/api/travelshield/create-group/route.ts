import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { getJoinUrl } from '@/lib/travelshield/qr';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';
import { bridgeTravelShieldToTrip } from '@/lib/travelshield/bridge-group-trip';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_MAX = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = userRateLimitedJsonResponse(user.id, 'travelshield-create-group', RATE_MAX, RATE_WINDOW_MS);
  if (limited) return limited;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { trip_id?: string | null; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId =
    typeof body.trip_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.trip_id) ? body.trip_id : null;

  if (tripId) {
    const { data: trip, error: tripErr } = await admin
      .from('trips')
      .select('trip_id')
      .eq('trip_id', tripId)
      .eq('account_id', user.id)
      .maybeSingle();
    if (tripErr || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
  }

  let displayName =
    typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim().slice(0, 80)
      : '';

  if (!displayName) {
    const { data: prof } = await admin.from('user_profiles').select('display_name').eq('user_id', user.id).maybeSingle();
    displayName = (prof?.display_name as string | null)?.trim() || 'Travel partner';
  }

  const { data: group, error: gErr } = await admin
    .from('travelshield_groups')
    .insert({
      trip_id: tripId,
      created_by: user.id,
      group_status: 'forming',
      max_members: 8,
    })
    .select('group_id')
    .single();

  if (gErr || !group) {
    console.warn('[travelshield/create-group] group', gErr?.message);
    return NextResponse.json({ error: 'Could not create group' }, { status: 500 });
  }

  const groupId = group.group_id as string;

  const { error: mErr } = await admin.from('travelshield_members').insert({
    group_id: groupId,
    account_id: user.id,
    display_name: displayName,
    status: 'active',
    trust_level: 'custom',
    check_in_interval_hours: 2,
  });

  if (mErr) {
    console.warn('[travelshield/create-group] member', mErr.message);
    await admin.from('travelshield_groups').delete().eq('group_id', groupId);
    return NextResponse.json({ error: 'Could not add creator to group' }, { status: 500 });
  }

  if (tripId) {
    const bridge = await bridgeTravelShieldToTrip(admin, { groupId, tripId, actorId: user.id });
    if (bridge.ok) {
      await emitTravelShieldEvent(admin, {
        eventType: 'travelshield_group_bridged',
        featureId: 'F-6.6.13',
        metadata: { group_id: groupId, trip_id: tripId },
        actorId: user.id,
        idempotencyKey: `ts:bridge:${groupId}:${tripId}`,
      });
    } else {
      console.warn('[travelshield/create-group] bridge', bridge.reason);
    }
  }

  const { data: tokRow, error: tErr } = await admin
    .from('travelshield_join_tokens')
    .insert({
      group_id: groupId,
      created_by: user.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      max_uses: 8,
      uses_count: 0,
    })
    .select('token')
    .single();

  if (tErr || !tokRow?.token) {
    console.warn('[travelshield/create-group] token', tErr?.message);
    return NextResponse.json({ error: 'Could not create invite token' }, { status: 500 });
  }

  const token = tokRow.token as string;

  return NextResponse.json({
    group_id: groupId,
    token,
    qr_url: getJoinUrl(token),
  });
}
