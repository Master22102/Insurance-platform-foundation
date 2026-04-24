'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const EVENT_LABELS: Record<string, string> = {
  trip_maturity_advanced: 'Trip progressed',
  coverage_alignment_confirmed: 'Coverage confirmed',
  policy_attached: 'Policy added',
  policy_version_created: 'Policy processed',
  incident_created: 'Incident reported',
  readiness_confirmed: 'Trip readiness confirmed',
  deep_scan_completed: 'Deep Scan complete',
  deep_scan_initiated: 'Deep Scan started',
  clause_timer_elapsed: 'Deadline elapsed',
  disruption_option_selected: 'Option selected',
  claim_packet_created: 'Claim packet created',
  live_options_mock_populated: 'Mock options loaded',
  readiness_item_change: 'Readiness item updated',
  trip_created: 'Trip created',
  route_segment_added: 'Route segment added',
};

const CATEGORY_FILTERS = ['All', 'Trip', 'Coverage', 'Incidents', 'Readiness'];

function categorize(event_type: string): string {
  if (['trip_maturity_advanced', 'trip_created', 'route_segment_added', 'deep_scan_completed', 'deep_scan_initiated'].includes(event_type)) return 'Trip';
  if (['coverage_alignment_confirmed', 'policy_attached', 'policy_version_created'].includes(event_type)) return 'Coverage';
  if (['incident_created', 'disruption_option_selected', 'claim_packet_created', 'clause_timer_elapsed', 'live_options_mock_populated'].includes(event_type)) return 'Incidents';
  if (['readiness_confirmed', 'readiness_item_change'].includes(event_type)) return 'Readiness';
  return 'Trip';
}

interface TimelineEvent {
  id: string;
  event_type: string;
  event_data: any;
  created_at: string;
}

export default function TripHistoryPage() {
  const { trip_id } = useParams<{ trip_id: string }>();
  const { user } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !trip_id) return;
    (async () => {
      const { data } = await supabase
        .from('event_logs')
        .select('*')
        .eq('related_entity_type', 'trip')
        .eq('related_entity_id', trip_id)
        .order('created_at', { ascending: false })
        .limit(100);
      setEvents((data || []) as TimelineEvent[]);
      setLoading(false);
    })();
  }, [user, trip_id]);

  const filtered = filter === 'All'
    ? events
    : events.filter((e) => categorize(e.event_type) === filter);

  return (
    <div style={{ maxWidth: 680, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to trip
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>Trip history</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
        Timeline of changes and activity for this trip.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: filter === cat ? '#eff4fc' : 'white',
              border: filter === cat ? '1.5px solid #2E5FA3' : '1px solid #e2e8f0',
              color: filter === cat ? '#2E5FA3' : '#64748b',
              cursor: 'pointer', transition: 'all 0.12s ease',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Loading history...</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'white', borderRadius: 12, border: '0.5px solid #e8e8e8' }}>
          <p style={{ fontSize: 14, color: '#555', margin: 0 }}>
            {events.length === 0 ? 'No history yet.' : 'No events in this category.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Timeline rail */}
          <div style={{ width: 2, background: '#e2e8f0', borderRadius: 1, flexShrink: 0 }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((ev) => {
              const label = EVENT_LABELS[ev.event_type] || ev.event_type.replace(/_/g, ' ');
              const detail = ev.event_data?.summary || ev.event_data?.description ||
                ev.event_data?.state || ev.event_data?.name || '';
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: 'white', border: '0.5px solid #e8e8e8',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{label}</p>
                    <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                  {detail && (
                    <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0', lineHeight: 1.5 }}>{detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
