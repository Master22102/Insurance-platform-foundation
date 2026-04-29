'use client';

import { useMemo, useState } from 'react';
import type { PresenceUiAlert } from '@/lib/presence/alert-engine';

function badge(sev: 'critical' | 'warning' | 'info') {
  if (sev === 'critical') return { border: '#fecaca', bg: '#fef2f2', fg: '#991b1b', label: 'CRITICAL' };
  if (sev === 'warning') return { border: '#fcd34d', bg: '#fffbeb', fg: '#92400e', label: 'WARNING' };
  return { border: '#bfdbfe', bg: '#eff6ff', fg: '#1e3a8a', label: 'INFO' };
}

export default function CulturalRestrictionAlert({
  alert,
  onDismiss,
  onSnooze,
}: {
  alert: Extract<PresenceUiAlert, { kind: 'cultural_restriction' }>;
  onDismiss: () => void;
  onSnooze: (mode: '2h' | 'rest_of_day' | 'trip') => void;
}) {
  const [expanded, setExpanded] = useState(alert.severity === 'critical');
  const b = badge(alert.severity);

  const steps = useMemo(() => {
    const arr = alert.preparationSteps || [];
    return [...arr].sort((a, c) => a.step_number - c.step_number);
  }, [alert.preparationSteps]);

  return (
    <div
      data-testid="presence-cultural-restriction-alert"
      style={{
        borderRadius: 12,
        border: `1px solid ${b.border}`,
        background: b.bg,
        padding: '12px 14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: b.fg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Cultural & legal restriction
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
            <span data-testid="presence-cultural-event-name">{alert.eventName}</span>
            {alert.eventNameLocal ? <span style={{ fontWeight: 700, color: '#475569' }}> · {alert.eventNameLocal}</span> : null}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155', lineHeight: 1.55 }}>
            {alert.restrictionSummary}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
            Window: {alert.eventStart} → {alert.eventEnd} · {alert.daysUntil >= 0 ? `${alert.daysUntil} day(s) away` : 'Active / past'}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 900, color: b.fg, background: 'white', border: `1px solid ${b.border}`, padding: '3px 8px', borderRadius: 999 }}>
          {b.label}
        </span>
      </div>

      {(alert.penaltyDescription || alert.enforcementLevel) && (
        <div style={{ marginTop: 10, padding: '10px 10px', borderRadius: 10, background: 'white', border: `1px solid ${b.border}` }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: b.fg }}>Enforcement</p>
          {alert.enforcementLevel ? (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>
              <strong>Level:</strong> {alert.enforcementLevel}
            </p>
          ) : null}
          {alert.penaltyDescription ? (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>
              <strong>Penalty risk:</strong> {alert.penaltyDescription}
            </p>
          ) : null}
        </div>
      )}

      {alert.restrictionDetail ? (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
          {alert.restrictionDetail}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          marginTop: 10,
          width: '100%',
          textAlign: 'left',
          padding: '10px 12px',
          borderRadius: 10,
          border: `1px solid ${b.border}`,
          background: 'white',
          fontWeight: 900,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {expanded ? 'Hide preparation checklist' : 'View preparation checklist'}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No preparation steps recorded for this event yet.</p>
          ) : (
            steps.map((s) => (
              <div key={s.step_number} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: '#0f172a' }}>
                  {s.step_number}. {s.title}{' '}
                  <span style={{ fontWeight: 700, color: '#64748b' }}>
                    (by {s.deadline_days_before} day(s) before)
                  </span>
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155', lineHeight: 1.55 }}>{s.detail}</p>
              </div>
            ))
          )}
          {alert.insuranceNote ? (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
              <strong>Insurance note:</strong> {alert.insuranceNote}
            </p>
          ) : null}
          {alert.positiveNote ? (
            <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: '#1e3a8a' }}>Positive note</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155', lineHeight: 1.55 }}>{alert.positiveNote}</p>
            </div>
          ) : null}
        </div>
      )}

      <p style={{ margin: '10px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
        This is best-effort reference information, not legal advice. For authoritative guidance, consult local government and official airport/transport sources.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => onSnooze('2h')}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          Snooze 2h
        </button>
        <button
          type="button"
          onClick={() => onSnooze('rest_of_day')}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          Rest of day
        </button>
        <button
          type="button"
          onClick={() => onSnooze('trip')}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          This trip
        </button>
      </div>
    </div>
  );
}

