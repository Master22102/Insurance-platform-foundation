'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { benefitTypeDisplay } from '@/lib/coverage/benefitLabels';

type SummaryRow = {
  benefit_type: string;
  total_sources: number;
  primary_policy_label: string | null;
  combined_limit: number | null;
  combined_currency: string | null;
  has_exclusion: boolean;
  has_overlap: boolean;
  has_coordination_clause: boolean;
  lowest_deductible: number | null;
  shortest_waiting_period_hours: number | null;
  confidence: string;
  plain_language_summary: string | null;
};

type GapRow = {
  gap_id: string;
  gap_type: string;
  benefit_type: string;
  description: string;
  severity: string;
  catalog_suggestion_id: string | null;
};

type PolicyCol = { policy_id: string; policy_label: string | null; provider_name: string | null };

type IntelResponse = {
  snapshot: { snapshot_id: string; computation_timestamp: string; total_nodes: number } | null;
  summaries: SummaryRow[];
  gaps: GapRow[];
  comparison: { policies: PolicyCol[]; benefit_rows: Array<{ benefit_type: string; benefit_label: string; cells: Record<string, { text: string; status: string; has_exclusion_hint?: boolean }> }> };
  gap_count_warning_or_critical: number;
};

function cardBorder(summary: SummaryRow, hasCriticalGapForBenefit: boolean): string {
  if (hasCriticalGapForBenefit) return '1.5px solid #dc2626';
  if (summary.confidence === 'HIGH' && !summary.has_exclusion) return '1.5px solid #22c55e';
  return '1.5px solid #f59e0b';
}

