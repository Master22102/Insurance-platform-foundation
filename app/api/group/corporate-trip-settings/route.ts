import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveOrganizer } from '@/lib/group/organizer-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type Body = { trip_id?: string; corporate_travel_policy_url?: string | null };

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = typeof body.trip_id === 'string' ? body.trip_id.trim() : '';
  const url = typeof body.corporate_travel_policy_url === 'string' ? body.corporate_travel_policy_url.trim() : '';

  if (!isUuid(tripId)) return NextResponse.json({ error: 'trip_id required' }, { status: 400 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  if (!(await isActiveOrganizer(admin, tripId, user.id))) {
    return NextResponse.json({ error: 'Organizer only' }, { status: 403 });
  }

  const { data: trip, error: tErr } = await admin.from('trips').select('lifecycle_flags').eq('trip_id', tripId).maybeSingle();
  if (tErr || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const flags = (trip.lifecycle_flags && typeof trip.lifecycle_flags === 'object' ? trip.lifecycle_flags : {}) as Record<string, unknown>;
  const nextFlags = { ...flags, corporate_travel_policy_url: url || null };

  const { error: uErr } = await admin.from('trips').update({ lifecycle_flags: nextFlags }).eq('trip_id', tripId);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
