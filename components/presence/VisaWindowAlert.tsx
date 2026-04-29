'use client';

import Link from 'next/link';
import type { PresenceUiAlert } from '@/lib/presence/alert-engine';

export default function VisaWindowAlert({
  alert,
  onDismiss,
  onSnooze,
  onOpenSettings,
}: {
  alert: Extract<PresenceUiAlert, { kind: 'visa_window' }>;
  onDismiss: () => void;
  onSnooze: (mode: '2h' | 'rest_of_day' | 'trip') => void;
  onOpenSettings: () => void;
}) {
  const cfg =
    alert.severity === 'critical'
      ? { border: '#fecaca', bg: '#fef2f2', title: '#991b1b' }
      : alert.severity === 'warning'
        ? { border: '#fcd34d', bg: '#fffbeb', title: '#92400e' }
        : { border: '#bfdbfe', bg: '#eff6ff', title: '#1e3a8a' };

  return (
    <div
      data-testid="presence-visa-window-alert"
      style={{
        borderRadius: 12,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        padding: '12px 14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: cfg.title, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Visa window intelligence
      </p>
      <p style={{ margin: '6px 0 4px', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{alert.title}</p>
      <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.55 }}>{alert.summary}</p>

      {alert.officialSourceUrl ? (
        <p style={{ margin: '8px 0 0', fontSize: 12 }}>
          <a href={alert.officialSourceUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>
            Official source →
          </a>
        </p>
      ) : null}

      <p style={{ margin: '10px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
        This is best-effort reference information, not legal advice. Confirm requirements via official government sources.
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
          onClick={onOpenSettings}
          style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${cfg.title}`, background: 'white', color: cfg.title, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          Passport settings
        </button>
        <Link href="/rights" style={{ padding: '8px 0', fontSize: 12, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>
          Rights reference →
        </Link>
      </div>
    </div>
  );
}

