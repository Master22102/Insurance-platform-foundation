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

  let body: { trip_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = typeof body.trip_id === 'string' ? body.trip_id.trim() : '';
  if (!isUuid(tripId)) return NextResponse.json({ error: 'trip_id required' }, { status: 400 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  if (!(await isActiveOrganizer(admin, tripId, user.id))) {
    return NextResponse.json({ error: 'Organizer only' }, { status: 403 });
  }

  const { data: reqs } = await admin
    .from('relationship_verification_requests')
    .select('request_id, guardian_id, trip_type, status')
    .eq('trip_id', tripId)
    .eq('status', 'pending')
    .eq('trip_type', 'school');

  const guardians = Array.from(new Set((reqs ?? []).map((r) => r.guardian_id as string | null).filter(Boolean))) as string[];

  let n = 0;
  const day = Math.floor(Date.now() / 86_400_000);
  for (const gid of guardians) {
    await queueNotification(admin, {
      accountId: gid,
      channel: 'in_app',
      category: 'trip_update',
      title: 'School trip approval reminder',
      body: 'A student trip is waiting for your guardian approval.',
      data: { trip_id: tripId, url: '/account/guardian-invites' },
      idempotencyKey: `school:guardian:remind:${tripId}:${gid}:${day}`,
    });
    n += 1;
  }

  return NextResponse.json({ ok: true, notified_guardians: n });
}
