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

type ShareMode = 'all' | 'selected' | 'none';

type Body = {
  trip_id?: string;
  share_mode?: ShareMode;
  shared_item_ids?: string[];
};

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
  const mode = body.share_mode;
  const ids = Array.isArray(body.shared_item_ids) ? body.shared_item_ids.filter((id) => typeof id === 'string' && isUuid(id)) : [];

  if (!isUuid(tripId) || !mode || !['all', 'selected', 'none'].includes(mode)) {
    return NextResponse.json({ error: 'trip_id and share_mode (all|selected|none) required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const member = await isActiveGroupMember(admin, tripId, user.id);
  if (!member) return NextResponse.json({ error: 'Not a group participant' }, { status: 403 });

  const { data: row, error: gErr } = await admin
    .from('group_participants')
    .select('metadata, participant_id')
    .eq('trip_id', tripId)
    .eq('account_id', user.id)
    .maybeSingle();

  if (gErr || !row) return NextResponse.json({ error: 'Participant row not found' }, { status: 404 });

  const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
  const next = {
    ...meta,
    sharing_preferences: {
      share_mode: mode,
      shared_item_ids: mode === 'selected' ? ids : [],
    },
  };

  const { error: uErr } = await admin
    .from('group_participants')
    .update({ metadata: next, updated_at: new Date().toISOString() })
    .eq('participant_id', row.participant_id as string);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  await emitTravelShieldEvent(admin, {
    eventType: 'itinerary_item_shared',
    featureId: 'F-2.0.12-INVITES',
    scopeType: 'trip',
    scopeId: tripId,
    actorId: user.id,
    metadata: { trip_id: tripId, sharer_id: user.id, item_id: 'preferences' },
    idempotencyKey: `itinerary_share_prefs:${tripId}:${user.id}:${mode}`,
  });

  return NextResponse.json({ ok: true });
}