export default function CoverageMatrixPanel({
  tripId,
  policyCount,
  onIntelligenceMeta,
}: {
  tripId: string;
  policyCount: number;
  onIntelligenceMeta?: (meta: { gapWarningCritical: number; hasSnapshot: boolean }) => void;
}) {
  const [data, setData] = useState<IntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [computeBusy, setComputeBusy] = useState(false);
  const [computeError, setComputeError] = useState('');
  const [narrow, setNarrow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setComputeError('');
    try {
      const res = await fetch(`/api/coverage-graph/intelligence?trip_id=${encodeURIComponent(tripId)}`, {
        credentials: 'include',
      });
      const j = (await res.json()) as IntelResponse & { error?: string };
      if (!res.ok) {
        setData(null);
        onIntelligenceMeta?.({ gapWarningCritical: 0, hasSnapshot: false });
        return;
      }
      setData(j);
      onIntelligenceMeta?.({
        gapWarningCritical: j.gap_count_warning_or_critical ?? 0,
        hasSnapshot: !!j.snapshot,
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tripId, onIntelligenceMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const fn = () => setNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const runCompute = async () => {
    setComputeBusy(true);
    setComputeError('');
    try {
      const res = await fetch('/api/coverage-graph/compute', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setComputeError(j.error || 'Coverage map could not be built.');
        return;
      }
      await load();
    } catch {
      setComputeError('Network error while building coverage map.');
    } finally {
      setComputeBusy(false);
    }
  };

  if (policyCount === 0) return null;

  const summaries = data?.summaries ?? [];
  const gaps = data?.gaps ?? [];
  const snapshot = data?.snapshot;
  const policies = data?.comparison?.policies ?? [];
  const benefitRows = data?.comparison?.benefit_rows ?? [];

  const criticalBenefits = new Set(
    gaps.filter((g) => g.severity === 'critical' && g.gap_type === 'no_coverage').map((g) => g.benefit_type),
  );

  const notableGaps = gaps.filter((g) => g.severity === 'warning' || g.severity === 'critical');

  return (
    <div id="coverage-matrix-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        {!snapshot ? (
          <button
            type="button"
            disabled={computeBusy}
            onClick={() => void runCompute()}
            style={{
              padding: '10px 18px',
              background: '#1A2B4A',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: computeBusy ? 'wait' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {computeBusy ? 'Building coverage map…' : 'Build coverage map'}
          </button>
        ) : (
          <button
            type="button"
            disabled={computeBusy}
            onClick={() => void runCompute()}
            style={{
              padding: '6px 12px',
              background: 'white',
              color: '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: computeBusy ? 'wait' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {computeBusy ? 'Refreshing…' : 'Refresh coverage map'}
          </button>
        )}
        {computeError ? (
          <span style={{ fontSize: 12, color: '#b91c1c' }}>{computeError}</span>
        ) : null}
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Loading coverage comparison…</p>
      ) : null}

      {!loading && snapshot && summaries.length === 0 ? (
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Coverage map exists but comparison summaries are not available yet. Try refreshing the map.
        </p>
      ) : null}

      {!loading && snapshot && summaries.length > 0 ? (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Benefit comparison
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 10,
            }}
          >
            {summaries.map((s) => (
              <div
                key={s.benefit_type}
                style={{
                  background: 'white',
                  borderRadius: 12,
                  padding: '12px 14px',
                  border: cardBorder(s, criticalBenefits.has(s.benefit_type)),
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {benefitTypeDisplay(s.benefit_type)}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#475569' }}>
                  {s.total_sources} {s.total_sources === 1 ? 'source' : 'sources'}
                  {s.combined_limit != null && Number(s.combined_limit) > 0
                    ? ` · combined limit ${(s.combined_currency || 'USD').trim()} ${Number(s.combined_limit).toLocaleString()}`
                    : ''}
                </p>
                {s.primary_policy_label ? (
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>
                    Primary in graph: {s.primary_policy_label}
                  </p>
                ) : null}
                {s.lowest_deductible != null && Number(s.lowest_deductible) > 0 ? (
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>
                    Lowest deductible recorded: {Number(s.lowest_deductible).toLocaleString()}
                  </p>
                ) : null}
                {s.shortest_waiting_period_hours != null && s.shortest_waiting_period_hours > 0 ? (
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>
                    Shortest wait before trigger: {s.shortest_waiting_period_hours}h
                  </p>
                ) : null}
                {s.has_exclusion ? (
                  <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                    Exclusion language present on one or more clauses.
                  </p>
                ) : null}
                {s.plain_language_summary ? (
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                    {s.plain_language_summary}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {!loading && notableGaps.length > 0 ? (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: '12px 14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>
            {notableGaps.length} coverage note{notableGaps.length === 1 ? '' : 's'}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
            {notableGaps.map((g) => (
              <li key={g.gap_id} style={{ marginBottom: 6 }}>
                {g.description}
                {g.catalog_suggestion_id ? (
                  <>
                    {' '}
                    <Link
                      href={`/policies/upload?trip_id=${encodeURIComponent(tripId)}`}
                      style={{ fontWeight: 600, color: '#1d4ed8' }}
                    >
                      Add policy data
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && snapshot && policies.length >= 2 && benefitRows.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Side-by-side by policy
          </p>
          {narrow ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {benefitRows.map((row) => (
                <div
                  key={row.benefit_type}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 10,
                    background: '#fafafa',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13, color: '#111827' }}>{row.benefit_label}</p>
                  {policies.map((p) => {
                    const cell = row.cells[p.policy_id];
                    const label = p.policy_label || p.provider_name || 'Policy';
                    return (
                      <div key={p.policy_id} style={{ fontSize: 12, marginBottom: 4, color: '#374151' }}>
                        <strong>{label}:</strong>{' '}
                        <span style={{ color: cell?.status === 'none' ? '#9ca3af' : '#15803d' }}>
                          {cell?.text ?? '—'}
                          {cell?.has_exclusion_hint ? ' ⚠' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, background: 'white' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 480, fontSize: 12, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Benefit</th>
                    {policies.map((p) => (
                      <th
                        key={p.policy_id}
                        style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}
                      >
                        {p.policy_label || p.provider_name || 'Policy'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benefitRows.map((row) => (
                    <tr key={row.benefit_type}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#111827' }}>
                        {row.benefit_label}
                      </td>
                      {policies.map((p) => {
                        const cell = row.cells[p.policy_id];
                        return (
                          <td
                            key={p.policy_id}
                            style={{
                              padding: '8px 10px',
                              borderBottom: '1px solid #f3f4f6',
                              color: cell?.status === 'none' ? '#9ca3af' : '#15803d',
                            }}
                          >
                            {cell?.text ?? '—'}
                            {cell?.has_exclusion_hint ? ' ⚠' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
