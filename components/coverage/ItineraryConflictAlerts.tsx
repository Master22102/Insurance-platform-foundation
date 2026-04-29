'use client';

import { useCallback, useEffect, useState } from 'react';

type ActivityConflict = {
  gap_id: string;
  activity_name: string | null;
  risk_category: string | null;
  risk_level: string | null;
  policy_label: string | null;
  description: string | null;
  severity: string | null;
};

type GeoConflict = {
  gap_id: string;
  country_name: string | null;
  country_code: string | null;
  policy_label: string | null;
  reason: string | null;
  description: string | null;
  severity: string | null;
};

export default function ItineraryConflictAlerts({ tripId }: { tripId: string }) {
  const [activity, setActivity] = useState<ActivityConflict[]>([]);
  const [geo, setGeo] = useState<GeoConflict[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coverage-graph/conflicts?trip_id=${encodeURIComponent(tripId)}`, {
        credentials: 'include',
      });
      const j = (await res.json()) as {
        activity_conflicts?: ActivityConflict[];
        geographic_conflicts?: GeoConflict[];
      };
      if (!res.ok) {
        setActivity([]);
        setGeo([]);
        return;
      }
      setActivity(Array.isArray(j.activity_conflicts) ? j.activity_conflicts : []);
      setGeo(Array.isArray(j.geographic_conflicts) ? j.geographic_conflicts : []);
    } catch {
      setActivity([]);
      setGeo([]);
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

  if (loading) return null;
  if (activity.length === 0 && geo.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>
          POLICY VS ITINERARY
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
          From your latest coverage map: where activities or destinations may not match policy wording. This is intelligence from
          extracted text — not a guarantee of denial or approval.
        </p>
      </div>
      {activity.map((a) => (
        <div
          key={a.gap_id}
          style={{
            borderRadius: 12,
            border: '1px solid #f59e0b',
            background: '#fffbeb',
            padding: '14px 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
              ⛷️
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                Activity coverage alignment
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#451a03', lineHeight: 1.5 }}>
                {a.description || `${a.activity_name ?? 'Activity'} — review policy wording.`}
              </p>
              {a.risk_level ? (
                <p style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 600, color: '#b45309' }}>
                  Risk category level: {a.risk_level}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {geo.map((g) => (
        <div
          key={g.gap_id}
          style={{
            borderRadius: 12,
            border: '1px solid #dc2626',
            background: '#fef2f2',
            padding: '14px 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
              🌍
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                Destination policy wording
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#450a0a', lineHeight: 1.5 }}>
                {g.description ||
                  `Itinerary includes ${g.country_name ?? g.country_code ?? 'a destination'} — see policy text.`}
              </p>
              {g.reason ? (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#7f1d1d' }}>Reference: {g.reason}</p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
