'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useIsMobile';
import { mobileStyles, tabletStyles } from '@/lib/styles/responsive';

const CLAIM_STATUSES = ['CLAIM_ROUTING_READY', 'SUBMITTED', 'DISPUTED'];

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string; description: string }> = {
  CLAIM_ROUTING_READY: {
    bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a',
    label: 'Routing ready',
    description: 'This incident record is ready for your next filing step. Open it to review options.',
  },
  SUBMITTED: {
    bg: '#eff4fc', border: '#bfdbfe', text: '#2E5FA3',
    label: 'Routing recorded',
    description: 'Claim routing was recorded. Keep documentation on file and confirm submission with the provider.',
  },
  DISPUTED: {
    bg: '#fef2f2', border: '#fecaca', text: '#dc2626',
    label: 'Disputed',
    description: 'This claim is under dispute. Continue to gather evidence.',
  },
};

const DISRUPTION_LABELS: Record<string, string> = {
  flight_delay: 'Flight delay',
  flight_cancellation: 'Flight cancellation',
  missed_connection: 'Missed connection',
  denied_boarding: 'Denied boarding',
  baggage_issue: 'Baggage issue',
  other: 'Other',
};

interface ClaimIncident {
  id: string;
  trip_id: string;
  trip_name: string;
  destination_summary: string | null;
  title: string;
  canonical_status: string;
  disruption_type: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
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

export default function ClaimsPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [incidents, setIncidents] = useState<ClaimIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    Promise.all([
      supabase
        .from('trips')
        .select('trip_id, trip_name, destination_summary')
        .eq('account_id', user.id)
        .is('archived_at', null),
      supabase
        .from('incidents')
        .select('id, trip_id, title, canonical_status, disruption_type, created_at')
        .in('canonical_status', CLAIM_STATUSES)
        .order('created_at', { ascending: false }),
    ]).then(([tripsRes, incRes]) => {
      const trips = tripsRes.data || [];
      const incs = incRes.data || [];

      const tripMap: Record<string, { trip_name: string; destination_summary: string | null }> = {};
      for (const t of trips) {
        tripMap[t.trip_id] = { trip_name: t.trip_name, destination_summary: t.destination_summary };
      }

      const enriched: ClaimIncident[] = incs
        .filter((inc) => tripMap[inc.trip_id])
        .map((inc) => ({
          ...inc,
          trip_name: tripMap[inc.trip_id]?.trip_name || 'Unknown trip',
          destination_summary: tripMap[inc.trip_id]?.destination_summary || null,
        }));

      setIncidents(enriched);
      setLoading(false);
    }).catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user]);

  const ready = incidents.filter((i) => i.canonical_status === 'CLAIM_ROUTING_READY');
  const submitted = incidents.filter((i) => i.canonical_status === 'SUBMITTED');
  const disputed = incidents.filter((i) => i.canonical_status === 'DISPUTED');

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...(isMobile ? mobileStyles.appContentMobile : isTablet ? tabletStyles.appContent : { padding: '0 0 32px' }),
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
          Claims
        </h1>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
          Incidents ready for filing, with routing recorded, or in dispute
        </p>
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
      ) : incidents.length === 0 ? (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
              No claims yet
            </p>
            <p style={{ fontSize: 14, color: '#888', margin: '0 0 20px', lineHeight: 1.6, maxWidth: 380 }}>
              When an incident gathers enough evidence, it moves here for claim routing. The path is: report an incident, document it, and the system will guide you on what to file.
            </p>
            <Link
              href="/incidents"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 48,
                padding: '12px 22px',
                background: '#1A2B4A',
                color: 'white',
                borderRadius: 10,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            >
              View your incidents
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
              marginTop: 8,
            }}
          >
            {[
              { step: '1', title: 'Report an incident', desc: 'Start from a trip page when something goes wrong.' },
              { step: '2', title: 'Document it', desc: 'Add narration, upload receipts, and gather evidence.' },
              { step: '3', title: 'Route your claim', desc: 'When ready, route the incident to the right insurer or carrier.' },
            ].map((s) => (
              <div key={s.step} style={{
                background: 'white', border: '0.5px solid #e8e8e8',
                borderRadius: 12, padding: '18px 20px',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#eff4fc', border: '1px solid #dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#2E5FA3', marginBottom: 12,
                }}>
                  {s.step}
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 6px' }}>{s.title}</p>
                <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {ready.length > 0 && (
            <ClaimSection title="Ready to route" count={ready.length} incidents={ready} accent="#16a34a" />
          )}
          {submitted.length > 0 && (
            <ClaimSection title="Submitted" count={submitted.length} incidents={submitted} accent="#2E5FA3" />
          )}
          {disputed.length > 0 && (
            <ClaimSection title="Disputed" count={disputed.length} incidents={disputed} accent="#dc2626" />
          )}
        </div>
      )}
    </div>
  );
}

function ClaimSection({ title, count, incidents, accent }: { title: string; count: number; incidents: ClaimIncident[]; accent: string }) {
  const isMobile = useIsMobile();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{title}</p>
        <span style={{
          fontSize: 11, fontWeight: 600, color: accent,
          background: accent + '18', border: `1px solid ${accent}44`,
          borderRadius: 20, padding: '2px 8px',
        }}>
          {count}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {incidents.map((inc) => {
          const cfg = STATUS_CONFIG[inc.canonical_status];
          return (
            <Link key={inc.id} href={`/trips/${inc.trip_id}/incidents/${inc.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white', border: '0.5px solid #e8e8e8',
                  borderRadius: 10, padding: '16px 18px',
                  minHeight: isMobile ? 56 : undefined,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 3px' }}>
                    {inc.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>{inc.trip_name}</span>
                    {inc.destination_summary && (
                      <span style={{ fontSize: 12, color: '#bbb' }}>{inc.destination_summary}</span>
                    )}
                    {inc.disruption_type && (
                      <span style={{
                        fontSize: 11, color: '#999', background: '#f5f5f5',
                        border: '1px solid #eee', borderRadius: 20, padding: '2px 7px',
                      }}>
                        {DISRUPTION_LABELS[inc.disruption_type] || inc.disruption_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  {cfg && (
                    <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0', lineHeight: 1.4 }}>
                      {cfg.description}
                    </p>
                  )}
                </div>
                <StatusBadge status={inc.canonical_status} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
