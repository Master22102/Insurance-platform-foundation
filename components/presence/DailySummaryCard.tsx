'use client';

import { useMemo, type CSSProperties } from 'react';

export type TimelineEntry = { id: string; at: string; label: string };

export default function DailySummaryCard({
  timeline,
  suppressedLines,
  onKeep,
  onStopForTrip,
}: {
  timeline: TimelineEntry[];
  suppressedLines: string[];
  onKeep: (id: string) => void;
  onStopForTrip: (id: string) => void;
}) {
  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  return (
    <div
      data-testid="presence-daily-summary-card"
      style={{
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        padding: '14px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#334155', letterSpacing: '0.05em' }}>
        DAILY TRAVEL SUMMARY
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
        Times shown in your device timezone. Suppressed alerts are rolled up here to reduce fatigue.
      </p>

      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Locations & pings</p>
      <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#475569' }}>
        {timeline.length === 0 ? <li>No location samples yet today.</li> : null}
        {timeline.map((t) => (
          <li key={t.id} style={{ marginBottom: 4 }}>
            <strong>{fmt.format(new Date(t.at))}</strong> — {t.label}
          </li>
        ))}
      </ul>

      {suppressedLines.length > 0 ? (
        <>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Suppressed alerts</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: '#475569' }}>
            {suppressedLines.map((line, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                <div>{line}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={() => onKeep(`sup-${i}`)} style={miniBtn}>
                    Keep notifying
                  </button>
                  <button type="button" onClick={() => onStopForTrip(`sup-${i}`)} style={miniBtn}>
                    Stop for this trip
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
        Saved to trip log for documentation — correlate with incidents and claims if needed.
      </p>
    </div>
  );
}

const miniBtn: CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: 'white',
  cursor: 'pointer',
};
