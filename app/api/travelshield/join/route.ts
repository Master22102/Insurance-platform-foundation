import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { bridgeTravelShieldToTrip } from '@/lib/travelshield/bridge-group-trip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function mergeReferredBy(admin: NonNullable<ReturnType<typeof createServiceRoleClient>>, joinerId: string, referrerId: string) {
  if (joinerId === referrerId) return;
  const { data: prof } = await admin.from('user_profiles').select('preferences').eq('user_id', joinerId).maybeSingle();
  const prefs = (prof?.preferences && typeof prof.preferences === 'object' ? prof.preferences : {}) as Record<string, unknown>;
  if (prefs.referred_by) return;
  await admin
    .from('user_profiles')
    .update({
      preferences: { ...prefs, referred_by: referrerId, referred_via: 'travelshield_join' },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', joinerId);
}

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);

  let body: { token?: string; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ redirect: `/signup?join_token=${encodeURIComponent(token)}` });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data: row, error: tErr } = await admin
    .from('travelshield_join_tokens')
    .select('token_id, group_id, expires_at, is_active, uses_count, max_uses, created_by')
    .eq('token', token)
    .maybeSingle();

  if (tErr || !row) {
    return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
  }

  const expiresAt = new Date(row.expires_at as string);
  if (!row.is_active || expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Invite expired or inactive' }, { status: 410 });
  }

  if ((row.uses_count as number) >= (row.max_uses as number)) {
    return NextResponse.json({ error: 'Invite has reached its use limit' }, { status: 410 });
  }

  const { data: group, error: gErr } = await admin
    .from('travelshield_groups')
    .select('group_id, group_status, max_members, trip_id, dissolved_at')
    .eq('group_id', row.group_id)
    .maybeSingle();

  if (gErr || !group || group.dissolved_at || group.group_status === 'dissolved') {
    return NextResponse.json({ error: 'Group is no longer available' }, { status: 410 });
  }

  const { data: existing } = await admin
    .from('travelshield_members')
    .select('member_id, status')
    .eq('group_id', row.group_id)
    .eq('account_id', user.id)
    .maybeSingle();

  if (existing?.status === 'active') {
    return NextResponse.json({ error: 'Already in this group' }, { status: 409 });
  }

  const { count: activeCount } = await admin
    .from('travelshield_members')
    .select('member_id', { count: 'exact', head: true })
    .eq('group_id', row.group_id)
    .eq('status', 'active');

  const memberCount = activeCount ?? 0;
  const maxMembers = (group.max_members as number) ?? 8;
  if (memberCount >= maxMembers) {
    return NextResponse.json({ error: 'Group is full' }, { status: 403 });
  }

  let displayName =
    typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim().slice(0, 80)
      : '';
  if (!displayName) {
    const { data: prof } = await admin.from('user_profiles').select('display_name').eq('user_id', user.id).maybeSingle();
    displayName = (prof?.display_name as string | null)?.trim() || 'Travel partner';
  }

  const referrerId = row.created_by as string;

  if (existing && existing.status !== 'active') {
    const { error: upErr } = await admin
      .from('travelshield_members')
      .update({
        display_name: displayName,
        status: 'active',
        left_at: null,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', existing.member_id as string);
    if (upErr) {
      console.warn('[travelshield/join] reactivate', upErr.message);
      return NextResponse.json({ error: 'Could not join group' }, { status: 500 });
    }
  } else {
    const { error: insErr } = await admin.from('travelshield_members').insert({
      group_id: row.group_id,
      account_id: user.id,
      display_name: displayName,
      status: 'active',
      trust_level: 'custom',
      check_in_interval_hours: 2,
    });
    if (insErr) {
      console.warn('[travelshield/join] insert', insErr.message);
      return NextResponse.json({ error: 'Could not join group' }, { status: 500 });
    }
  }

  await admin
    .from('travelshield_join_tokens')
    .update({ uses_count: (row.uses_count as number) + 1 })
    .eq('token_id', row.token_id as string);

  await mergeReferredBy(admin, user.id, referrerId);

  const tripId = group.trip_id as string | null;
  if (tripId) {
    const bridge = await bridgeTravelShieldToTrip(admin, {
      groupId: row.group_id as string,
      tripId,
      actorId: user.id,
    });
    if (!bridge.ok) {
      console.warn('[travelshield/join] bridge', bridge.reason);
    }
  }

  const { data: members } = await admin
    .from('travelshield_members')
    .select('member_id, account_id, display_name, joined_at, status')
    .eq('group_id', row.group_id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  return NextResponse.json({
    group_id: row.group_id,
    group_status: group.group_status,
    trip_id: group.trip_id,
    members: members ?? [],
  });
}
