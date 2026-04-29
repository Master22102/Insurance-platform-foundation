import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_EN = {
  card_title: 'Traveler safety card',
  emergency_contact: 'Emergency contact',
  medical: 'Medical',
  allergies: 'Allergies',
  medications: 'Medications',
  accommodation: 'Accommodation',
  insurance: 'Insurance',
  useful_phrases: 'Useful phrases',
  embassy: 'Embassy',
  i_need_help: 'I need help',
  call_ambulance: 'Call an ambulance',
  i_am_allergic: 'I am allergic to these',
  i_dont_speak: 'I do not speak the local language',
  take_me_to_address: 'Please take me to this address',
};

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const tripId = request.nextUrl.searchParams.get('trip_id')?.trim() || '';
  const lang = (request.nextUrl.searchParams.get('lang')?.trim() || 'en').slice(0, 5);

  const [{ data: profile }, { data: translations }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('display_name, emergency_contact_name, emergency_contact_phone, preferences')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('safety_card_translations')
      .select('phrase_key, english_text, local_text, romanization, category')
      .eq('language_code', lang),
  ]);

  const translationMap: Record<string, { local_text: string; romanization: string | null }> = {};
  for (const row of translations || []) {
    translationMap[row.phrase_key as string] = {
      local_text: String((row as any).local_text || ''),
      romanization: ((row as any).romanization as string | null) || null,
    };
  }

  const prefs = profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
  const allergies = Array.isArray((prefs as any).allergies) ? ((prefs as any).allergies as string[]) : [];
  const medications = Array.isArray((prefs as any).medications) ? ((prefs as any).medications as string[]) : [];

  let embassy: Record<string, unknown> | null = null;
  if (tripId) {
    const { data: trip } = await admin
      .from('trips')
      .select('destination_summary')
      .eq('trip_id', tripId)
      .maybeSingle();
    const hostCode = String(trip?.destination_summary || '').toUpperCase().includes('JAPAN') ? 'JP' : '';
    if (hostCode) {
      const { data } = await admin
        .from('embassy_references')
        .select('*')
        .eq('passport_country_code', 'US')
        .eq('host_country_code', hostCode)
        .maybeSingle();
      embassy = (data as Record<string, unknown> | null) || null;
    }
  }

  await emitTravelShieldEvent(admin, {
    eventType: 'safety_card_generated',
    featureId: 'F-EMERGENCY-CARD',
    scopeType: 'user',
    scopeId: user.id,
    actorId: user.id,
    metadata: { account_id: user.id, trip_id: tripId || null, language_code: lang },
    idempotencyKey: `safety_card_generated:${user.id}:${tripId || 'none'}:${lang}`,
  });

  return NextResponse.json({
    language_code: lang,
    labels: Object.fromEntries(
      Object.entries(FALLBACK_EN).map(([k, en]) => [
        k,
        translationMap[k]
          ? {
              english_text: en,
              local_text: translationMap[k].local_text,
              romanization: translationMap[k].romanization,
            }
          : { english_text: en, local_text: en, romanization: null },
      ]),
    ),
    profile: {
      display_name: profile?.display_name || null,
      emergency_contact_name: profile?.emergency_contact_name || null,
      emergency_contact_phone: profile?.emergency_contact_phone || null,
      allergies,
      medications,
    },
    embassy,
  });
}
