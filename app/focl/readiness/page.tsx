'use client';

import { useEffect, useState } from 'react';
import { readinessItems, readinessSummary } from '@/lib/readiness/status';

function statusColor(status: string): { bg: string; border: string; text: string; label: string } {
  if (status === 'hardening_in_progress') {
    return { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Hardening in progress' };
  }
  if (status === 'partial') {
    return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'Partial' };
  }
  return { bg: '#f3f4f6', border: '#e5e7eb', text: '#4b5563', label: 'Unknown' };
}

export default function FoclReadinessPage() {
  const summary = readinessSummary(readinessItems);
  const [platformMode, setPlatformMode] = useState<string>('UNKNOWN');
  const [platformUpdatedAt, setPlatformUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPosture = async () => {
      const res = await fetch('/api/platform/posture', { cache: 'no-store' }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (cancelled) return;
      if (res?.ok && body?.mode) {
        setPlatformMode(String(body.mode));
        setPlatformUpdatedAt(body?.updated_at || null);
        return;
      }
      setPlatformMode('UNKNOWN');
    };
    loadPosture();
    return () => {
      cancelled = true;
    };
  }, []);

  const postureTone =
    platformMode === 'PROTECTIVE'
      ? { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' }
      : platformMode === 'NORMAL'
        ? { bg: '#ecfdf5', border: '#86efac', text: '#166534' }
        : { bg: '#f9fafb', border: '#e5e7eb', text: '#4b5563' };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 16px 28px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Readiness Board</h1>
      <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        Started-feature stability view. New feature expansion remains blocked until current hardening gates are green.
      </p>
      <div
        style={{
          marginBottom: 12,
          borderRadius: 10,
          border: `1px solid ${postureTone.border}`,
          background: postureTone.bg,
          color: postureTone.text,
          padding: '10px 12px',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ fontWeight: 700 }}>Platform posture:</strong> {platformMode}
        {platformMode === 'PROTECTIVE'
          ? ' — New feature activations stay blocked. Rollbacks and core safety workflows remain available.'
          : platformMode === 'NORMAL'
            ? ' — Activation flow can proceed when preflight checks pass.'
            : ' — Current posture could not be verified, so activation decisions should stay conservative.'}
        {platformUpdatedAt ? ` Last update: ${new Date(platformUpdatedAt).toLocaleString()}.` : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
        {[
          ['Total', summary.total],
          ['Hardening', summary.hardening],
          ['Partial', summary.partial],
          ['Missing', summary.missing],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{label}</p>
            <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 700, color: '#111827' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {readinessItems.map((item) => {
          const cfg = statusColor(item.status);
          return (
            <div key={item.name} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{item.name}</p>
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.text, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '2px 8px' }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#374151' }}>
                Doctrine: <strong>{item.doctrine}</strong> · Gate: <strong>{item.gate}</strong>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                {item.note}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
