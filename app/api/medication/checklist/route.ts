import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  trip_id?: string;
  medication?: string;
  country_code?: string;
  notes?: string;
};

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body: Body = await request.json().catch(() => ({}));
  const tripId = String(body.trip_id || '').trim();
  const medication = String(body.medication || '').trim();
  const countryCode = String(body.country_code || '').trim().toUpperCase();
  const notes = body.notes ? String(body.notes) : '';
  if (!tripId || !medication || !countryCode) {
    return NextResponse.json({ error: 'trip_id, medication, country_code required' }, { status: 400 });
  }

  const { data: trip } = await admin
    .from('trips')
    .select('metadata')
    .eq('trip_id', tripId)
    .maybeSingle();

  const metadata = trip?.metadata && typeof trip.metadata === 'object' ? (trip.metadata as Record<string, unknown>) : {};
  const existing = Array.isArray((metadata as any).medication_checklists)
    ? ((metadata as any).medication_checklists as Array<Record<string, unknown>>)
    : [];
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    medication,
    country_code: countryCode,
    notes,
    status: 'open',
    created_by: user.id,
    created_at: new Date().toISOString(),
  };
  const next = [...existing, item];

  const { error } = await admin
    .from('trips')
    .update({ metadata: { ...metadata, medication_checklists: next }, updated_at: new Date().toISOString() })
    .eq('trip_id', tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitTravelShieldEvent(admin, {
    eventType: 'medication_checklist_created',
    featureId: 'F-EMERGENCY-MEDS',
    scopeType: 'trip',
    scopeId: tripId,
    actorId: user.id,
    metadata: { trip_id: tripId, medication, country_code: countryCode },
    idempotencyKey: `medication_checklist_created:${tripId}:${medication}:${countryCode}:${item.id}`,
  });

  return NextResponse.json({ ok: true, checklist: item });
}
