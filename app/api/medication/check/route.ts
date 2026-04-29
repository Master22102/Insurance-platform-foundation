import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { detectMedicationAlerts, type MedicationRestrictionRow } from '@/lib/emergency/medication';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';
import { inferDestinationCountryCodes } from '@/lib/emergency/destination-country';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const tripId = String(body.trip_id || '').trim();
  const medications = Array.isArray(body.medications) ? body.medications.map((m: unknown) => String(m)) : [];
  let countryCodes = Array.isArray(body.country_codes)
    ? body.country_codes.map((c: unknown) => String(c).toUpperCase())
    : [];

  if (!countryCodes.length && tripId) {
    const { data: trip } = await admin
      .from('trips')
      .select('destination_summary')
      .eq('trip_id', tripId)
      .maybeSingle();
    countryCodes = await inferDestinationCountryCodes(admin, String(trip?.destination_summary || ''));
  }
  if (!countryCodes.length) return NextResponse.json({ alerts: [] });

  const { data, error } = await admin
    .from('medication_country_restrictions')
    .select(
      'country_code, medication_class, specific_drug_names, restriction_level, required_documentation, notes, documentation_url',
    )
    .in('country_code', countryCodes)
    .eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alerts = detectMedicationAlerts(medications, (data || []) as MedicationRestrictionRow[]);

  for (const a of alerts) {
    await emitTravelShieldEvent(admin, {
      eventType: 'medication_restriction_detected',
      featureId: 'F-EMERGENCY-MEDS',
      scopeType: 'user',
      scopeId: user.id,
      actorId: user.id,
      metadata: { account_id: user.id, medication: a.medication, country_code: a.country_code },
      idempotencyKey: `medication_restriction_detected:${user.id}:${a.medication}:${a.country_code}`,
    });
  }

  return NextResponse.json({ alerts });
}
