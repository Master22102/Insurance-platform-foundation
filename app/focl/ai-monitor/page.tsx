'use client';

import { useEffect, useState } from 'react';

type Summary = {
  count_today: number;
  count_week: number;
  count_month: number;
  cost_today_usd: number;
  cost_week_usd: number;
  cost_month_usd: number;
  flagged_today: number;
};

type FlaggedRow = {
  interaction_id: string;
  user_id: string;
  interaction_type: string;
  flag_reason: string | null;
  created_at: string;
  model_used: string | null;
};

type TopUser = { user_id: string; count: number; cost: number };

export default function FoclAiMonitorPage() {
  const [data, setData] = useState<{
    summary: Summary;
    by_type_today: Record<string, number>;
    flagged_recent: FlaggedRow[];
    top_users_week: TopUser[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch('/api/focl/ai-interactions', { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (cancelled) return;
      if (!r.ok) {
        setError((j as { error?: string }).error || 'Failed to load');
        return;
      }
      if ((j as { ok?: boolean }).ok) {
        setData({
          summary: (j as { summary: Summary }).summary,
          by_type_today: (j as { by_type_today: Record<string, number> }).by_type_today,
          flagged_recent: (j as { flagged_recent: FlaggedRow[] }).flagged_recent,
          top_users_week: (j as { top_users_week: TopUser[] }).top_users_week,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 8 }}>AI interaction monitor</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
        Usage, estimated cost, and flagged interactions (prompt-injection signals). Founder-only.
      </p>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {data && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 28,
            }}
          >
            {[
              ['Today', data.summary.count_today, `$${data.summary.cost_today_usd.toFixed(4)}`],
              ['This week', data.summary.count_week, `$${data.summary.cost_week_usd.toFixed(4)}`],
              ['This month', data.summary.count_month, `$${data.summary.cost_month_usd.toFixed(4)}`],
              ['Flagged today', data.summary.flagged_today, '—'],
            ].map(([label, a, b]) => (
              <div
                key={String(label)}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fafafa',
                }}
              >
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{label}</p>
                <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 800, color: '#111' }}>{a}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{b}</p>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>By type (today)</h2>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
            {Object.entries(data.by_type_today).length === 0 ? (
              <p style={{ padding: 16, margin: 0, color: '#9ca3af', fontSize: 13 }}>No interactions today.</p>
            ) : (
              Object.entries(data.by_type_today).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: 13,
                  }}
                >
                  <span>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))
            )}
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Flagged (recent)</h2>
          <div style={{ border: '1px solid #fecaca', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
            {data.flagged_recent.length === 0 ? (
              <p style={{ padding: 16, margin: 0, color: '#9ca3af', fontSize: 13 }}>None.</p>
            ) : (
              data.flagged_recent.map((row) => (
                <div
                  key={row.interaction_id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #fee2e2',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#991b1b' }}>
                    {row.interaction_type} · {row.flag_reason || 'flagged'}
                  </div>
                  <div style={{ color: '#6b7280', marginTop: 4 }}>
                    user {row.user_id.slice(0, 8)}… · {row.model_used || '—'} ·{' '}
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Top users (week)</h2>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {data.top_users_week.length === 0 ? (
              <p style={{ padding: 16, margin: 0, color: '#9ca3af', fontSize: 13 }}>No data.</p>
            ) : (
              data.top_users_week.map((u) => (
                <div
                  key={u.user_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.user_id}</span>
                  <span>
                    {u.count} calls · ${u.cost.toFixed(4)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
