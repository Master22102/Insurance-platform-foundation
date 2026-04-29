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
 * GET /api/group/coverage-alerts?trip_id=
 * Organizer-only. Returns privacy-safe messages (no policy names / clause text).
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

  const { data: snap } = await admin
    .from('coverage_graph_snapshots')
    .select('snapshot_id')
    .eq('trip_id', tripId)
    .eq('graph_status', 'COMPLETE')
    .order('computation_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snap?.snapshot_id) {
    return NextResponse.json({ alerts: [] });
  }

  const { data: gaps, error } = await admin
    .from('coverage_gaps')
    .select('gap_id, gap_type, severity, metadata')
    .eq('snapshot_id', snap.snapshot_id)
    .in('gap_type', ['activity_excluded', 'geographic_excluded'])
    .in('severity', ['warning', 'critical']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alerts = (gaps ?? []).map((g) => {
    const m = (g.metadata || {}) as Record<string, unknown>;
    const activity =
      typeof m.activity_name === 'string'
        ? m.activity_name
        : typeof m.destination_label === 'string'
          ? m.destination_label
          : 'a planned activity';
    const destination =
      typeof m.destination_name === 'string'
        ? m.destination_name
        : typeof m.region_label === 'string'
          ? m.region_label
          : 'your itinerary';
    const line =
      g.gap_type === 'activity_excluded'
        ? `A participant's coverage may not fully cover "${activity}". Your itinerary includes activities in ${destination}.`
        : `A geographic coverage gap may affect plans involving ${destination}.`;
    return {
      gap_id: g.gap_id,
      severity: g.severity,
      message: line,
      activity_label: activity,
      destination_label: destination,
    };
  });

  return NextResponse.json({ alerts });
}
