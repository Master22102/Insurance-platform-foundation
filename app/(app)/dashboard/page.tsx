'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { loadRightNowState, RightNowState, LocationCertainty } from '@/lib/context-engine';

function PresenceBadge({ certainty, label, updatedAt }: { certainty: LocationCertainty; label: string; updatedAt: string | null }) {
  const styles: Record<LocationCertainty, { bg: string; border: string; fg: string }> = {
    confirmed:   { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534' },
    likely:      { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af' },
    approximate: { bg: '#fef9f0', border: '#fde68a', fg: '#92400e' },
    unknown:     { bg: '#f7f8fa', border: '#e5e7eb', fg: '#555' },
  };
  const s = styles[certainty];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.fg }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: s.fg }}>{label}</span>
      {updatedAt && (
        <span style={{ fontSize: 11, color: s.fg, opacity: 0.7 }}>
          · {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<RightNowState | null>(null);

  useEffect(() => {
    if (!user) return;
    loadRightNowState(supabase, user.id).then(setState);
  }, [user]);

  if (!state) {
    return (
      <div style={{ maxWidth: 780, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#888' }}>Loading Right Now…</p>
      </div>
    );
  }

  const { anchor, signal_profile, active_trip, presence, recommended_next } = state;

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: '#888', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Right Now</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A2B4A', margin: '4px 0 0', letterSpacing: '-0.4px' }}>
          {active_trip ? active_trip.trip_name : 'Your travel shield'}
        </h1>
        <div style={{ marginTop: 10 }}>
          <PresenceBadge certainty={presence.certainty} label={presence.display_label} updatedAt={presence.updated_at} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 11, color: '#888', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Anchor state</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '6px 0 0' }}>
            {anchor.path ? anchor.path.replace(/_/g, ' ') : 'Not anchored'}
          </p>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
            {anchor.first_anchored_at ? `Since ${new Date(anchor.first_anchored_at).toLocaleDateString()}` : 'Plan a trip to anchor.'}
          </p>
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 11, color: '#888', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Signal profile</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '6px 0 0' }}>
            {signal_profile.confirmed ? 'Confirmed' : signal_profile.version_id ? 'Awaiting confirmation' : 'Not started'}
          </p>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
            {signal_profile.confirmed ? 'Preferences locked.' : 'Tell us what you care about.'}
          </p>
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 11, color: '#888', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Active trip</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '6px 0 0' }}>
            {active_trip ? (active_trip.destination_summary || active_trip.trip_name) : 'None'}
          </p>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
            {active_trip?.departure_date ? `Departs ${new Date(active_trip.departure_date).toLocaleDateString()}` : 'No upcoming departure.'}
          </p>
        </div>
      </div>

      <Link
        href={recommended_next.href}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: '#1A2B4A', color: 'white',
          borderRadius: 12, textDecoration: 'none', marginBottom: 16,
        }}
      >
        <div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Next step</p>
          <p style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 0' }}>{recommended_next.label}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {[
          { href: '/trips', label: 'Trips' },
          { href: '/scan', label: 'Quick Scan' },
          { href: '/deep-scan', label: 'Deep Scan' },
          { href: '/claims', label: 'Claims' },
          { href: '/account', label: 'Account' },
        ].map((l) => (
          <Link key={l.href} href={l.href} style={{ padding: '12px 14px', background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, textDecoration: 'none', color: '#1A2B4A', fontSize: 14, fontWeight: 600 }}>
            {l.label}
          </Link>
        ))}
      </div>

      {presence.certainty === 'approximate' && (
        <p style={{ fontSize: 11, color: '#aaa', margin: '16px 0 0', lineHeight: 1.55 }}>
          Location is inferred from your network. Never rendered as confirmed until GPS accuracy is within 50 meters.
        </p>
      )}
    </div>
  );
}
