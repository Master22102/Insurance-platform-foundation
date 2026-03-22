'use client';

import { useMemo, useState } from 'react';
import type { RouteIssue } from '@/lib/route-validation';

export default function RouteValidationBanner({
  issues,
  tripId,
}: {
  issues: RouteIssue[];
  tripId: string;
}) {
  const [open, setOpen] = useState(true);

  const { blockers, warnings } = useMemo(() => {
    const blockers = issues.filter((i) => i.severity === 'blocker');
    const warnings = issues.filter((i) => i.severity === 'warning');
    return { blockers, warnings };
  }, [issues]);

  if (issues.length === 0) {
    return (
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#14532d' }}>Route looks consistent</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#166534' }}>No schedule conflicts detected on this device.</p>
      </div>
    );
  }

  const hasBlockers = blockers.length > 0;

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          borderRadius: 12,
          border: `1px solid ${hasBlockers ? '#fecaca' : '#fde68a'}`,
          background: hasBlockers ? '#fef2f2' : '#fffbeb',
          padding: '12px 14px',
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 900, color: hasBlockers ? '#991b1b' : '#92400e' }}>
          {hasBlockers ? '⛔ Route issues (must fix)' : '⚠️ Route warnings'}
        </span>
        <span style={{ float: 'right', fontSize: 12, color: '#6b7280' }}>{open ? 'Hide' : 'Show'}</span>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#57534e' }}>
          {blockers.length} item(s) to review, {warnings.length} note(s) — your trip readiness check may add more context.
        </p>
      </button>
      {open ? (
        <div
          style={{
            marginTop: 8,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '10px 12px',
            background: 'white',
            maxHeight: 220,
            overflow: 'auto',
          }}
        >
          {hasBlockers ? (
            <div style={{ marginBottom: 10 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#991b1b' }}>Please adjust</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#444' }}>
                {blockers.map((b, idx) => (
                  <li key={`b-${idx}`} style={{ marginBottom: 6 }}>
                    {b.message}
                    {b.segmentId ? (
                      <span style={{ color: '#9ca3af' }}> · segment {b.segmentId.slice(0, 8)}…</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#92400e' }}>Warnings</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#444' }}>
                {warnings.map((w, idx) => (
                  <li key={`w-${idx}`} style={{ marginBottom: 6 }}>
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>
            Trip: <code>{tripId.slice(0, 8)}…</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}
