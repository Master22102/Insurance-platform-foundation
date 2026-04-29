'use client';

import { useCallback, useEffect, useState } from 'react';

type Summary = {
  account_id: string;
  has_any_policy: boolean;
  coverage_gap_count: number;
  checklist_completion_pct: number;
  last_evaluated_at: string | null;
};

export default function GroupCoverageDashboard({ groupId, names }: { groupId: string; names: Record<string, string> }) {
  const [rows, setRows] = useState<Summary[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/travelshield/${groupId}/coverage-summary`, { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setRows([]);
        setTripId(null);
        setMsg('');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setMsg((j as { error?: string }).error || 'Could not load');
        setLoading(false);
        return;
      }
      setTripId((j as { trip_id?: string | null }).trip_id ?? null);
      setRows(((j as { summaries?: Summary[] }).summaries ?? []) as Summary[]);
    } catch {
      setMsg('Network error');
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remind = async (accountId: string) => {
    const res = await fetch(`/api/travelshield/${groupId}/coverage-remind`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error || 'Could not send reminder');
    }
  };

  if (loading) return <p style={{ fontSize: 12, color: '#64748b' }}>Loading coverage summary…</p>;
  if (!tripId) return null;
  if (msg) return <p style={{ fontSize: 12, color: '#b91c1c' }}>{msg}</p>;
  if (!rows.length) {
    return (
      <div style={{ fontSize: 12, color: '#64748b', padding: 10, border: '1px dashed #cbd5e1', borderRadius: 8 }}>
        No aggregate coverage data yet. Summaries appear when readiness jobs populate `group_coverage_summary`.
      </div>
    );
  }

  const noPolicy = rows.filter((r) => !r.has_any_policy).length;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        background: '#fff',
        fontFamily: 'system-ui,sans-serif',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Group coverage readiness</div>
      {rows.map((r) => {
        const label = names[r.account_id] || 'Member';
        return (
          <div key={r.account_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, minWidth: 80 }}>{label}</span>
            <span>{r.has_any_policy ? '✅ Policy attached' : '⚠️ No policy'}</span>
            <span style={{ color: '#64748b' }}>{r.coverage_gap_count} gaps</span>
            <span style={{ color: '#64748b' }}>{r.checklist_completion_pct}% checklist</span>
            {!r.has_any_policy ? (
              <button type="button" onClick={() => void remind(r.account_id)} style={{ fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Remind
              </button>
            ) : null}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
        {noPolicy} of {rows.length} members have no policy attached
      </div>
    </div>
  );
}
