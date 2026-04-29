'use client';

import { useState } from 'react';
import QRCodeDisplay from './QRCodeDisplay';
import ConfigureSheet from './ConfigureSheet';

type Props = {
  open: boolean;
  onClose: () => void;
  tripId: string;
  onGroupCreated?: (groupId: string) => void;
};

export default function CreateGroupSheet({ open, onClose, tripId, onGroupCreated }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showConfigure, setShowConfigure] = useState(false);

  if (!open) return null;

  const create = async (): Promise<{ group_id: string; token: string } | null> => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/travelshield/create-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trip_id: tripId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error || 'Could not create group');
        setBusy(false);
        return null;
      }
      const gid = (j as { group_id?: string }).group_id;
      const tok = (j as { token?: string }).token;
      if (!gid || !tok) {
        setErr('Invalid response');
        setBusy(false);
        return null;
      }
      setGroupId(gid);
      setToken(tok);
      setExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      onGroupCreated?.(gid);
      setBusy(false);
      return { group_id: gid, token: tok };
    } catch {
      setErr('Network error');
      setBusy(false);
      return null;
    }
  };

  const shareOnly = async () => {
    let tok = token;
    if (!tok) {
      const created = await create();
      tok = created?.token ?? null;
    }
    if (!tok) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${base}/join/${encodeURIComponent(tok)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TravelShield invite', url });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(url);
      alert('Invite link copied.');
    } catch {
      prompt('Copy link:', url);
    }
  };

  const openQr = async () => {
    if (!token) {
      const r = await create();
      if (!r) return;
    }
    setShowQr(true);
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 180,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        role="dialog"
        aria-modal
        aria-label="Create TravelShield group"
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '20px 20px 0 0',
            width: '100%',
            maxWidth: 480,
            padding: '24px 20px 32px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Invite travel partners</h2>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            No usernames — share a QR code or link. Up to 8 people. Invites last 24 hours and can be reused.
          </p>
          {err ? <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{err}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void openQr()}
            style={{
              width: '100%',
              padding: '14px 0',
              marginBottom: 10,
              borderRadius: 12,
              border: 'none',
              background: busy ? '#94a3b8' : '#1e3a8a',
              color: 'white',
              fontWeight: 700,
              fontSize: 15,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy && !token ? 'Creating…' : 'Show QR code'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void shareOnly()}
            style={{
              width: '100%',
              padding: '14px 0',
              marginBottom: 10,
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 600,
              fontSize: 15,
              color: '#0f172a',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Send invite link
          </button>
          {groupId ? (
            <button
              type="button"
              onClick={() => setShowConfigure(true)}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                fontSize: 14,
                color: '#1e3a8a',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Configure my safety settings
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '10px 0',
              border: 'none',
              background: 'none',
              color: '#64748b',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
      {showQr && token && expiresAt ? (
        <QRCodeDisplay
          token={token}
          expiresAt={expiresAt}
          usesCount={0}
          maxUses={8}
          onClose={() => setShowQr(false)}
        />
      ) : null}
      {groupId ? (
        <ConfigureSheet
          open={showConfigure}
          groupId={groupId}
          onClose={() => setShowConfigure(false)}
          onActivated={() => onGroupCreated?.(groupId)}
        />
      ) : null}
    </>
  );
}
