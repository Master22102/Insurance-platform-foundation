'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';

export default function MissedConnectionAlert({
  airportLabel,
  distanceKm,
  driveMinutes,
  minutesToDepart,
  coverageSummary,
  tripId,
  onDismiss,
  onSnooze,
  onOpenSettings,
}: {
  airportLabel: string;
  distanceKm: number;
  driveMinutes: number;
  minutesToDepart: number;
  coverageSummary?: string | null;
  tripId: string;
  onDismiss: () => void;
  onSnooze: (mode: '2h' | 'rest_of_day' | 'trip') => void;
  onOpenSettings: () => void;
}) {
  return (
    <div
      data-testid="presence-missed-connection-alert"
      style={{
        borderRadius: 12,
        border: '1px solid #fecaca',
        overflow: 'hidden',
        background: '#fef2f2',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
          color: 'white',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>URGENT · MISSED CONNECTION RISK</p>
        <p style={{ margin: '8px 0 0', fontSize: 16, fontWeight: 800 }}>
          You may be tight for {airportLabel}
        </p>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>
          About <strong>{distanceKm} km</strong> away (~<strong>{driveMinutes} min</strong> drive at typical urban speeds). Departure in{' '}
          <strong>{minutesToDepart} min</strong> (local time).
        </p>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'white',
            border: '1px solid #fecaca',
            fontSize: 12,
            color: '#334155',
            marginBottom: 12,
          }}
        >
          <strong style={{ color: '#991b1b' }}>Coverage note:</strong> {coverageSummary}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Link
            href={`/trips/${tripId}?tab=Route`}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: '#1e3a8a',
              color: 'white',
              fontWeight: 700,
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            Call airline
          </Link>
          <Link
            href={`/trips/${tripId}/incidents/new?template=missed_connection`}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #b91c1c',
              color: '#b91c1c',
              fontWeight: 700,
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            Start documenting now
          </Link>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" onClick={onDismiss} style={btnMuted}>
            Dismiss
          </button>
          <button type="button" onClick={() => onSnooze('2h')} style={btnMuted}>
            Snooze 2h
          </button>
          <button type="button" onClick={() => onSnooze('rest_of_day')} style={btnMuted}>
            Rest of day
          </button>
          <button type="button" onClick={() => onSnooze('trip')} style={btnMuted}>
            This trip
          </button>
          <button type="button" onClick={onOpenSettings} style={btnPrimary}>
            Settings
          </button>
        </div>
        <Link href={`/trips/${tripId}?tab=Coverage`} style={{ display: 'inline-block', marginTop: 12, fontSize: 12, fontWeight: 700 }}>
          View delay / missed connection benefits →
        </Link>
      </div>
    </div>
  );
}

const btnMuted: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: 'white',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
};

const btnPrimary: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #1e3a8a',
  background: '#eff6ff',
  color: '#1e3a8a',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
};
