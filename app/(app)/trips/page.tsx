'use client';

import { useState, useEffect, Suspense, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import CreatorSearchPanel from '@/components/creators/CreatorSearchPanel';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useIsMobile';
import { mobileStyles, tabletStyles } from '@/lib/styles/responsive';

const BANNER_PALETTES = [
  { bg: '#1A2B4A', text: '#c8d8f0' },
  { bg: '#14532d', text: '#bbf7d0' },
  { bg: '#7c2d12', text: '#fed7aa' },
  { bg: '#1e3a5f', text: '#bfdbfe' },
  { bg: '#3d1a6e', text: '#e9d5ff' },
  { bg: '#134e4a', text: '#99f6e4' },
  { bg: '#4c1d0d', text: '#fde8d8' },
  { bg: '#1c3d5a', text: '#bae6fd' },
];

function getPaletteForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return BANNER_PALETTES[Math.abs(hash) % BANNER_PALETTES.length];
}

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstNameFromProfile(displayName: string | null | undefined, email: string | undefined) {
  if (displayName?.trim()) return displayName.trim().split(/\s+/)[0] ?? 'there';
  if (email) return email.split('@')[0] ?? 'there';
  return 'there';
}

function TripCardWeather({
  destination,
  unit,
}: {
  destination?: string;
  unit: 'F' | 'C';
}) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!destination?.trim()) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination.trim().slice(0, 48))}&count=1`,
          { signal: ac.signal },
        );
        const geo = await geoRes.json();
        const r = geo.results?.[0];
        if (!r) return;
        const tempParam = unit === 'F' ? 'fahrenheit' : 'celsius';
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}&current=temperature_2m&temperature_unit=${tempParam}`,
          { signal: ac.signal },
        );
        const wj = await wRes.json();
        const t = wj.current?.temperature_2m;
        if (typeof t === 'number') {
          setLine(`${Math.round(t)}°${unit} at destination`);
        }
      } catch {
        /* aborted or network */
      }
    })();
    return () => ac.abort();
  }, [destination, unit]);

  if (!line) return null;
  return (
    <p style={{ fontSize: 11, color: '#64748b', margin: '8px 0 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {line}
    </p>
  );
}

function getInitials(name: string) {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const MATURITY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  DRAFT:                      { bg: '#f5f5f5', border: '#e0e0e0', text: '#777', label: 'Draft' },
  PRE_TRIP_STRUCTURED:        { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3', label: 'Planning' },
  INCIDENT_OPEN:              { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Incident open' },
  DOCUMENTATION_IN_PROGRESS:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'In progress' },
  CLAIM_ROUTING_LOCKED:       { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', label: 'Claim routing' },
  CLAIM_SUBMITTED:            { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3', label: 'Submitted' },
  POST_TRIP_RESOLVED:         { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', label: 'Resolved' },
  ARCHIVED:                   { bg: '#f5f5f5', border: '#e0e0e0', text: '#aaa', label: 'Archived' },
};

const TRAVEL_MODE_ICON_PATHS: Record<string, string> = {
  air: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  rail: 'M5 2h14v17H5zM5 13h14M9 19l-2 3M15 19l2 3M9 6h6',
  sea: 'M3 17c2 0 2-1.5 4-1.5S9 17 11 17s2-1.5 4-1.5S17 17 21 17M12 3v9M8 8l4-5 4 5',
  road: 'M3 11h18v10H3zM7 11V7a5 5 0 0110 0v4',
  mixed: 'M12 3a9 9 0 100 18A9 9 0 0012 3zM12 7v5l3 3',
};

function MaturityBadge({ state }: { state: string }) {
  const cfg = MATURITY_COLORS[state] || MATURITY_COLORS.DRAFT;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: cfg.text,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function formatDateRange(departure?: string, returnDate?: string) {
  if (!departure && !returnDate) return null;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (departure && returnDate) return `${fmt(departure)} – ${fmt(returnDate)}`;
  if (departure) return `Departs ${fmt(departure)}`;
  return null;
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'white', border: '0.5px solid #eaeaea',
      borderRadius: 14, overflow: 'hidden', height: 200,
      animation: 'skpulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ height: 72, background: '#f0f0f0' }} />
      <div style={{ padding: '14px 18px' }}>
        <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, width: '60%', marginBottom: 10 }} />
        <div style={{ height: 12, background: '#f0f0f0', borderRadius: 4, width: '40%' }} />
      </div>
      <style>{`@keyframes skpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

function WelcomeBanner() {
  const params = useSearchParams();
  if (params.get('welcome') !== '1') return null;
  return (
    <div style={{
      padding: '12px 16px', background: '#eff4fc',
      border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 24,
      fontSize: 14, color: '#1e40af', lineHeight: 1.5,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      Your account is ready. Let&apos;s build your first trip.
    </div>
  );
}

interface TripWithStats {
  trip_id: string;
  trip_name: string;
  maturity_state: string;
  departure_date?: string;
  return_date?: string;
  paid_unlock: boolean;
  destination_summary?: string;
  travel_mode_primary?: string;
  created_at: string;
  policy_count: number;
  open_incident_count: number;
  latest_open_incident_id: string | null;
}

function tripContextLine(trips: TripWithStats[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sorted = [...trips]
    .filter((t) => t.departure_date)
    .sort((a, b) => new Date(a.departure_date!).getTime() - new Date(b.departure_date!).getTime());
  for (const t of sorted) {
    const dep = new Date(t.departure_date!);
    dep.setHours(0, 0, 0, 0);
    const ret = t.return_date ? new Date(t.return_date) : null;
    if (ret) ret.setHours(0, 0, 0, 0);
    if (ret && today >= dep && today <= ret) {
      const dayN = Math.floor((today.getTime() - dep.getTime()) / 86400000) + 1;
      const total = Math.max(1, Math.floor((ret.getTime() - dep.getTime()) / 86400000) + 1);
      const city = t.destination_summary?.split(',')[0]?.trim() || 'your destination';
      return { text: `You're on day ${dayN} of ${total} in ${city}` };
    }
    if (today < dep) {
      const days = Math.ceil((dep.getTime() - today.getTime()) / 86400000);
      const label = (t.trip_name && String(t.trip_name).trim()) || t.destination_summary || 'trip';
      return { text: `Your ${label} is in ${days} day${days === 1 ? '' : 's'}` };
    }
  }
  return null;
}

function getTripSchedule(trip: TripWithStats) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!trip.departure_date) return { kind: 'unknown' as const };
  const dep = new Date(trip.departure_date);
  dep.setHours(0, 0, 0, 0);
  const ret = trip.return_date ? new Date(trip.return_date) : null;
  if (ret) ret.setHours(0, 0, 0, 0);
  if (ret && today >= dep && today <= ret) {
    const dayN = Math.floor((today.getTime() - dep.getTime()) / 86400000) + 1;
    const total = Math.max(1, Math.floor((ret.getTime() - dep.getTime()) / 86400000) + 1);
    return { kind: 'mid' as const, dayN, total };
  }
  if (today < dep) {
    const days = Math.ceil((dep.getTime() - today.getTime()) / 86400000);
    return { kind: 'upcoming' as const, days };
  }
  return { kind: 'past' as const };
}

function unsplashQueryForTrip(trip: TripWithStats) {
  const dest = trip.destination_summary?.trim();
  if (dest) return dest.slice(0, 80);
  return (trip.trip_name && String(trip.trip_name).trim()) || 'travel';
}

function TripCard({
  trip,
  isMobile,
  tempUnit,
}: {
  trip: TripWithStats;
  isMobile: boolean;
  tempUnit: 'F' | 'C';
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const safeTripName = (trip.trip_name && String(trip.trip_name).trim()) ? String(trip.trip_name) : 'Trip';
  const palette = getPaletteForName(safeTripName);
  const initials = getInitials(safeTripName);
  const dateRange = formatDateRange(trip.departure_date, trip.return_date);
  const mode = trip.travel_mode_primary || 'air';
  const modeIconPath = TRAVEL_MODE_ICON_PATHS[mode] || TRAVEL_MODE_ICON_PATHS.air;
  const hasOpenIncident = trip.open_incident_count > 0 && trip.latest_open_incident_id;
  const schedule = getTripSchedule(trip);
  const unsplashQ = unsplashQueryForTrip(trip);
  const photoSrc = `https://source.unsplash.com/400x200/?${encodeURIComponent(unsplashQ)}`;

  const frostedBadge = (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: '#0f172a',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '0.5px solid rgba(255,255,255,0.5)',
        borderRadius: 20,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {(MATURITY_COLORS[trip.maturity_state || 'DRAFT'] || MATURITY_COLORS.DRAFT).label}
    </span>
  );

  const countdownBlock =
    schedule.kind === 'upcoming' ? (
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 56 }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1A2B4A', lineHeight: 1 }}>{schedule.days}</p>
        <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 600 }}>days away</p>
      </div>
    ) : schedule.kind === 'mid' ? (
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 56 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.2 }}>Day {schedule.dayN}</p>
        <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 600 }}>of {schedule.total}</p>
      </div>
    ) : null;

  return (
    <div style={{
      background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 14,
      overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif',
      transition: 'box-shadow 0.15s ease',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {isMobile ? (
        <Link href={`/trips/${trip.trip_id}`} style={{ textDecoration: 'none', display: 'block' }}>
          <div
            style={{
              height: 108,
              position: 'relative',
              background: palette.bg,
              overflow: 'hidden',
            }}
          >
            {!photoFailed ? (
              <img
                alt=""
                src={photoSrc}
                onError={() => setPhotoFailed(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: photoFailed
                  ? palette.bg
                  : 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 14,
                right: 14,
                bottom: 12,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: photoFailed ? palette.text : '#ffffff',
                  lineHeight: 1.25,
                  textShadow: photoFailed ? undefined : '0 1px 3px rgba(0,0,0,0.45)',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {safeTripName}
              </p>
              {frostedBadge}
            </div>
          </div>
        </Link>
      ) : (
        <Link href={`/trips/${trip.trip_id}`} style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{
            background: palette.bg, padding: '18px 20px',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            minHeight: 76, position: 'relative',
          }}>
            <span style={{
              fontSize: 28, fontWeight: 800, color: palette.text,
              opacity: 0.9, letterSpacing: '-1px', lineHeight: 1,
            }}>
              {initials}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: palette.text, opacity: 0.7 }}>
                <path d={modeIconPath} stroke={palette.text} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <MaturityBadge state={trip.maturity_state || 'DRAFT'} />
            </div>
          </div>
        </Link>
      )}

      <div style={{ padding: '14px 18px 16px' }}>
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/trips/${trip.trip_id}`} style={{ textDecoration: 'none' }}>
                {trip.destination_summary && (
                  <p style={{ fontSize: 13, color: '#475569', margin: '0 0 4px', fontWeight: 500 }}>{trip.destination_summary}</p>
                )}
                {dateRange && (
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{dateRange}</p>
                )}
              </Link>
            </div>
            {countdownBlock}
          </div>
        ) : (
          <Link href={`/trips/${trip.trip_id}`} style={{ textDecoration: 'none' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 3px', lineHeight: 1.3, letterSpacing: '-0.2px' }}>
              {safeTripName}
            </p>
            {trip.destination_summary && (
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 3px' }}>{trip.destination_summary}</p>
            )}
            {dateRange && (
              <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 12px' }}>{dateRange}</p>
            )}
          </Link>
        )}

        {isMobile ? (
          <TripCardWeather destination={trip.destination_summary} unit={tempUnit} />
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {trip.policy_count > 0 && (
            <span style={{
              fontSize: 11, color: '#555', background: '#f5f5f5',
              border: '1px solid #e8e8e8', borderRadius: 20, padding: '3px 9px',
            }}>
              {trip.policy_count} {trip.policy_count === 1 ? 'policy' : 'policies'}
            </span>
          )}

          {hasOpenIncident ? (
            <Link
              href={`/trips/${trip.trip_id}/incidents/${trip.latest_open_incident_id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ textDecoration: 'none' }}
            >
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#c2410c',
                background: '#fff7ed', border: '1px solid #fdba74',
                borderRadius: 20, padding: '3px 9px',
                cursor: 'pointer',
              }}>
                Resume incident
              </span>
            </Link>
          ) : (
            <span style={{
              fontSize: 11, color: trip.paid_unlock ? '#16a34a' : '#bbb',
              fontWeight: trip.paid_unlock ? 500 : 400,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {trip.paid_unlock ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                  </svg>
                  Unlocked
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="#ccc" strokeWidth="1.8"/>
                    <path d="M8 11V7a4 4 0 018 0v4" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Free plan
                </>
              )}
            </span>
          )}

          {trip.maturity_state === 'DRAFT' && (
            <Link
              href={`/trips/${trip.trip_id}/draft`}
              onClick={(e) => e.stopPropagation()}
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '10px 14px' : '7px 12px',
                minHeight: isMobile ? 44 : undefined,
                borderRadius: 999,
                border: '1px solid #bfdbfe',
                background: '#eff4fc',
                color: '#2E5FA3',
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              Continue planning
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: '#f0f4ff', border: '1px solid #dbeafe',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#2E5FA3" strokeWidth="1.7" fill="none"/>
          <circle cx="12" cy="9" r="2.5" fill="#2E5FA3"/>
        </svg>
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        You haven&apos;t planned any trips yet.
      </p>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 340, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        When you add a trip, your coverage analysis and incident history will appear here.
      </p>
      <Link href="/trips/new" style={{
        padding: '10px 22px', background: '#1A2B4A', color: 'white',
        borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        Plan your first trip
      </Link>
    </div>
  );
}

interface ArchivedTrip {
  trip_id: string;
  trip_name: string;
  destination_summary?: string;
  archived_at: string;
}

export default function TripsPage() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [trips, setTrips] = useState<TripWithStats[]>([]);
  const [archivedTrips, setArchivedTrips] = useState<ArchivedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreatorSearch, setShowCreatorSearch] = useState(false);

  const tempUnit: 'F' | 'C' =
    (profile?.preferences as Record<string, unknown> | undefined)?.temperature_unit === 'C' ? 'C' : 'F';

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('trips')
        .select('trip_id, trip_name, maturity_state, departure_date, return_date, paid_unlock, destination_summary, travel_mode_primary, created_at')
        .eq('account_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('trips')
        .select('trip_id, trip_name, destination_summary, archived_at')
        .eq('account_id', user.id)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false }),
      supabase
        .from('policies')
        .select('trip_id')
        .eq('account_id', user.id),
      supabase
        .from('incidents')
        .select('id, trip_id, canonical_status, created_at')
        .not('canonical_status', 'in', '(CLOSED,SUBMITTED)')
        .order('created_at', { ascending: false }),
    ]).then(([tripsRes, archivedRes, policiesRes, incRes]) => {
      const tripsData = tripsRes.data || [];
      const policies = policiesRes.data || [];
      const incidents = incRes.data || [];

      const policyCountMap: Record<string, number> = {};
      for (const p of policies) {
        policyCountMap[p.trip_id] = (policyCountMap[p.trip_id] || 0) + 1;
      }

      const incidentCountMap: Record<string, number> = {};
      const latestIncidentMap: Record<string, string> = {};
      for (const inc of incidents) {
        incidentCountMap[inc.trip_id] = (incidentCountMap[inc.trip_id] || 0) + 1;
        if (!latestIncidentMap[inc.trip_id]) {
          latestIncidentMap[inc.trip_id] = inc.id;
        }
      }

      const enriched: TripWithStats[] = tripsData.map((t) => ({
        ...t,
        policy_count: policyCountMap[t.trip_id] || 0,
        open_incident_count: incidentCountMap[t.trip_id] || 0,
        latest_open_incident_id: latestIncidentMap[t.trip_id] || null,
      }));

      setTrips(enriched);
      setArchivedTrips(archivedRes.data || []);
      setLoading(false);
    }).catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user]);

  const context = !loading && trips.length > 0 ? tripContextLine(trips) : null;
  const firstName = firstNameFromProfile(profile?.display_name, user?.email);

  const quickActionCard = (
    label: string,
    icon: ReactNode,
    onClick?: () => void,
    href?: string,
  ) => {
    const inner = (
      <>
        <div style={{ marginBottom: 8 }}>{icon}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', textAlign: 'center', lineHeight: 1.25 }}>{label}</span>
      </>
    );
    const shellStyle: CSSProperties = {
      minWidth: 120,
      maxWidth: 140,
      minHeight: 88,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 10px',
      background: 'white',
      border: '0.5px solid #e5e7eb',
      borderRadius: 12,
      boxSizing: 'border-box',
      cursor: 'pointer',
      textDecoration: 'none',
      color: 'inherit',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    };
    if (href) {
      return (
        <Link href={href} style={shellStyle}>
          {inner}
        </Link>
      );
    }
    return (
      <button type="button" onClick={onClick} style={{ ...shellStyle, font: 'inherit' }}>
        {inner}
      </button>
    );
  };

  return (
    <div
      style={{
        ...(isMobile ? mobileStyles.appContentMobile : isTablet ? tabletStyles.appContent : {}),
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <Suspense>
        <WelcomeBanner />
      </Suspense>

      {!loading && trips.length > 0 ? (
        <div style={{ marginBottom: isMobile ? 18 : 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <p style={{ margin: '0 0 6px', fontSize: isMobile ? 22 : 20, fontWeight: 700, color: '#1A2B4A', letterSpacing: '-0.3px' }}>
            {greetingForHour()}, {firstName}
          </p>
          {context ? (
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>{context.text}</p>
          ) : null}
        </div>
      ) : null}

      {isMobile ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 6,
            marginBottom: 18,
            marginLeft: isMobile ? -4 : undefined,
            marginRight: isMobile ? -4 : undefined,
          }}
        >
          {quickActionCard(
            'New trip',
            <span style={{ fontSize: 22, fontWeight: 700, color: '#2E5FA3' }}>+</span>,
            undefined,
            '/trips/new',
          )}
          {quickActionCard(
            'Upload policy',
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#2E5FA3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            undefined,
            '/policies/upload',
          )}
          {quickActionCard(
            'Discover',
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#2E5FA3" strokeWidth="1.7"/><path d="M20 20l-3-3" stroke="#2E5FA3" strokeWidth="1.7" strokeLinecap="round"/></svg>,
            () => setShowCreatorSearch(true),
          )}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#1A2B4A', margin: 0, letterSpacing: '-0.4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Your trips
        </h1>
        {!isMobile ? (
          <Link href="/trips/new" style={{
            padding: '9px 18px', background: '#1A2B4A', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
          }}>
            Plan a trip
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {trips.map((trip) => (
            <TripCard key={trip.trip_id} trip={trip} isMobile={isMobile} tempUnit={tempUnit} />
          ))}
        </div>
      )}

      {!loading && trips.length > 0 && isMobile ? (
        <Link
          href="/trips/new"
          style={{
            ...mobileStyles.actionButton,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            marginTop: 20,
          }}
        >
          Create new trip
        </Link>
      ) : null}

      {!loading && archivedTrips.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 0 10px', marginBottom: 2,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Archived ({archivedTrips.length})
            </span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ transition: 'transform 0.2s ease', transform: showArchived ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9l6 6 6-6" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {archivedTrips.map((trip) => (
                <Link key={trip.trip_id} href={`/trips/${trip.trip_id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', border: '0.5px solid #efefef',
                    borderRadius: 10, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    opacity: 0.7,
                  }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#555', margin: '0 0 2px' }}>
                        {trip.trip_name}
                      </p>
                      {trip.destination_summary && (
                        <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>{trip.destination_summary}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: '#aaa',
                        background: '#f5f5f5', border: '1px solid #e0e0e0',
                        borderRadius: 20, padding: '2px 8px',
                      }}>
                        Archived
                      </span>
                      <p style={{ fontSize: 11, color: '#ccc', margin: '3px 0 0' }}>
                        {new Date(trip.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              <p style={{ fontSize: 11, color: '#ccc', margin: '4px 2px 0', lineHeight: 1.5, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Archived trips are retained for a jurisdiction-specific period before permanent deletion.{' '}
                <Link href="/account/trust-safety" style={{ color: '#aaa', textDecoration: 'underline' }}>
                  View data retention policy
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {showCreatorSearch ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 260,
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Discover travel ideas"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2B4A' }}>Discover</p>
            <button
              type="button"
              onClick={() => setShowCreatorSearch(false)}
              style={{
                minWidth: 48,
                minHeight: 48,
                border: 'none',
                background: '#f3f4f6',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#334155',
                padding: '0 12px',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px 100px', boxSizing: 'border-box' }}>
            <CreatorSearchPanel />
          </div>
        </div>
      ) : null}
    </div>
  );
}
