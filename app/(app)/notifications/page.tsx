'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const RELEVANT_EVENTS = [
  'coverage_change', 'readiness_item_change', 'trip_maturity_advanced',
  'disruption_detected', 'claim_status_change', 'clause_timer_elapsed',
  'live_options_mock_populated', 'live_options_populated',
  'incident_created', 'disruption_option_selected', 'readiness_confirmed',
  'policy_version_created', 'deep_scan_completed',
];

const EVENT_DISPLAY: Record<string, { icon: string; label: string }> = {
  coverage_change:         { icon: '🛡', label: 'Coverage updated' },
  readiness_item_change:   { icon: '✓', label: 'Readiness item changed' },
  trip_maturity_advanced:  { icon: '→', label: 'Trip progressed' },
  disruption_detected:     { icon: '!', label: 'Disruption detected' },
  claim_status_change:     { icon: '📄', label: 'Claim status changed' },
  clause_timer_elapsed:    { icon: '⏱', label: 'Deadline elapsed' },
  incident_created:        { icon: '⚠', label: 'Incident reported' },
  disruption_option_selected: { icon: '✓', label: 'Option selected' },
  readiness_confirmed:     { icon: '✓', label: 'Readiness confirmed' },
  policy_version_created:  { icon: '📋', label: 'Policy processed' },
  deep_scan_completed:     { icon: '🔍', label: 'Deep Scan complete' },
};

interface EventRow {
  id: string;
  event_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  event_data: any;
  created_at: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('event_logs')
        .select('*')
        .eq('actor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      const filtered = (data || []).filter((e: any) => RELEVANT_EVENTS.includes(e.event_type));
      setEvents(filtered as EventRow[]);
      setLoading(false);
    })();
  }, [user]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ maxWidth: 680, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>Notifications</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px' }}>
        Recent activity across your trips and incidents.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Loading...</p>
      ) : events.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', background: 'white',
          borderRadius: 12, border: '0.5px solid #e8e8e8',
        }}>
          <p style={{ fontSize: 32, margin: '0 0 10px', opacity: 0.3 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ display: 'inline' }}>
              <path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </p>
          <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px' }}>No notifications yet</p>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
            Activity will appear here when something needs your attention.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.map((ev) => {
            const display = EVENT_DISPLAY[ev.event_type] || { icon: '·', label: ev.event_type.replace(/_/g, ' ') };
            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px', borderRadius: 10,
                  background: 'white', border: '0.5px solid #e8e8e8',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#eff4fc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  {display.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>
                    {display.label}
                  </p>
                  {ev.event_data && typeof ev.event_data === 'object' && (
                    <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0', lineHeight: 1.5 }}>
                      {ev.event_data.summary || ev.event_data.description ||
                        (ev.related_entity_type ? `${ev.related_entity_type}: ${ev.related_entity_id?.slice(0, 8)}...` : '')}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {timeAgo(ev.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
