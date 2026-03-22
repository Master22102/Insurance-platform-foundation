import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { benefitTypeDisplay } from '@/lib/coverage/benefitLabels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PolicyCol = { policy_id: string; policy_label: string | null; provider_name: string | null };

function formatCellAmount(
  amount: unknown,
  currency: unknown,
  deductible: unknown,
  waiting: unknown,
): string {
  const parts: string[] = [];
  if (amount != null && Number(amount) > 0) {
    const cur = (currency && String(currency)) || 'USD';
    parts.push(`${cur} ${Number(amount).toLocaleString()}`);
  }
  if (deductible != null && Number(deductible) > 0) {
    parts.push(`ded ${Number(deductible).toLocaleString()}`);
  }
  if (waiting != null && Number(waiting) > 0) {
    parts.push(`${waiting}h wait`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Covered';
}

/**
 * GET /api/coverage-graph/intelligence?trip_id=<uuid>
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

  const { data: tripPolicies } = await supabase
    .from('policies')
    .select('policy_id, policy_label, provider_name, lifecycle_state')
    .eq('trip_id', tripId)
    .is('archived_at', null);

  const policies = (tripPolicies ?? []).filter((p) => p.lifecycle_state === 'active') as PolicyCol[];

  if (!snap) {
    return NextResponse.json({
      snapshot: null,
      summaries: [],
      gaps: [],
      comparison: {
        policies,
        benefit_rows: [],
      },
      gap_count_warning_or_critical: 0,
    });
  }

  const [{ data: summaries }, { data: gaps }, { data: nodes }] = await Promise.all([
    supabase.from('coverage_summaries').select('*').eq('snapshot_id', snap.snapshot_id),
    supabase.from('coverage_gaps').select('*').eq('snapshot_id', snap.snapshot_id),
    supabase
      .from('coverage_nodes')
      .select(
        'node_id, node_type, benefit_type, policy_version_id, coverage_trigger_clause_id, primacy_rank, exclusion_clause_ids',
      )
      .eq('snapshot_id', snap.snapshot_id),
  ]);

  const versionIds = Array.from(new Set((nodes ?? []).map((n) => n.policy_version_id).filter(Boolean) as string[]));
  let versionToPolicy: Record<string, string> = {};
  if (versionIds.length > 0) {
    const { data: vers } = await supabase.from('policy_versions').select('version_id, policy_id').in('version_id', versionIds);
    versionToPolicy = Object.fromEntries((vers ?? []).map((v) => [v.version_id as string, v.policy_id as string]));
  }

  const clauseIds = Array.from(
    new Set((nodes ?? []).map((n) => n.coverage_trigger_clause_id).filter(Boolean) as string[]),
  );
  let clauseById: Record<string, Record<string, unknown>> = {};
  if (clauseIds.length > 0) {
    const { data: clauses } = await supabase
      .from('policy_clauses')
      .select(
        'clause_id, normalized_amount, normalized_currency, normalized_deductible, normalized_waiting_period_hours, canonical_text',
      )
      .in('clause_id', clauseIds);
    clauseById = Object.fromEntries((clauses ?? []).map((c) => [c.clause_id as string, c as Record<string, unknown>]));
  }

  const benefitSet = new Set<string>();
  for (const s of summaries ?? []) {
    if (s.benefit_type) benefitSet.add(s.benefit_type as string);
  }
  for (const n of nodes ?? []) {
    if (n.benefit_type) benefitSet.add(n.benefit_type as string);
  }

  const benefitList = Array.from(benefitSet).sort();

  const benefit_rows = benefitList.map((benefit_type) => {
    const cells: Record<
      string,
      { text: string; status: 'none' | 'covered' | 'excluded'; has_exclusion_hint?: boolean }
    > = {};

    for (const pol of policies) {
      const pid = pol.policy_id;
      const matchNodes = (nodes ?? []).filter(
        (n) =>
          n.benefit_type === benefit_type && versionToPolicy[n.policy_version_id as string] === pid,
      );
      const ex = matchNodes.find((n) => n.node_type === 'exclusion');
      const ben = matchNodes.find((n) => n.node_type === 'benefit');

      if (ex && !ben) {
        cells[pid] = { text: 'Excluded', status: 'excluded', has_exclusion_hint: true };
      } else if (ben) {
        const cid = ben.coverage_trigger_clause_id as string | null;
        const pc = cid ? clauseById[cid] : undefined;
        const hasExOnBenefit =
          Array.isArray((ben as { exclusion_clause_ids?: string[] }).exclusion_clause_ids) &&
          ((ben as { exclusion_clause_ids?: string[] }).exclusion_clause_ids?.length ?? 0) > 0;
        cells[pid] = {
          text: formatCellAmount(
            pc?.normalized_amount,
            pc?.normalized_currency,
            pc?.normalized_deductible,
            pc?.normalized_waiting_period_hours,
          ),
          status: 'covered',
          has_exclusion_hint: hasExOnBenefit,
        };
      } else {
        cells[pid] = { text: '—', status: 'none' };
      }
    }

    return {
      benefit_type,
      benefit_label: benefitTypeDisplay(benefit_type),
      cells,
    };
  });

  const sortedGaps = [...(gaps ?? [])].sort((a, b) => {
    const sev = (x: { severity?: string }) => {
      const s = x.severity ?? '';
      if (s === 'critical') return 0;
      if (s === 'warning') return 1;
      return 2;
    };
    const d = sev(a as { severity?: string }) - sev(b as { severity?: string });
    if (d !== 0) return d;
    return String(a.benefit_type ?? '').localeCompare(String(b.benefit_type ?? ''));
  });

  const gap_count_warning_or_critical = sortedGaps.filter((g) =>
    ['warning', 'critical'].includes(String((g as { severity?: string }).severity)),
  ).length;

  return NextResponse.json({
    snapshot: {
      snapshot_id: snap.snapshot_id,
      computation_timestamp: snap.computation_timestamp,
      graph_status: snap.graph_status,
      total_nodes: nodes?.length ?? 0,
    },
    summaries: summaries ?? [],
    gaps: sortedGaps,
    comparison: {
      policies,
      benefit_rows,
    },
    gap_count_warning_or_critical,
  });
}
