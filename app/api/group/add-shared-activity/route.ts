import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveGroupMember } from '@/lib/group/organizer-guard';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type Body = { trip_id?: string; source_candidate_id?: string };

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
  const sourceId = typeof body.source_candidate_id === 'string' ? body.source_candidate_id.trim() : '';
  if (!isUuid(tripId) || !isUuid(sourceId)) {
    return NextResponse.json({ error: 'trip_id and source_candidate_id required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const member = await isActiveGroupMember(admin, tripId, user.id);
  if (!member) return NextResponse.json({ error: 'Not a group participant' }, { status: 403 });

  const { data: src, error: sErr } = await admin
    .from('activity_candidates')
    .select('*')
    .eq('candidate_id', sourceId)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (sErr || !src) return NextResponse.json({ error: 'Source activity not found on this trip' }, { status: 404 });

  const prevNotes = typeof src.notes === 'string' ? src.notes : '';
  const insertPayload: Record<string, unknown> = {
    trip_id: tripId,
    activity_name: src.activity_name,
    activity_type: src.activity_type,
    source: 'group_shared',
    status: 'suggested',
    city: src.city,
    country_code: src.country_code,
    estimated_cost: src.estimated_cost,
    currency_code: src.currency_code,
    notes: `[group_shared:${sourceId}] ${prevNotes}`.trim(),
    booking_url: src.booking_url,
    date_hint: src.date_hint,
    sort_order: (src.sort_order as number | null) ?? 0,
  };

  if (src.draft_version_id != null) {
    insertPayload.draft_version_id = src.draft_version_id;
  }

  const { data: created, error: iErr } = await admin.from('activity_candidates').insert(insertPayload).select('candidate_id').maybeSingle();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  await emitTravelShieldEvent(admin, {
    eventType: 'shared_item_added_to_itinerary',
    featureId: 'F-2.0.12-INVITES',
    scopeType: 'trip',
    scopeId: tripId,
    actorId: user.id,
    metadata: { trip_id: tripId, account_id: user.id, source_item_id: sourceId },
    idempotencyKey: `shared_add:${tripId}:${user.id}:${sourceId}:${created?.candidate_id}`,
  });

  return NextResponse.json({ ok: true, candidate_id: created?.candidate_id });
}
