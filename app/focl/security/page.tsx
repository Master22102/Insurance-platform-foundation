'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

type BreachRow = {
  incident_id: string;
  severity: string;
  breach_type: string;
  status: string;
  title: string;
  description: string | null;
  detected_at: string;
  founder_acknowledged: boolean;
  containment_actions: unknown;
  remediation_steps: unknown;
};

type TimelineRow = {
  entry_id: string;
  entry_type: string;
  description: string;
  created_at: string;
  actor_type: string | null;
};

const STATUSES = [
  'detected',
  'investigating',
  'contained',
  'eradicating',
  'recovering',
  'post_incident_review',
  'closed',
] as const;

export default function FoclSecurityPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BreachRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackConfirm, setAckConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('breach_incidents')
      .select('*')
      .order('detected_at', { ascending: false });
    setRows((data as BreachRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setTimeline([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from('breach_timeline')
        .select('entry_id, entry_type, description, created_at, actor_type')
        .eq('breach_id', selected)
        .order('created_at', { ascending: true });
      setTimeline((data as TimelineRow[]) || []);
    })();
  }, [selected]);

  const detail = rows.find((r) => r.incident_id === selected);

  const acknowledge = async () => {
    if (!user || !selected || !ackConfirm) return;
    const { data, error } = await supabase.rpc('acknowledge_breach_incident', {
      p_breach_id: selected,
      p_actor_id: user.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    if (data && !data.ok) {
      alert(data.error || 'Ack failed');
      return;
    }
    setAckConfirm(false);
    await load();
  };

  const advance = async (next: string) => {
    if (!user || !selected) return;
    const { data, error } = await supabase.rpc('advance_breach_status', {
      p_breach_id: selected,
      p_new_status: next,
      p_note: null,
      p_actor_id: user.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    if (data && !data.ok) {
      alert(data.error || 'Status update failed');
      return;
    }
    await load();
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/focl" style={{ color: '#64748b', fontSize: 13 }}>
          ← FOCL
        </Link>
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Security — breach protocol</h1>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
        Section 8.8 — First Incident Protocol. Founder-only. Timeline is append-only in the database.
      </p>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.2fr' : '1fr', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 10px' }}>Incidents</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>No breach incidents recorded.</p>}
              {rows.map((r) => (
                <button
                  key={r.incident_id}
                  type="button"
                  onClick={() => setSelected(r.incident_id)}
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 10,
                    border: selected === r.incident_id ? '2px solid #1A2B4A' : '1px solid #e2e8f0',
                    background: selected === r.incident_id ? '#f8fafc' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {r.severity} · {r.breach_type} · {r.status}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {new Date(r.detected_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected && detail && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>{detail.title}</h2>
              <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                {detail.description || '—'}
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
                Acknowledged: {detail.founder_acknowledged ? 'Yes' : 'No'}
              </p>

              {!detail.founder_acknowledged && (
                <div style={{ marginBottom: 16, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={ackConfirm} onChange={(e) => setAckConfirm(e.target.checked)} />
                    I confirm Founder acknowledgment (two-gate)
                  </label>
                  <button
                    type="button"
                    disabled={!ackConfirm}
                    onClick={() => void acknowledge()}
                    style={{
                      marginTop: 10,
                      padding: '8px 14px',
                      background: ackConfirm ? '#1A2B4A' : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: ackConfirm ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Acknowledge breach
                  </button>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>Advance status</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void advance(s)}
                      disabled={detail.status === s}
                      style={{
                        fontSize: 11,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        background: detail.status === s ? '#eff6ff' : 'white',
                        cursor: detail.status === s ? 'default' : 'pointer',
                      }}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>Containment (JSON)</p>
                <pre style={{ fontSize: 11, background: '#f1f5f9', padding: 8, borderRadius: 6, overflow: 'auto' }}>
                  {JSON.stringify(detail.containment_actions || [], null, 2)}
                </pre>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>Remediation (JSON)</p>
                <pre style={{ fontSize: 11, background: '#f1f5f9', padding: 8, borderRadius: 6, overflow: 'auto' }}>
                  {JSON.stringify(detail.remediation_steps || [], null, 2)}
                </pre>
              </div>

              <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Timeline</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#475569' }}>
                {timeline.map((t) => (
                  <li key={t.entry_id} style={{ marginBottom: 8 }}>
                    <span style={{ color: '#94a3b8' }}>{new Date(t.created_at).toLocaleString()} — </span>
                    {t.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
