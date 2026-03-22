'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';

type InviteRow = {
  request_id: string;
  requester_id: string;
  subject_id: string;
  guardian_id: string | null;
  trip_id: string;
  trip_type: string;
  status: string;
  expires_at: string;
  requires_dual_approval: boolean;
  subject_approved: boolean;
  guardian_approved: boolean;
  trips:
    | { trip_id: string; destination_summary: string | null }
    | Array<{ trip_id: string; destination_summary: string | null }>
    | null;
};

export default function GroupInvitesInboxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('relationship_verification_requests')
      .select(
        `
        request_id,
        requester_id,
        subject_id,
        guardian_id,
        trip_id,
        trip_type,
        status,
        expires_at,
        requires_dual_approval,
        subject_approved,
        guardian_approved,
        trips ( trip_id, destination_summary )
      `,
      )
      .eq('subject_id', user.id)
      .order('expires_at', { ascending: true });
    if (error) {
      setMessage(error.message);
    } else {
      setRows((data || []) as InviteRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (requestId: string, decision: 'approve' | 'deny') => {
    setBusyId(requestId);
    setMessage('');
    const { data, error } = await supabase.rpc('resolve_relationship_verification_request', {
      p_request_id: requestId,
      p_decision: decision,
    });
    setBusyId(null);
    if (error || !data?.success) {
      setMessage(error?.message || data?.error || 'Could not update invite.');
      return;
    }
    setMessage(`Updated: ${String(data.status)}.`);
    await load();
  };

  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href="/account" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
        ← Back to account
      </Link>
      <h1 style={{ fontSize: 22, color: '#1A2B4A', margin: '14px 0 6px' }}>Group trip invites</h1>
      <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
        When an organizer adds you to a group trip, you confirm or decline here. If you’re a minor, your guardian may also
        need to approve before you join.
      </p>
      {message ? (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#475569' }}>{message}</p>
      ) : null}

      {loading ? (
        <p style={{ marginTop: 20, fontSize: 13, color: '#64748b' }}>Loading…</p>
      ) : (
        <>
          <section style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Needs your response
            </p>
            {pending.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>No pending invites.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map((r) => (
                  <li
                    key={r.request_id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '12px 14px',
                      background: 'white',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      {(Array.isArray(r.trips) ? r.trips[0]?.destination_summary : r.trips?.destination_summary)?.trim() || 'Group trip'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
                      Type: <strong>{r.trip_type}</strong> · Organizer ID: <code style={{ fontSize: 11 }}>{r.requester_id.slice(0, 8)}…</code>
                      <br />
                      Expires: {new Date(r.expires_at).toLocaleString()}
                    </p>
                    {r.requires_dual_approval ? (
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#92400e', lineHeight: 1.45 }}>
                        Dual approval: you <strong>{r.subject_approved ? 'approved' : 'still need to approve'}</strong>
                        {r.guardian_id
                          ? <> · Guardian <strong>{r.guardian_approved ? 'approved' : 'pending'}</strong></>
                          : null}
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={busyId === r.request_id}
                        onClick={() => void resolve(r.request_id, 'approve')}
                        style={{
                          border: '1px solid #bbf7d0',
                          background: '#f0fdf4',
                          color: '#166534',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: busyId === r.request_id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.request_id}
                        onClick={() => void resolve(r.request_id, 'deny')}
                        style={{
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#991b1b',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: busyId === r.request_id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Decline
                      </button>
                      <Link
                        href={`/trips/${r.trip_id}`}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#475569',
                          textDecoration: 'none',
                          alignSelf: 'center',
                        }}
                      >
                        View trip shell
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ marginTop: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recent history
            </p>
            {done.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>No completed invites yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {done.slice(0, 15).map((r) => (
                  <li key={r.request_id} style={{ fontSize: 12, color: '#475569' }}>
                    <strong>{r.status.toUpperCase()}</strong> · {(Array.isArray(r.trips) ? r.trips[0]?.destination_summary : r.trips?.destination_summary) || r.trip_id.slice(0, 8)} ·{' '}
                    {r.trip_type}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
