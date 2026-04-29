'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import DraftHomeStepShell from '@/components/draft-home/DraftHomeStepShell';

export default function DraftHomePage() {
  const params = useParams();
  const tripId = params?.trip_id as string;
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [segmentsCount, setSegmentsCount] = useState<number>(0);
  /** All open blockers (system + user) — badge on “Resolve blockers”. */
  const [openBlockerCount, setOpenBlockerCount] = useState(0);
  /** User-added open blockers only — matches `evaluate_trip_readiness` gate for confirm. */
  const [userOpenBlockerCount, setUserOpenBlockerCount] = useState(0);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    Promise.all([
      supabase.from('trips').select('*').eq('trip_id', tripId).maybeSingle(),
      supabase.from('route_segments').select('segment_id').eq('trip_id', tripId),
    ])
      .then(([tripRes, segRes]) => {
        if (cancelled) return;
        setTrip(tripRes.data);
        setSegmentsCount((segRes.data || []).length);
      })
      .catch(() => {
        if (cancelled) return;
        setTrip(null);
        setSegmentsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !user) {
      setOpenBlockerCount(0);
      setUserOpenBlockerCount(0);
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase
        .from('unresolved_items')
        .select('item_id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('is_resolved', false)
        .eq('item_type', 'blocker'),
      supabase
        .from('unresolved_items')
        .select('item_id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('is_resolved', false)
        .eq('item_type', 'blocker')
        .eq('source', 'user'),
    ]).then(([all, usr]) => {
      if (!cancelled) {
        setOpenBlockerCount(all.count ?? 0);
        setUserOpenBlockerCount(usr.count ?? 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tripId, user, trip, segmentsCount]);

  const hasTripDates = Boolean(trip?.departure_date && trip?.return_date);
  const hasCapture = Boolean(trip?.destination_summary && String(trip.destination_summary).trim().length > 0);
  const readinessScore = useMemo(() => {
    let score = 0;
    if (hasCapture) score += 1;
    if (segmentsCount > 0) score += 1;
    if (hasTripDates) score += 1;
    return score; // 0..3
  }, [hasTripDates, hasCapture, segmentsCount]);

  const isStructured = trip?.maturity_state && trip.maturity_state !== 'DRAFT';

  return (
    <DraftHomeStepShell
      screenId="S-DRAFT-001"
      tripId={tripId}
      title="Draft Home"
      step={1}
      total={6}
      backHref="/trips"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, padding: '0 2px' }}>
          <strong style={{ color: '#1A2B4A' }}>Step 4D</strong>: Capture → Route → Activities → Blockers → Readiness → Deep Scan
          {isStructured ? (
            <span style={{ marginLeft: 8, color: '#15803d', fontWeight: 800 }}>· Trip confirmed (not in DRAFT)</span>
          ) : openBlockerCount > 0 ? (
            <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 800 }}>
              · {openBlockerCount} open blocker(s) in list
              {userOpenBlockerCount > 0 ? ` (${userOpenBlockerCount} you added)` : ''}
            </span>
          ) : null}
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Build your itinerary before Deep Scan</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Current status: <strong>{trip?.maturity_state || 'DRAFT'}</strong> · Route segments: <strong>{segmentsCount}</strong> ·
            Trip dates: <strong>{hasTripDates ? 'set' : 'missing'}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { key: 'voice', label: 'Capture', ok: hasCapture },
              { key: 'route', label: 'Route', ok: segmentsCount > 0 },
              { key: 'dates', label: 'Dates', ok: hasTripDates },
            ].map((item) => (
              <span
                key={item.key}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${item.ok ? '#bbf7d0' : '#e5e7eb'}`,
                  background: item.ok ? '#f0fdf4' : '#f5f5f5',
                  color: item.ok ? '#14532d' : '#6b7280',
                  fontWeight: 600,
                }}
              >
                {item.ok ? '✓ ' : ''}
                {item.label}
              </span>
            ))}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                color: '#6b7280',
                fontWeight: 700,
              }}
            >
              Readiness score: {readinessScore}/3
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <Link
            href={`/trips/${tripId}/draft/voice`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              minHeight: 48,
              borderRadius: 12,
              border: '1px solid #bfdbfe',
              background: '#eff4fc',
              textDecoration: 'none',
              color: '#1A2B4A',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
            }}
          >
            <span>Voice narration</span>
            <span style={{ color: '#2E5FA3', fontWeight: 900 }}>→</span>
          </Link>

          <Link
            href={`/trips/${tripId}/draft/route`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              minHeight: 48,
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: 'white',
              textDecoration: 'none',
              color: '#1A2B4A',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
            }}
          >
            <span>Add legs / build route</span>
            <span style={{ color: '#2E5FA3', fontWeight: 900 }}>→</span>
          </Link>

          <Link
            href={`/trips/${tripId}/draft/activities`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              minHeight: 48,
              borderRadius: 12,
              border: '1px solid #e9d5ff',
              background: '#faf5ff',
              textDecoration: 'none',
              color: '#1A2B4A',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
            }}
          >
            <span>Activity suggestions (optional)</span>
            <span style={{ color: '#6b21a8', fontWeight: 900 }}>→</span>
          </Link>

          <Link
            href={`/trips/${tripId}/draft/unresolved`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              minHeight: 48,
              borderRadius: 12,
              border: '1px solid #fde68a',
              background: '#fffbeb',
              textDecoration: 'none',
              color: '#1A2B4A',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Resolve blockers
              {openBlockerCount > 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    background: '#f97316',
                    color: 'white',
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}
                >
                  {openBlockerCount}
                </span>
              ) : null}
            </span>
            <span style={{ color: '#92400e', fontWeight: 900 }}>→</span>
          </Link>

          <Link
            href={`/trips/${tripId}/draft/readiness`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              minHeight: 48,
              borderRadius: 12,
              border: `1px solid ${userOpenBlockerCount > 0 && !isStructured ? '#e5e7eb' : '#bbf7d0'}`,
              background: userOpenBlockerCount > 0 && !isStructured ? '#f9fafb' : '#f0fdf4',
              textDecoration: 'none',
              color: '#1A2B4A',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 800,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Check readiness
              {userOpenBlockerCount > 0 && !isStructured ? (
                <span title="Resolve or clear user-added blockers before confirming">🔒</span>
              ) : null}
            </span>
            <span style={{ color: '#16a34a', fontWeight: 900 }}>→</span>
          </Link>
        </div>

        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
          Readiness uses <code>evaluate_trip_readiness</code> / <code>confirm_trip_readiness</code> after migration{' '}
          <code>20260331140000_step4d_draft_home_readiness_gate.sql</code> is applied.
        </p>
      </div>
    </DraftHomeStepShell>
  );
}

