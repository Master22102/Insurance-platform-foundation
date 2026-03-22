'use client';

import { useEffect, useState } from 'react';

type ErasureRow = Record<string, unknown>;

export default function FoclCompliancePage() {
  const [rows, setRows] = useState<ErasureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetId, setTargetId] = useState('');
  const [refNote, setRefNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/focl/erasure-audit', { credentials: 'include' });
        const j = await res.json();
        if (!res.ok || !j.ok) {
          setError(j.error || 'Could not load audit log');
          setRows([]);
        } else {
          setRows(j.rows || []);
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const triggerErasure = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/focl/erasure-audit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAccountId: targetId.trim(),
          requestReference: refNote.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setMsg(j.error || 'Request failed');
      } else {
        setMsg('Erasure processed. Refresh the list.');
        setTargetId('');
        setRefNote('');
      }
    } catch {
      setMsg('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 16px 28px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Compliance — erasure</h1>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4b5563', lineHeight: 1.55, maxWidth: 720 }}>
        Review redaction events and, when appropriate, run a structured erasure for a specific account ID. This does not
        delete auth users; it nullifies supported personal fields and flags ledger metadata.
      </p>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
          maxWidth: 560,
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Operator erasure</p>
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="Target account UUID"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 8, borderRadius: 8, border: '1px solid #d1d5db' }}
        />
        <input
          value={refNote}
          onChange={(e) => setRefNote(e.target.value)}
          placeholder="Ticket / reference (optional)"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, marginBottom: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
        />
        <button
          type="button"
          disabled={busy || !targetId.trim()}
          onClick={triggerErasure}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            background: busy || !targetId.trim() ? '#d1d5db' : '#1A2B4A',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: busy || !targetId.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Processing…' : 'Run erasure for account'}
        </button>
        {msg ? <p style={{ margin: '10px 0 0', fontSize: 12, color: '#374151' }}>{msg}</p> : null}
      </div>

      <h2 style={{ marginTop: 28, fontSize: 15, color: '#111827' }}>Recent erasure_redaction_log</h2>
      {loading ? <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p> : null}
      {error ? <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>No rows yet.</p>
      ) : null}
      <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>When</th>
              <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Type</th>
              <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Table</th>
              <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Row</th>
              <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Account</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={String(r.id || i)}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                  {r.created_at ? String(r.created_at) : '—'}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{String(r.event_type || '')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{String(r.target_table || '')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {String(r.target_row_id || '')}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', fontSize: 11 }}>{String(r.account_id || '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
