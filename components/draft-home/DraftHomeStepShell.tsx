'use client';

import Link from 'next/link';
import React from 'react';

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            flex: 1,
            borderRadius: 2,
            background: i + 1 <= step ? '#1A2B4A' : '#e5e7eb',
          }}
        />
      ))}
    </div>
  );
}

export default function DraftHomeStepShell({
  screenId,
  tripId,
  title,
  step,
  total,
  backHref,
  children,
}: {
  screenId: string;
  tripId: string;
  title: string;
  step: number;
  total: number;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-screen-id={screenId}
      style={{ maxWidth: 620, margin: '0 auto', padding: '28px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1A2B4A', letterSpacing: '-0.3px' }}>{title}</h1>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Trip: {tripId}</div>
          </div>
          {backHref ? (
            <Link
              href={backHref}
              style={{
                fontSize: 13,
                color: '#888',
                textDecoration: 'none',
                border: '1px solid #e5e7eb',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'white',
                flexShrink: 0,
              }}
            >
              Back
            </Link>
          ) : (
            <Link
              href="/trips"
              style={{
                fontSize: 13,
                color: '#888',
                textDecoration: 'none',
                border: '1px solid #e5e7eb',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'white',
                flexShrink: 0,
              }}
            >
              All trips
            </Link>
          )}
        </div>
        <StepIndicator step={step} total={total} />
      </div>

      {children}
    </div>
  );
}

