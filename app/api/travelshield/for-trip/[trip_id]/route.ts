import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Returns the active TravelShield group_id for this trip for the signed-in user.
 * Uses service role + explicit membership check (avoids client PostgREST / RLS edge cases in E2E).
 */
export async function GET(_request: NextRequest, { params }: { params: { trip_id: string } }) {
  const tripId = params.trip_id;
  if (!isUuid(tripId)) {
    return NextResponse.json({ error: 'Invalid trip' }, { status: 400 });
  }

  const { user } = await getRouteUser(_request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data: memberRows, error: memErr } = await admin
    .from('travelshield_members')
    .select('group_id')
    .eq('account_id', user.id)
    .eq('status', 'active');

  if (memErr || !memberRows?.length) {
    return NextResponse.json({ group_id: null });
  }

  const groupIds = Array.from(new Set((memberRows as { group_id: string }[]).map((r) => r.group_id)));
  const { data: groupRows, error: grpErr } = await admin
    .from('travelshield_groups')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('trip_id', tripId)
    .neq('group_status', 'dissolved')
    .limit(1);

  if (grpErr || !groupRows?.length) {
    return NextResponse.json({ group_id: null });
  }

  return NextResponse.json({ group_id: (groupRows as { group_id: string }[])[0].group_id });
}
