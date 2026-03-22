'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';

type Context = 'trip_coverage' | 'claim_route';

const boxBase = {
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 12,
  lineHeight: 1.55,
  fontFamily: 'system-ui, -apple-system, sans-serif',
} as const;

/**
 * Read-only status for whether a COMPLETE coverage graph snapshot exists for the trip.
 */
export default function CoverageMapStatusBanner({
  tripId,
  context,
  matrixGapCount = 0,
}: {
  tripId: string;
  context: Context;
  /** F-6.5.2: warning/critical rows from coverage_gaps (optional; from CoverageMatrixPanel). */
  matrixGapCount?: number;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('coverage_graph_snapshots')
        .select('snapshot_id, graph_status')
        .eq('trip_id', tripId)
        .eq('graph_status', 'COMPLETE')
        .order('computation_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setState('error');
        return;
      }
      setState(data ? 'ready' : 'none');
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (state === 'loading') return null;

  if (state === 'error') {
    return (
      <div
        style={{
          ...boxBase,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        }}
      >
        {context === 'claim_route'
          ? 'We could not check coverage-map status. You can still try saving — the app will attempt to build the map from your policies.'
          : 'Could not load coverage map status.'}
      </div>
    );
  }

  if (state === 'none') {
    return (
      <div
        style={{
          ...boxBase,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
        }}
      >
        {context === 'claim_route' ? (
          <>
            <strong style={{ display: 'block', marginBottom: 4 }}>Coverage map</strong>
            Not built yet for this trip. When you save this step, we compute it from policies with
            auto-accepted clauses. If you have no qualifying policy data yet, you&apos;ll see an error
            and nothing will be submitted.
          </>
        ) : (
          <>
            <strong style={{ display: 'block', marginBottom: 4 }}>Coverage map</strong>
            Not built yet. After Deep Scan (or when you start claim routing), we build it from attached
            policies with auto-accepted clauses.
          </>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        ...boxBase,
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        color: '#14532d',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>Coverage map</strong>
      Ready — a completed snapshot exists for this trip, so claim routing can align against your policy
      graph{context === 'claim_route' ? ' when you save' : ''}.
      {matrixGapCount > 0 && context === 'trip_coverage' ? (
        <span style={{ display: 'block', marginTop: 6, fontWeight: 600 }}>
          {matrixGapCount} coverage note{matrixGapCount === 1 ? '' : 's'} flagged for review in the comparison below.
        </span>
      ) : null}
    </div>
  );
}
