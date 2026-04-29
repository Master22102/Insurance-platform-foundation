import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  type?: 'call' | 'message' | 'share';
  number_type?: string;
  recipient_type?: string;
  method?: string;
  trip_id?: string;
};

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {}

  const type = body.type || 'call';
  const tripId = typeof body.trip_id === 'string' ? body.trip_id : null;
  if (type === 'call') {
    await emitTravelShieldEvent(admin, {
      eventType: 'emergency_call_initiated',
      featureId: 'F-EMERGENCY-SOS',
      scopeType: 'user',
      scopeId: user.id,
      actorId: user.id,
      metadata: { account_id: user.id, number_type: body.number_type || 'unknown', trip_id: tripId },
      idempotencyKey: `emergency_call_initiated:${user.id}:${Date.now()}`,
    });
  } else if (type === 'message') {
    await emitTravelShieldEvent(admin, {
      eventType: 'emergency_message_sent',
      featureId: 'F-EMERGENCY-SOS',
      scopeType: 'user',
      scopeId: user.id,
      actorId: user.id,
      metadata: { account_id: user.id, recipient_type: body.recipient_type || 'unknown', trip_id: tripId },
      idempotencyKey: `emergency_message_sent:${user.id}:${Date.now()}`,
    });
  } else {
    await emitTravelShieldEvent(admin, {
      eventType: 'safety_card_shared',
      featureId: 'F-EMERGENCY-CARD',
      scopeType: 'user',
      scopeId: user.id,
      actorId: user.id,
      metadata: { account_id: user.id, method: body.method || 'unknown', trip_id: tripId },
      idempotencyKey: `safety_card_shared:${user.id}:${Date.now()}`,
    });
  }
  return NextResponse.json({ ok: true });
}
