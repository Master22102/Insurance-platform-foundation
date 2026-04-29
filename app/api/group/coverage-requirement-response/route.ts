import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveGroupMember, isActiveOrganizer } from '@/lib/group/organizer-guard';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';
import { refreshCoverageSummaryCore } from '@/lib/group/refresh-coverage-summary-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type Body = {
  recommendation_id?: string;
  response?: 'will_look' | 'have_equivalent' | 'need_purchase' | 'uploaded';
  policy_id?: string | null;
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

  const recommendationId = typeof body.recommendation_id === 'string' ? body.recommendation_id.trim() : '';
  const response = body.response;
  const policyId = typeof body.policy_id === 'string' && isUuid(body.policy_id) ? body.policy_id : null;

  if (!isUuid(recommendationId) || !response) {
    return NextResponse.json({ error: 'recommendation_id and response required' }, { status: 400 });
  }

  if (!['will_look', 'have_equivalent', 'need_purchase', 'uploaded'].includes(response)) {
    return NextResponse.json({ error: 'invalid response' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data: rec, error: rErr } = await admin
    .from('group_coverage_recommendations')
    .select('trip_id, recipient_account_ids, requirement_level')
    .eq('recommendation_id', recommendationId)
    .maybeSingle();

  if (rErr || !rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  const recipients = (rec.recipient_account_ids as string[]) || [];
  if (!recipients.includes(user.id)) {
    return NextResponse.json({ error: 'Not a recipient' }, { status: 403 });
  }

  const tripId = rec.trip_id as string;
  const member = await isActiveGroupMember(admin, tripId, user.id);
  if (!member) return NextResponse.json({ error: 'Not an active participant' }, { status: 403 });

  let responseType = response;
  if (policyId && response === 'have_equivalent') {
    responseType = 'uploaded';
  }

  const pendingOrganizerReview = response === 'have_equivalent' && !policyId;
  const patch: Record<string, unknown> = {
    response_type: responseType,
    policy_id: policyId,
    updated_at: new Date().toISOString(),
  };

  if (response === 'have_equivalent') {
    patch.organizer_reviewed = false;
    patch.organizer_approved = null;
    patch.reviewed_at = null;
  }

  if (responseType === 'uploaded' && policyId) {
    const { data: pol } = await admin
      .from('policies')
      .select('policy_id, account_id, trip_id')
      .eq('policy_id', policyId)
      .maybeSingle();
    if (!pol || pol.account_id !== user.id || pol.trip_id !== tripId) {
      return NextResponse.json({ error: 'policy_id must belong to you and this trip' }, { status: 400 });
    }
    patch.organizer_reviewed = false;
    patch.organizer_approved = null;
  }

  const { data: upserted, error: uErr } = await admin
    .from('group_coverage_responses')
    .upsert(
      {
        recommendation_id: recommendationId,
        account_id: user.id,
        ...patch,
      },
      { onConflict: 'recommendation_id,account_id' },
    )
    .select('response_id')
    .maybeSingle();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  if (responseType === 'uploaded' && policyId) {
    const { data: row } = await admin
      .from('group_participants')
      .select('metadata')
      .eq('trip_id', tripId)
      .eq('account_id', user.id)
      .maybeSingle();
    const meta = (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
    const cr = meta.coverage_requirement as Record<string, unknown> | undefined;
    const nextMeta = { ...meta };
    if (cr && String(cr.recommendation_id) === recommendationId) {
      nextMeta.coverage_requirement = { ...cr, status: 'pending_review' };
    }
    await admin
      .from('group_participants')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('trip_id', tripId)
      .eq('account_id', user.id);
  }

  await emitTravelShieldEvent(admin, {
    eventType: 'coverage_recommendation_responded',
    featureId: 'F-2.0.12-INVITES',
    scopeType: 'trip',
    scopeId: tripId,
    actorId: user.id,
    metadata: {
      recommendation_id: recommendationId,
      account_id: user.id,
      response_type: responseType,
      pending_organizer_review: pendingOrganizerReview,
    },
    idempotencyKey: `coverage_recommendation_responded:${recommendationId}:${user.id}:${responseType}`,
  });

  if (responseType === 'uploaded' && policyId) {
    const { data: orgRow } = await admin
      .from('group_coverage_recommendations')
      .select('organizer_id')
      .eq('recommendation_id', recommendationId)
      .maybeSingle();
    const orgId = orgRow?.organizer_id as string | undefined;
    if (orgId && (await isActiveOrganizer(admin, tripId, orgId))) {
      await refreshCoverageSummaryCore(admin, tripId, orgId);
    }
  }

  return NextResponse.json({
    ok: true,
    response_id: upserted?.response_id,
    pending_organizer_review: pendingOrganizerReview,
  });
}
