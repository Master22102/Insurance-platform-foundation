import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveOrganizer } from '@/lib/group/organizer-guard';
import { queueNotification } from '@/lib/notifications/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { trip_id?: string; account_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = typeof body.trip_id === 'string' ? body.trip_id.trim() : '';
  const target = typeof body.account_id === 'string' ? body.account_id.trim() : '';
  if (!isUuid(tripId) || !isUuid(target)) {
    return NextResponse.json({ error: 'trip_id and account_id required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  if (!(await isActiveOrganizer(admin, tripId, user.id))) {
    return NextResponse.json({ error: 'Organizer only' }, { status: 403 });
  }

  const { data: gp } = await admin
    .from('group_participants')
    .select('participant_id')
    .eq('trip_id', tripId)
    .eq('account_id', target)
    .eq('status', 'active')
    .maybeSingle();
  if (!gp) return NextResponse.json({ error: 'Participant not on trip' }, { status: 404 });

  await queueNotification(admin, {
    accountId: target,
    channel: 'in_app',
    category: 'trip_update',
    title: 'Upload travel coverage',
    body: 'Your organizer reminded you to attach or confirm travel coverage for this trip.',
    data: { trip_id: tripId, url: `/trips/${tripId}` },
    idempotencyKey: `group:cov:remind:${tripId}:${target}:${Math.floor(Date.now() / 86_400_000)}`,
  });

  return NextResponse.json({ ok: true });
}
