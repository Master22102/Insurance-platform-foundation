'use client';

import { useEffect, useState } from 'react';

export default function CheckinRequestCard({
  groupId,
  checkinId,
  requesterName,
  onDone,
}: {
  groupId: string;
  checkinId: string;
  requesterName: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [started] = useState(() => Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedMin = Math.floor((Date.now() - started) / 60_000);
  void tick;

  const respond = async (response: 'safe' | 'needs_help') => {
    if (response === 'needs_help') {
      const ok = window.confirm(
        'This will notify everyone in your TravelShield group and your emergency contact (if set). Wayfarer does not call emergency services.',
      );
      if (!ok) return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/travelshield/${groupId}/checkin`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_id: checkinId, response }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error || 'Could not respond');
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setErr('Network error');
    }
    setBusy(false);
  };

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 12,
        border: '2px solid #1e3a8a',
        background: 'linear-gradient(180deg,#eff6ff,#fff)',
        fontFamily: 'system-ui,sans-serif',
      }}
    >
      <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{requesterName} is checking on you</p>
      <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#475569' }}>Active {elapsedMin} min — please respond.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void respond('safe')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '14px 12px',
            borderRadius: 10,
            border: 'none',
            background: '#16a34a',
            color: 'white',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          I&apos;m safe
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void respond('needs_help')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '14px 12px',
            borderRadius: 10,
            border: 'none',
            background: '#b91c1c',
            color: 'white',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          I need help
        </button>
      </div>
      {err ? <p style={{ color: '#b91c1c', fontSize: 12, margin: '10px 0 0' }}>{err}</p> : null}
    </div>
  );
}
