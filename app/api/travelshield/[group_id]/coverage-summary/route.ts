import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(request: NextRequest, { params }: { params: { group_id: string } }) {
  const groupId = params.group_id;
  if (!isUuid(groupId)) {
    return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  }

  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data: mem } = await admin
    .from('travelshield_members')
    .select('member_id')
    .eq('group_id', groupId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: group } = await admin.from('travelshield_groups').select('trip_id').eq('group_id', groupId).maybeSingle();
  const tripId = (group?.trip_id as string | null) ?? null;
  if (!tripId) {
    return NextResponse.json({ summaries: [], trip_id: null, organizer: false });
  }

  const { data: gp } = await admin
    .from('group_participants')
    .select('role')
    .eq('trip_id', tripId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const isOrganizer = (gp?.role as string | undefined) === 'organizer';
  if (!isOrganizer) {
    return NextResponse.json({ error: 'Organizer only' }, { status: 403 });
  }

  const { data: summaries, error } = await admin.from('group_coverage_summary').select('*').eq('trip_id', tripId);
  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  return NextResponse.json({ trip_id: tripId, organizer: true, summaries: summaries ?? [] });
}
