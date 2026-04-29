import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { queueNotification } from '@/lib/notifications/send';

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

  let body: { account_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const targetAccount = typeof body.account_id === 'string' ? body.account_id.trim() : '';
  if (!isUuid(targetAccount)) {
    return NextResponse.json({ error: 'account_id required' }, { status: 400 });
  }

  const { data: group } = await admin.from('travelshield_groups').select('trip_id').eq('group_id', groupId).maybeSingle();
  const tripId = (group?.trip_id as string | null) ?? null;
  if (!tripId) {
    return NextResponse.json({ error: 'Group has no trip' }, { status: 400 });
  }

  const { data: org } = await admin
    .from('group_participants')
    .select('role')
    .eq('trip_id', tripId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if ((org?.role as string | undefined) !== 'organizer') {
    return NextResponse.json({ error: 'Organizer only' }, { status: 403 });
  }

  const { data: targetGp } = await admin
    .from('group_participants')
    .select('participant_id')
    .eq('trip_id', tripId)
    .eq('account_id', targetAccount)
    .eq('status', 'active')
    .maybeSingle();
  if (!targetGp) {
    return NextResponse.json({ error: 'Participant not on trip' }, { status: 404 });
  }

  await queueNotification(admin, {
    accountId: targetAccount,
    channel: 'in_app',
    category: 'trip_update',
    title: 'Coverage reminder',
    body: 'Your trip organizer asked you to review your travel coverage readiness.',
    data: { trip_id: tripId, group_id: groupId, url: `/trips/${tripId}?tab=Coverage` },
    idempotencyKey: `ts:cov:remind:${tripId}:${targetAccount}:${Math.floor(Date.now() / 86_400_000)}`,
  });

  return NextResponse.json({ ok: true });
}
