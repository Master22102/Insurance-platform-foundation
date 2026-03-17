'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const TRAVEL_MODE_ICONS: Record<string, React.ReactNode> = {
  air: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  rail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="2" width="14" height="17" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 13h14M9 19l-2 3M15 19l2 3M9 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  sea: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 17c2 0 2-1.5 4-1.5S9 17 11 17s2-1.5 4-1.5S17 17 21 17M12 3v9M8 8l4-5 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  road: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  mixed: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

interface TripCoverage {
  trip_id: string;
  trip_name: string;
  destination_summary: string | null;
  departure_date: string | null;
  return_date: string | null;
  travel_mode_primary: string | null;
  paid_unlock: boolean;
  maturity_state: string;
  policy_count: number;
  open_incident_count: number;
}

function formatDateRange(departure?: string | null, returnDate?: string | null) {
  if (!departure && !returnDate) return null;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (departure && returnDate) return `${fmt(departure)} – ${fmt(returnDate)}`;
  if (departure) return `Departs ${fmt(departure)}`;
  return null;
}

function isTripActive(trip: TripCoverage) {
  const now = Date.now();
  if (trip.return_date && new Date(trip.return_date).getTime() < now - 86400000 * 7) return false;
  if (trip.maturity_state === 'ARCHIVED') return false;
  return true;
}

export default function CoveragePage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase
        .from('trips')
        .select('trip_id, trip_name, destination_summary, departure_date, return_date, travel_mode_primary, paid_unlock, maturity_state')
        .eq('account_id', user.id)
        .is('archived_at', null)
        .order('departure_date', { ascending: true }),
      supabase
        .from('policies')
        .select('trip_id')
        .eq('account_id', user.id),
      supabase
        .from('incidents')
        .select('trip_id, canonical_status')
        .not('canonical_status', 'in', '(CLOSED,SUBMITTED)'),
    ]).then(([tripsRes, policiesRes, incRes]) => {
      const tripsData = tripsRes.data || [];
      const policies = policiesRes.data || [];
      const incidents = incRes.data || [];

      const policyCountMap: Record<string, number> = {};
      for (const p of policies) {
        policyCountMap[p.trip_id] = (policyCountMap[p.trip_id] || 0) + 1;
      }
      const incidentCountMap: Record<string, number> = {};
      for (const inc of incidents) {
        incidentCountMap[inc.trip_id] = (incidentCountMap[inc.trip_id] || 0) + 1;
      }

      const enriched: TripCoverage[] = tripsData.map((t) => ({
        ...t,
        policy_count: policyCountMap[t.trip_id] || 0,
        open_incident_count: incidentCountMap[t.trip_id] || 0,
      }));

      setTrips(enriched);
      setLoading(false);
    });.catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user]);

  const activeTrips = trips.filter(isTripActive);
  const pastTrips = trips.filter((t) => !isTripActive(t));

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
            Coverage
          </h1>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            Your travel coverage, organized by trip
          </p>
        </div>
        <Link href="/policies/upload" style={{
          padding: '9px 18px', background: '#1A2B4A', color: 'white',
          borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
        }}>
          Upload a policy
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div style={{
            width: 28, height: 28, border: '2.5px solid #e5e5e5',
            borderTopColor: '#1A2B4A', borderRadius: '50%',
            margin: '0 auto', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : trips.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 0', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#f0f4ff', border: '1px solid #dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#2E5FA3" strokeWidth="1.7" fill="none"/>
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
            No trips yet
          </p>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 360 }}>
            Add a trip and upload your insurance policies to see your coverage analysis here.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/trips/new" style={{
              padding: '10px 22px', background: '#1A2B4A', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
            }}>
              Plan a trip
            </Link>
            <Link href="/policies/upload" style={{
              padding: '10px 22px', background: 'white', color: '#1A2B4A',
              border: '1px solid #e5e7eb',
              borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
            }}>
              Upload a policy
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {activeTrips.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>
                Active & upcoming
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeTrips.map((trip) => (
                  <TripCoverageCard key={trip.trip_id} trip={trip} />
                ))}
              </div>
            </div>
          )}
          {pastTrips.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>
                Past trips
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pastTrips.map((trip) => (
                  <TripCoverageCard key={trip.trip_id} trip={trip} isPast />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TripCoverageCard({ trip, isPast }: { trip: TripCoverage; isPast?: boolean }) {
  const dateRange = formatDateRange(trip.departure_date, trip.return_date);
  const mode = trip.travel_mode_primary || 'air';

  return (
    <Link href={`/trips/${trip.trip_id}?tab=Coverage`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
          opacity: isPast ? 0.75 : 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: '#f0f4ff', border: '1px solid #dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: '#2E5FA3',
        }}>
          {TRAVEL_MODE_ICONS[mode] || TRAVEL_MODE_ICONS.air}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 3px', lineHeight: 1.3 }}>
            {trip.trip_name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {trip.destination_summary && (
              <span style={{ fontSize: 12, color: '#666' }}>{trip.destination_summary}</span>
            )}
            {dateRange && (
              <span style={{ fontSize: 12, color: '#aaa' }}>{dateRange}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {trip.open_incident_count > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#c2410c',
              background: '#fff7ed', border: '1px solid #fdba74',
              borderRadius: 20, padding: '3px 9px',
            }}>
              {trip.open_incident_count} open
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>
              {trip.policy_count}
            </p>
            <p style={{ fontSize: 10, color: '#aaa', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {trip.policy_count === 1 ? 'policy' : 'policies'}
            </p>
          </div>
          {trip.paid_unlock ? (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#f5f5f5', border: '1px solid #e5e5e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" stroke="#bbb" strokeWidth="1.8"/>
                <path d="M8 11V7a4 4 0 018 0v4" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}
