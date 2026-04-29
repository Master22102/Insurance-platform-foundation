'use client';

import { useEffect, useState } from 'react';
import { useIsNarrowAppShell } from '@/lib/hooks/useIsMobile';
import { radii, touch } from '@/lib/styles/tokens';

type Props = {
  open: boolean;
  onClose: () => void;
  tripId?: string;
};

export default function EmergencySosSheet({ open, onClose, tripId }: Props) {
  const narrowShell = useIsNarrowAppShell();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    const q = tripId ? `?trip_id=${encodeURIComponent(tripId)}` : '';
    fetch(`/api/emergency/snapshot${q}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [open, tripId]);

  if (!open) return null;

  const callNumber = async (number: string, numberType: string) => {
    void fetch('/api/emergency/action-log', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'call', number_type: numberType, trip_id: tripId }),
    });
    window.location.href = `tel:${number}`;
  };

  const sheetPad = narrowShell
    ? '16px 16px max(20px, calc(16px + env(safe-area-inset-bottom, 0px)))'
    : '20px 20px 24px';

  return (
    <div data-testid="emergency-sos-sheet" style={{ position: 'fixed', inset: 0, zIndex: 120 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.55)' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          padding: sheetPad,
          maxHeight: '86vh',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#7f1d1d' }}>Emergency SOS</p>
        <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#475569' }}>
          Quick access to emergency calls and critical identity details.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrowShell ? '1fr' : 'repeat(3, 1fr)',
            gap: narrowShell ? 10 : 8,
          }}
        >
          {[
            ['Police', data?.emergency_numbers?.police || '112', 'police'],
            ['Ambulance', data?.emergency_numbers?.ambulance || '112', 'ambulance'],
            ['Fire', data?.emergency_numbers?.fire || '112', 'fire'],
          ].map(([label, number, type]) => (
            <button
              key={String(type)}
              onClick={() => callNumber(String(number), String(type))}
              data-testid={`emergency-call-${String(type)}`}
              style={{
                padding: narrowShell ? '14px 12px' : '12px 8px',
                borderRadius: radii.md,
                border: '1px solid #fecaca',
                background: '#fff1f2',
                color: '#9f1239',
                fontWeight: 800,
                minHeight: narrowShell ? Math.max(52, touch.minTap) : touch.inputMinHeight,
                cursor: 'pointer',
              }}
            >
              {label}
              <div style={{ fontSize: narrowShell ? 13 : 11, marginTop: 4 }}>{number}</div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, border: '1px solid #e2e8f0', borderRadius: radii.md, padding: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#334155' }}>Emergency contact</p>
          <p style={{ margin: 0, fontSize: 13, color: '#0f172a' }}>
            {data?.profile?.emergency_contact_name || 'Not set'} · {data?.profile?.emergency_contact_phone || 'No number'}
          </p>
        </div>
      </div>
    </div>
  );
}
