import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';
import { inferDestinationCountryCodes } from '@/lib/emergency/destination-country';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const tripId = request.nextUrl.searchParams.get('trip_id')?.trim() || '';

  const [{ data: profile }, { data: docs }, { data: contacts }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('display_name, primary_nationality, residence_country_code, emergency_contact_name, emergency_contact_phone')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('personal_documents')
      .select('document_id, document_type, label, expires_at')
      .eq('account_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    admin
      .from('travelshield_group_members')
      .select('group_id, role')
      .eq('account_id', user.id)
      .eq('status', 'active')
      .limit(1),
  ]);

  let embassy: Record<string, unknown> | null = null;
  if (tripId) {
    const { data: trip } = await admin
      .from('trips')
      .select('destination_summary')
      .eq('trip_id', tripId)
      .maybeSingle();
    const inferred = await inferDestinationCountryCodes(admin, String(trip?.destination_summary || ''));
    const hostCountry = inferred[0] || '';
    if (hostCountry) {
      const { data } = await admin
        .from('embassy_references')
        .select('*')
        .eq('passport_country_code', String((profile as any)?.primary_nationality || 'US').toUpperCase())
        .eq('host_country_code', hostCountry)
        .eq('is_active', true)
        .maybeSingle();
      embassy = (data as Record<string, unknown> | null) || null;
    }
  }

  await emitTravelShieldEvent(admin, {
    eventType: 'emergency_sos_opened',
    featureId: 'F-EMERGENCY-SOS',
    scopeType: 'user',
    scopeId: user.id,
    actorId: user.id,
    metadata: { account_id: user.id, trip_id: tripId || null },
    idempotencyKey: `emergency_sos_opened:${user.id}:${tripId || 'none'}`,
  });

  return NextResponse.json({
    profile: profile || null,
    personal_documents: docs || [],
    travelshield_membership: contacts?.[0] || null,
    embassy,
    emergency_numbers: {
      police: '112',
      ambulance: '112',
      fire: '112',
    },
  });
}
