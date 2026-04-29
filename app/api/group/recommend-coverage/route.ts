import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveOrganizer } from '@/lib/group/organizer-guard';
import { queueNotification } from '@/lib/notifications/send';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type Body = {
  trip_id?: string;
  recommended_policy_label?: string;
  coverage_domains?: string[];
  requirement_level?: 'suggestion' | 'required';
  recipient_account_ids?: string[];
  add_on_notes?: Record<string, unknown>;
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
  const label = typeof body.recommended_policy_label === 'string' ? body.recommended_policy_label.trim() : '';
  const domains = Array.isArray(body.coverage_domains) ? body.coverage_domains.filter((d) => typeof d === 'string') : [];
  const level = body.requirement_level === 'required' ? 'required' : 'suggestion';
  const recipients = Array.isArray(body.recipient_account_ids)
    ? Array.from(new Set(body.recipient_account_ids.filter((id) => typeof id === 'string' && isUuid(id))))
    : [];
  const addOnNotes = body.add_on_notes && typeof body.add_on_notes === 'object' ? body.add_on_notes : {};

  if (!isUuid(tripId) || !label || recipients.length === 0) {
    return NextResponse.json({ error: 'trip_id, recommended_policy_label, recipient_account_ids required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const orgOk = await isActiveOrganizer(admin, tripId, user.id);
  if (!orgOk) return NextResponse.json({ error: 'Organizer only' }, { status: 403 });

  for (const rid of recipients) {
    const { data: gp } = await admin
      .from('group_participants')
      .select('participant_id')
      .eq('trip_id', tripId)
      .eq('account_id', rid)
      .eq('status', 'active')
      .maybeSingle();
    if (!gp) {
      return NextResponse.json({ error: `Recipient not active on trip: ${rid}` }, { status: 400 });
    }
  }

  const { data: rec, error: insErr } = await admin
    .from('group_coverage_recommendations')
    .insert({
      trip_id: tripId,
      organizer_id: user.id,
      recommended_policy_label: label,
      coverage_domains: domains,
      requirement_level: level,
      add_on_notes: addOnNotes,
      recipient_account_ids: recipients,
    })
    .select('recommendation_id')
    .maybeSingle();

  if (insErr || !rec?.recommendation_id) {
    return NextResponse.json({ error: insErr?.message || 'insert_failed' }, { status: 500 });
  }

  const recommendationId = rec.recommendation_id as string;

  if (level === 'required') {
    for (const rid of recipients) {
      const { data: row } = await admin
        .from('group_participants')
        .select('metadata')
        .eq('trip_id', tripId)
        .eq('account_id', rid)
        .maybeSingle();
      const meta = (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
      await admin
        .from('group_participants')
        .update({
          metadata: {
            ...meta,
            coverage_requirement: {
              recommendation_id: recommendationId,
              level: 'required',
              status: 'outstanding',
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('trip_id', tripId)
        .eq('account_id', rid);
    }
  }

  const title = level === 'required' ? 'Coverage required for trip' : 'Coverage recommendation';
  const bodyText =
    level === 'required'
      ? `Your organizer requires coverage confirmation: ${label}. Open the group page to respond.`
      : `Your organizer suggested coverage: ${label}. Open the group page to respond.`;

  for (const rid of recipients) {
    await queueNotification(admin, {
      accountId: rid,
      channel: 'in_app',
      category: 'trip_update',
      title,
      body: bodyText,
      data: {
        trip_id: tripId,
        recommendation_id: recommendationId,
        requirement_level: level,
        url: `/trips/${tripId}/group`,
      },
      idempotencyKey: `gcr:${recommendationId}:${rid}`,
    });
  }

  await emitTravelShieldEvent(admin, {
    eventType: 'coverage_recommendation_sent',
    featureId: 'F-2.0.12-INVITES',
    scopeType: 'trip',
    scopeId: tripId,
    actorId: user.id,
    metadata: { trip_id: tripId, recommendation_id: recommendationId, recipient_count: recipients.length },
    idempotencyKey: `coverage_recommendation_sent:${recommendationId}`,
  });

  return NextResponse.json({ ok: true, recommendation_id: recommendationId });
}
