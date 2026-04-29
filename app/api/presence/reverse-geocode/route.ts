import { NextRequest, NextResponse } from 'next/server';
import { getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UA = 'WayfarerTripPresence/1.0 (trip-presence; https://wayfarer.example)';

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lon = Number(request.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoder unavailable' }, { status: 502 });
    }
    const data = (await res.json()) as {
      display_name?: string;
      address?: { country_code?: string };
    };
    const cc = data.address?.country_code ? String(data.address.country_code).toUpperCase() : null;
    return NextResponse.json({
      display_name: data.display_name || '',
      country_code: cc,
    });
  } catch {
    return NextResponse.json({ error: 'Geocoder failed' }, { status: 502 });
  }
}
