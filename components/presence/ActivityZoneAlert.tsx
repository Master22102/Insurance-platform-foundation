'use client';

import Link from 'next/link';
import type { PolicyBreakdownRow } from '@/lib/presence/alert-engine';
import { benefitTypeDisplay } from '@/lib/coverage/benefitLabels';

export default function ActivityZoneAlert({
  title,
  summary,
  policies,
  tripId,
  onDismiss,
  onSnooze,
  onOpenSettings,
}: {
  title: string;
  summary: string;
  policies: PolicyBreakdownRow[];
  tripId: string;
  onDismiss: () => void;
  onSnooze: (mode: '2h' | 'rest_of_day' | 'trip') => void;
  onOpenSettings: () => void;
}) {
  return (
    <div
      data-testid="presence-activity-zone-alert"
      style={{
        borderRadius: 12,
        border: '1px solid #fcd34d',
        overflow: 'hidden',
        background: '#fffbeb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
          }}
        >
          <span style={{ fontSize: 20 }} aria-hidden>
            ⚠️
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>COVERAGE ALERT</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>{title}</p>
          </div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{summary}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {policies.map((p, i) => (
              <div
                key={`${p.policyLabel}-${i}`}
                style={{
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: 'white',
                  border: `1px solid ${p.status === 'excluded' ? '#fecaca' : '#bbf7d0'}`,
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{p.policyLabel}</p>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: p.status === 'excluded' ? '#b91c1c' : '#15803d' }}>
                  {p.status === 'excluded' ? 'Excluded / limited' : 'Review wording'}
                  {p.benefit_type ? ` · ${benefitTypeDisplay(p.benefit_type)}` : ''}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Clause / gap ref: {p.clauseCitation}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={onDismiss}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => onSnooze('2h')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Snooze 2h
            </button>
            <button
              type="button"
              onClick={() => onSnooze('rest_of_day')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Rest of day
            </button>
            <button
              type="button"
              onClick={() => onSnooze('trip')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'white',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              This trip
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #1e3a8a',
                background: '#eff6ff',
                color: '#1e3a8a',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Settings
            </button>
          </div>
          <Link
            href={`/trips/${tripId}?tab=Coverage`}
            style={{ display: 'inline-block', marginTop: 12, fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}
          >
            View full coverage details →
          </Link>
        </div>
    </div>
  );
}
