import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveOrganizer } from '@/lib/group/organizer-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * GET /api/group/roster?trip_id=
 * Organizer-only: display names for trip roster (privacy-safe aggregation elsewhere).
 */
export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get('trip_id')?.trim() ?? '';
  if (!isUuid(tripId)) {
    return NextResponse.json({ error: 'trip_id required (UUID)' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const ok = await isActiveOrganizer(admin, tripId, user.id);
  if (!ok) return NextResponse.json({ error: 'Organizer only' }, { status: 403 });

  const { data: parts, error: pErr } = await admin
    .from('group_participants')
    .select('account_id, role, status, metadata')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const ids = Array.from(new Set((parts ?? []).map((p) => p.account_id as string)));
  const { data: profiles } = await admin.from('user_profiles').select('user_id, display_name').in('user_id', ids);

  const nameById = new Map((profiles ?? []).map((r) => [r.user_id as string, (r.display_name as string) || '']));

  return NextResponse.json({
    participants: (parts ?? []).map((p) => ({
      account_id: p.account_id,
      role: p.role,
      status: p.status,
      display_name: nameById.get(p.account_id as string)?.trim() || 'Traveler',
      metadata: p.metadata,
    })),
  });
}
