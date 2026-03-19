'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  OPEN:                  { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3' },
  EVIDENCE_GATHERING:    { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  REVIEW_PENDING:        { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  CLAIM_ROUTING_READY:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
  SUBMITTED:             { bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3' },
  CLOSED:                { bg: '#f5f5f5', border: '#e0e0e0', text: '#777' },
  DISPUTED:              { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
};

const DISRUPTION_LABELS: Record<string, string> = {
  flight_delay: 'Flight delay',
  flight_cancellation: 'Flight cancellation',
  missed_connection: 'Missed connection',
  denied_boarding: 'Denied boarding',
  baggage_issue: 'Baggage issue',
  other: 'Other',
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.OPEN;
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: cfg.text,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

interface TripGroup {
  trip_id: string;
  trip_name: string;
  destination_summary: string | null;
  incidents: any[];
}

export default function IncidentsPage() {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<TripGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('trips')
        .select('trip_id, trip_name, destination_summary')
        .eq('account_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('incidents')
        .select('id, trip_id, title, canonical_status, disruption_type, created_at')
        .order('created_at', { ascending: false }),
    ]).then(([tripsRes, incRes]) => {
      const trips = tripsRes.data || [];
      const incidents = incRes.data || [];

      const tripMap: Record<string, TripGroup> = {};
      for (const t of trips) {
        tripMap[t.trip_id] = { ...t, incidents: [] };
      }
      for (const inc of incidents) {
        if (tripMap[inc.trip_id]) {
          tripMap[inc.trip_id].incidents.push(inc);
        }
      }

      setGrouped(Object.values(tripMap).filter((t) => t.incidents.length > 0));
      setLoading(false);
    }).catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user]);

  const totalIncidents = grouped.reduce((s, t) => s + t.incidents.length, 0);

  const filterFn = (inc: any) => {
    if (filter === 'active') return !['CLOSED', 'SUBMITTED'].includes(inc.canonical_status);
    if (filter === 'closed') return ['CLOSED', 'SUBMITTED'].includes(inc.canonical_status);
    return true;
  };

  const visibleGroups = grouped
    .map((t) => ({ ...t, incidents: t.incidents.filter(filterFn) }))
    .filter((t) => t.incidents.length > 0);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
            Incidents
          </h1>
          {!loading && (
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              {totalIncidents === 0
                ? 'No incidents recorded yet'
                : `${totalIncidents} incident${totalIncidents !== 1 ? 's' : ''} across ${grouped.length} trip${grouped.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>

      {!loading && totalIncidents > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {(['all', 'active', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                background: filter === f ? '#1A2B4A' : 'white',
                color: filter === f ? 'white' : '#555',
                border: `1px solid ${filter === f ? '#1A2B4A' : '#e5e7eb'}`,
                borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', textTransform: 'capitalize',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div style={{
            width: 28, height: 28, border: '2.5px solid #e5e5e5',
            borderTopColor: '#1A2B4A', borderRadius: '50%',
            margin: '0 auto', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : totalIncidents === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 0', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#f0f4ff', border: '1px solid #dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#2E5FA3" strokeWidth="1.7" fill="none"/>
              <path d="M9 12l2 2 4-4" stroke="#2E5FA3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
            No incidents yet
          </p>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 360 }}>
            If something goes wrong on a trip, report it from the trip page. Your full incident history across all trips will appear here.
          </p>
          <Link href="/trips" style={{
            padding: '10px 22px', background: '#1A2B4A', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            View your trips
          </Link>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>No incidents match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {visibleGroups.map((group) => (
            <div key={group.trip_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <Link href={`/trips/${group.trip_id}`} style={{ textDecoration: 'none' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
                    {group.trip_name}
                  </p>
                </Link>
                {group.destination_summary && (
                  <span style={{ fontSize: 12, color: '#aaa' }}>{group.destination_summary}</span>
                )}
                <span style={{
                  marginLeft: 'auto', fontSize: 11, color: '#888',
                  background: '#f5f5f5', border: '1px solid #e8e8e8',
                  borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
                }}>
                  {group.incidents.length} incident{group.incidents.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.incidents.map((inc) => (
                  <Link key={inc.id} href={`/trips/${group.trip_id}/incidents/${inc.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        background: 'white', border: '0.5px solid #e8e8e8',
                        borderRadius: 10, padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px', lineHeight: 1.3 }}>
                          {inc.title}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {inc.disruption_type && (
                            <span style={{
                              fontSize: 11, color: '#999', background: '#f5f5f5',
                              border: '1px solid #eee', borderRadius: 20, padding: '2px 7px',
                            }}>
                              {DISRUPTION_LABELS[inc.disruption_type] || inc.disruption_type.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: '#ccc' }}>
                            {new Date(inc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={inc.canonical_status || 'OPEN'} />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
