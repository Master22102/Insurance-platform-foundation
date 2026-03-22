import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/coverage-graph/status?trip_id=<uuid>
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
    .select('snapshot_id, graph_status, computation_timestamp, input_hash')
    .eq('trip_id', tripId)
    .eq('graph_status', 'COMPLETE')
    .order('computation_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }

  if (!snap) {
    return NextResponse.json({ has_graph: false });
  }

  const { data: nodes, error: nodesErr } = await supabase
    .from('coverage_nodes')
    .select(
      'node_id, node_type, benefit_type, primacy_rank, overlap_flags, confidence_label, coverage_trigger_clause_id, policy_version_id',
    )
    .eq('snapshot_id', snap.snapshot_id);

  if (nodesErr) {
    return NextResponse.json({ error: nodesErr.message }, { status: 500 });
  }

  const clauseIds = Array.from(
    new Set((nodes ?? []).map((n) => n.coverage_trigger_clause_id).filter(Boolean) as string[]),
  );

  let clauseMap: Record<string, Record<string, unknown>> = {};
  if (clauseIds.length > 0) {
    const { data: clauses, error: cErr } = await supabase
      .from('policy_clauses')
      .select(
        'clause_id, canonical_text, family_code, clause_type, normalized_amount, normalized_currency, normalized_deductible, normalized_waiting_period_hours',
      )
      .in('clause_id', clauseIds);
    if (!cErr && clauses) {
      clauseMap = Object.fromEntries(clauses.map((c) => [c.clause_id as string, c as Record<string, unknown>]));
    }
  }

  const enriched = (nodes ?? []).map((n) => {
    const cid = n.coverage_trigger_clause_id as string | null;
    const pc = cid ? clauseMap[cid] : undefined;
    return {
      ...n,
      clause_canonical_text: (pc?.canonical_text as string) ?? null,
      clause_family_code: (pc?.family_code as string) ?? null,
      clause_normalized_amount: pc?.normalized_amount ?? null,
      clause_normalized_currency: pc?.normalized_currency ?? null,
      clause_normalized_deductible: pc?.normalized_deductible ?? null,
      clause_normalized_waiting_period_hours: pc?.normalized_waiting_period_hours ?? null,
    };
  });

  return NextResponse.json({
    has_graph: true,
    snapshot: {
      ...snap,
      node_count: enriched.length,
    },
    nodes: enriched,
  });
}
