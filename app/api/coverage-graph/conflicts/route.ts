import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GapRow = {
  gap_id: string;
  gap_type: string;
  benefit_type: string | null;
  description: string | null;
  severity: string | null;
  metadata: Record<string, unknown> | null;
  affected_policy_ids: string[] | null;
};

/**
 * GET /api/coverage-graph/conflicts?trip_id=<uuid>
 * Activity + geographic itinerary conflicts for the latest COMPLETE snapshot.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tripId = request.nextUrl.searchParams.get('trip_id')?.trim() ?? '';
  if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) {
    return NextResponse.json({ error: 'trip_id query param required (UUID)' }, { status: 400 });
  }

  const { data: snap, error: snapErr } = await supabase
    .from('coverage_graph_snapshots')
    .select('snapshot_id')
    .eq('trip_id', tripId)
    .eq('graph_status', 'COMPLETE')
    .order('computation_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }

  if (!snap) {
    return NextResponse.json({
      snapshot_id: null,
      activity_conflicts: [],
      geographic_conflicts: [],
      risk_categories: [],
    });
  }

  const { data: gaps, error: gapsErr } = await supabase
    .from('coverage_gaps')
    .select('gap_id, gap_type, benefit_type, description, severity, metadata, affected_policy_ids')
    .eq('snapshot_id', snap.snapshot_id)
    .in('gap_type', ['activity_excluded', 'geographic_excluded']);

  if (gapsErr) {
    return NextResponse.json({ error: gapsErr.message }, { status: 500 });
  }

  const rows = (gaps ?? []) as GapRow[];
  const activity_conflicts = rows
    .filter((g) => g.gap_type === 'activity_excluded')
    .map((g) => {
      const m = g.metadata ?? {};
      return {
        gap_id: g.gap_id,
        activity_name: typeof m.activity_name === 'string' ? m.activity_name : null,
        risk_category: typeof m.risk_category === 'string' ? m.risk_category : null,
        risk_level: typeof m.risk_level === 'string' ? m.risk_level : null,
        policy_label: typeof m.policy_label === 'string' ? m.policy_label : null,
        clause_id: typeof m.clause_id === 'string' ? m.clause_id : null,
        description: g.description,
        severity: g.severity,
      };
    });

  const geographic_conflicts = rows
    .filter((g) => g.gap_type === 'geographic_excluded')
    .map((g) => {
      const m = g.metadata ?? {};
      return {
        gap_id: g.gap_id,
        country_name: typeof m.country_name === 'string' ? m.country_name : null,
        country_code: typeof m.country_code === 'string' ? m.country_code : null,
        policy_label: typeof m.policy_label === 'string' ? m.policy_label : null,
        reason: typeof m.reason === 'string' ? m.reason : null,
        description: g.description,
        severity: g.severity,
      };
    });

  const { data: cats } = await supabase
    .from('activity_risk_categories')
    .select('category_name, display_name, risk_level')
    .eq('is_active', true);

  return NextResponse.json({
    snapshot_id: snap.snapshot_id,
    activity_conflicts,
    geographic_conflicts,
    risk_categories: cats ?? [],
  });
}
