'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { MFAEnrollment } from '@/components/auth/mfa-enrollment';

const CLIENT_SESSION_KEY = 'wayfarer_client_session_id_v1';

function getClientSessionId(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(CLIENT_SESSION_KEY) || '';
}

type SessionRow = {
  session_id: string;
  device_info: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
  is_revoked: boolean;
};

function parseUaDevice(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    return 'Mobile browser';
  }
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return 'Desktop browser';
}

export default function AccountSecurityPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setSessionsLoading(true);
    setSessionsError(null);
    const { data, error } = await supabase
      .from('user_sessions')
      .select('session_id, device_info, ip_address, last_active_at, created_at, is_current, is_revoked')
      .eq('user_id', user.id)
      .order('last_active_at', { ascending: false });
    if (error) {
      setSessionsError(error.message);
      setSessions([]);
    } else {
      setSessions((data as SessionRow[]) || []);
    }
    setSessionsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin?return_url=/account/security');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) void loadSessions();
  }, [user, loadSessions]);

  const clientSid = getClientSessionId();

  const revokeOne = async (sessionId: string) => {
    setActionId(sessionId);
    try {
      const r = await fetch('/api/session/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setSessionsError((j as { error?: string }).error || 'Could not revoke session');
      } else {
        await loadSessions();
      }
    } finally {
      setActionId(null);
    }
  };

  const revokeOthers = async () => {
    if (!clientSid) {
      setSessionsError('This browser has no session id yet — refresh the page and try again.');
      return;
    }
    setActionId('others');
    try {
      const r = await fetch('/api/session/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ revokeOthers: true, clientSessionId: clientSid }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setSessionsError((j as { error?: string }).error || 'Could not revoke other sessions');
      } else {
        await loadSessions();
      }
    } finally {
      setActionId(null);
    }
  };

  if (loading || !user) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#666' }}>Loading…</p>
      </div>
    );
  }

  const mfaOn = Boolean(profile?.mfa_enabled);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '20px 16px 48px', maxWidth: 560, margin: '0 auto' }}>
      <Link href="/account" style={{ fontSize: 13, color: '#2E5FA3', textDecoration: 'none', fontWeight: 600 }}>
        ← Account
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: '16px 0 8px' }}>Security</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>
        Two-factor authentication and active sessions for your Wayfarer account.
      </p>

      <section style={{ marginBottom: 32 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            margin: '0 0 10px',
          }}
        >
          Two-factor authentication
        </p>
        {!mfaOn && (
          <p style={{ fontSize: 14, color: '#444', marginBottom: 12 }}>
            Add extra protection to your account with an authenticator app.
          </p>
        )}
        <MFAEnrollment />
      </section>

      <section>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            margin: '0 0 10px',
          }}
        >
          Active sessions
        </p>
        <div
          style={{
            background: 'white',
            border: '1px solid #f0f0f0',
            borderRadius: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          {sessionsError && (
            <p style={{ padding: '12px 16px', margin: 0, fontSize: 13, color: '#b91c1c' }}>{sessionsError}</p>
          )}
          {sessionsLoading ? (
            <p style={{ padding: 20, margin: 0, color: '#888', fontSize: 14 }}>Loading sessions…</p>
          ) : sessions.filter((s) => !s.is_revoked).length === 0 ? (
            <p style={{ padding: 20, margin: 0, color: '#888', fontSize: 14 }}>
              No tracked sessions yet. They appear after you sign in on this device.
            </p>
          ) : (
            sessions
              .filter((s) => !s.is_revoked)
              .map((s) => {
                const isThis = clientSid && s.session_id === clientSid;
                return (
                  <div
                    key={s.session_id}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #f5f5f5',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                            {parseUaDevice(s.device_info)}
                          </span>
                          {isThis && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#16a34a',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: 20,
                                padding: '2px 8px',
                              }}
                            >
                              This device
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
                          Last active: {new Date(s.last_active_at).toLocaleString()}
                          {s.ip_address ? ` · IP: ${s.ip_address}` : ''}
                        </p>
                      </div>
                      {!isThis && (
                        <button
                          type="button"
                          disabled={actionId !== null}
                          onClick={() => void revokeOne(s.session_id)}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#b91c1c',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 8,
                            padding: '6px 10px',
                            cursor: actionId ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {actionId === s.session_id ? '…' : 'Sign out'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
          {sessions.filter((s) => !s.is_revoked).length > 1 && (
            <div style={{ padding: 14 }}>
              <button
                type="button"
                disabled={actionId !== null}
                onClick={() => void revokeOthers()}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#b91c1c',
                  background: 'white',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  cursor: actionId ? 'not-allowed' : 'pointer',
                }}
              >
                {actionId === 'others' ? 'Working…' : 'Sign out all other devices'}
              </button>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '10px 0 0', textAlign: 'center', lineHeight: 1.4 }}>
                Revoking marks a session as ended in Wayfarer. Tokens may remain valid until they expire.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
