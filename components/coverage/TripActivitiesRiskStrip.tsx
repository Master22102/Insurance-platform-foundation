'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';

type Row = {
  candidate_id: string;
  activity_name: string;
  activity_type: string | null;
  status: string;
  risk_level: string | null;
  coverage_conflict_detected: boolean | null;
};

function badgeFor(a: Row): { label: string; bg: string; border: string; color: string } {
  if (a.coverage_conflict_detected) {
    return { label: 'Clause match', bg: '#fef2f2', border: '#fecaca', color: '#991b1b' };
  }
  if (a.risk_level === 'extreme' || a.risk_level === 'high') {
    return { label: 'Elevated activity type', bg: '#fffbeb', border: '#fde68a', color: '#92400e' };
  }
  if (a.risk_level === 'elevated') {
    return { label: 'Review exclusions', bg: '#fffbeb', border: '#fcd34d', color: '#b45309' };
  }
  return { label: 'No automated match', bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' };
}

export default function TripActivitiesRiskStrip({ tripId }: { tripId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_candidates')
      .select(
        'candidate_id, activity_name, activity_type, status, risk_level, coverage_conflict_detected',
      )
      .eq('trip_id', tripId)
      .in('status', ['suggested', 'accepted'])
      .order('sort_order', { ascending: true });
    if (!error && data) setRows(data as Row[]);
    else setRows([]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const fn = (ev: Event) => {
      const d = (ev as CustomEvent<{ trip_id?: string }>).detail;
      if (d?.trip_id === tripId) void fetchRows();
    };
    window.addEventListener('wayfarer:coverage-map-refreshed', fn as EventListener);
    return () => window.removeEventListener('wayfarer:coverage-map-refreshed', fn as EventListener);
  }, [tripId, fetchRows]);

  if (loading || rows.length === 0) return null;

  return (
    <div
      style={{
        background: 'white',
        border: '0.5px solid #e8e8e8',
        borderRadius: 12,
        padding: '14px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <p
        style={{
          margin: '0 0 10px',
          fontSize: 12,
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Planned activities — coverage signals
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((a) => {
          const b = badgeFor(a);
          return (
            <li
              key={a.candidate_id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{a.activity_name}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: b.bg,
                  border: `1px solid ${b.border}`,
                  color: b.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {b.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
