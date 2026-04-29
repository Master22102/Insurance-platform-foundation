'use client';

import { useEffect, useState } from 'react';
import { getJoinUrl } from '@/lib/travelshield/qr';

type Props = {
  token: string;
  expiresAt: string;
  usesCount: number;
  maxUses: number;
  onClose: () => void;
};

export default function QRCodeDisplay({ token, expiresAt, usesCount, maxUses, onClose }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = getJoinUrl(token);
        const s = await QRCode.toString(url, {
          type: 'svg',
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!cancelled) setSvg(s);
      } catch (e) {
        if (!cancelled) setErr('Could not render QR code');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const expMs = new Date(expiresAt).getTime() - Date.now();
  const expLabel =
    expMs <= 0 ? 'Expired' : `${Math.floor(expMs / 3600000)}h ${Math.floor((expMs % 3600000) / 60000)}m left`;

  const shareUrl = getJoinUrl(token);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join my TravelShield group', url: shareUrl });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Invite link copied to clipboard.');
    } catch {
      prompt('Copy this link:', shareUrl);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      role="dialog"
      aria-modal
      aria-label="TravelShield invite QR code"
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          maxWidth: 360,
          width: '100%',
          padding: '24px 20px 20px',
          position: 'relative',
          boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            color: '#94a3b8',
          }}
        >
          ×
        </button>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Scan to join</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>
          Same code works for up to {maxUses} people. Invite refreshes every 24 hours.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 12,
            background: '#f8fafc',
            borderRadius: 12,
            marginBottom: 14,
            minHeight: 280,
            alignItems: 'center',
          }}
        >
          {err ? (
            <span style={{ color: '#b91c1c', fontSize: 13 }}>{err}</span>
          ) : svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</span>
          )}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#475569', textAlign: 'center' }}>
          Expires in: <strong>{expLabel}</strong>
          <span style={{ display: 'none' }}>{tick}</span>
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Uses: {usesCount} / {maxUses}
        </p>
        <button
          type="button"
          onClick={share}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: '#f1f5f9',
            fontWeight: 600,
            fontSize: 14,
            color: '#0f172a',
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          Share link instead
        </button>
      </div>
    </div>
  );
}
