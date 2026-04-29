import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isTravelShieldCheckinEnabled } from '@/lib/travelshield/feature-gates';
import { cancelCheckin, requestCheckin, respondCheckin } from '@/lib/travelshield/checkin-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

async function assertMember(admin: NonNullable<ReturnType<typeof createServiceRoleClient>>, groupId: string, userId: string) {
  const { data } = await admin
    .from('travelshield_members')
    .select('member_id')
    .eq('group_id', groupId)
    .eq('account_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest, { params }: { params: { group_id: string } }) {
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

  if (!(await isTravelShieldCheckinEnabled(admin))) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  if (!(await assertMember(admin, groupId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: incoming } = await admin
    .from('travelshield_checkins')
    .select('*')
    .eq('group_id', groupId)
    .eq('requested_of', user.id)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: outgoing } = await admin
    .from('travelshield_checkins')
    .select('*')
    .eq('group_id', groupId)
    .eq('requested_by', user.id)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({ incoming: incoming ?? [], outgoing: outgoing ?? [] });
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

  if (!(await isTravelShieldCheckinEnabled(admin))) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  if (!(await assertMember(admin, groupId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { target_account_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const target = typeof body.target_account_id === 'string' ? body.target_account_id.trim() : '';
  if (!isUuid(target)) {
    return NextResponse.json({ error: 'target_account_id required' }, { status: 400 });
  }

  const res = await requestCheckin(admin, { groupId, targetAccountId: target, requesterId: user.id });
  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ checkin_id: res.checkinId });
}

export async function PUT(request: NextRequest, { params }: { params: { group_id: string } }) {
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

  if (!(await isTravelShieldCheckinEnabled(admin))) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  let body: { checkin_id?: string; response?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const checkinId = typeof body.checkin_id === 'string' ? body.checkin_id.trim() : '';
  if (!isUuid(checkinId)) {
    return NextResponse.json({ error: 'checkin_id required' }, { status: 400 });
  }

  const { data: row } = await admin.from('travelshield_checkins').select('group_id').eq('checkin_id', checkinId).maybeSingle();
  if (!row || (row as { group_id: string }).group_id !== groupId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const response = body.response === 'needs_help' ? 'needs_help' : body.response === 'safe' ? 'safe' : null;
  if (!response) {
    return NextResponse.json({ error: 'response must be safe or needs_help' }, { status: 400 });
  }

  const res = await respondCheckin(admin, { checkinId, response, accountId: user.id });
  if ('error' in res) {
    const st = res.error === 'Forbidden' ? 403 : res.error === 'Not found' ? 404 : 400;
    return NextResponse.json({ error: res.error }, { status: st });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { group_id: string } }) {
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

  if (!(await isTravelShieldCheckinEnabled(admin))) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }

  const url = new URL(request.url);
  const checkinId = (url.searchParams.get('checkin_id') || '').trim();
  if (!isUuid(checkinId)) {
    return NextResponse.json({ error: 'checkin_id query required' }, { status: 400 });
  }

  const { data: row } = await admin.from('travelshield_checkins').select('group_id').eq('checkin_id', checkinId).maybeSingle();
  if (!row || (row as { group_id: string }).group_id !== groupId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const res = await cancelCheckin(admin, { checkinId, requesterId: user.id });
  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
