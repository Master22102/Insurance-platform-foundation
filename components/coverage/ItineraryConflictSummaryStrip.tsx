'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/**
 * Compact Overview entry to the same `/api/coverage-graph/conflicts` data as ItineraryConflictAlerts (Coverage tab).
 */
export default function ItineraryConflictSummaryStrip({
  tripId,
  coverageTabHref,
}: {
  tripId: string;
  coverageTabHref: string;
}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coverage-graph/conflicts?trip_id=${encodeURIComponent(tripId)}`, {
        credentials: 'include',
      });
      const j = (await res.json()) as {
        activity_conflicts?: unknown[];
        geographic_conflicts?: unknown[];
      };
      if (!res.ok) {
        setCount(0);
        return;
      }
      const a = Array.isArray(j.activity_conflicts) ? j.activity_conflicts.length : 0;
      const g = Array.isArray(j.geographic_conflicts) ? j.geographic_conflicts.length : 0;
      setCount(a + g);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fn = (ev: Event) => {
      const d = (ev as CustomEvent<{ trip_id?: string }>).detail;
      if (d?.trip_id === tripId) void load();
    };
    window.addEventListener('wayfarer:coverage-map-refreshed', fn as EventListener);
    return () => window.removeEventListener('wayfarer:coverage-map-refreshed', fn as EventListener);
  }, [tripId, load]);

  if (loading || count === 0) return null;

  return (
    <div
      style={{
        marginTop: 4,
        marginBottom: 4,
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid #fcd34d',
        background: '#fffbeb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.45 }}>
        <strong>Policy vs itinerary</strong>
        <span style={{ fontWeight: 500 }}>
          {' '}
          — {count} signal{count === 1 ? '' : 's'} from your coverage map (activities or destinations vs policy wording).
        </span>
      </p>
      <Link
        href={coverageTabHref}
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#1e3a5f',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid #f59e0b',
          background: 'white',
        }}
      >
        View on Coverage →
      </Link>
    </div>
  );
}
