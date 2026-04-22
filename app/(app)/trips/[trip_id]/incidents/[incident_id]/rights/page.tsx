'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const FRAMEWORKS = [
  { code: 'EU261', label: 'EU Regulation 261/2004', desc: 'Compensation for flight disruption on EU-departing or EU-carrier flights.' },
  { code: 'UK261', label: 'UK Regulation 261', desc: 'UK retained passenger rights post-Brexit.' },
  { code: 'DOT_TARMAC', label: 'US DOT Tarmac Delay', desc: 'Lengthy tarmac delay rules for US carriers.' },
  { code: 'DOT_REFUND', label: 'US DOT Refund Rule', desc: '2024 rule: automatic refunds for cancelled / significantly changed flights.' },
];

const DETERMINATION_STYLES: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  QUALIFIES:         { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534', label: 'Qualifies' },
  LIKELY_QUALIFIES:  { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534', label: 'Likely qualifies' },
  CONDITIONAL:       { bg: '#fef9f0', border: '#fde68a', fg: '#92400e', label: 'Conditional' },
  INSUFFICIENT_DATA: { bg: '#f7f8fa', border: '#e5e7eb', fg: '#555',    label: 'Needs more info' },
  DOES_NOT_QUALIFY:  { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b', label: 'Does not qualify' },
};

interface Evaluation {
  evaluation_id: string;
  framework_code: string;
  determination_status: string;
  reasoning_trace: any;
  created_at: string;
}

export default function StatutoryRightsPage() {
  const { trip_id, incident_id } = useParams<{ trip_id: string; incident_id: string }>();
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningFramework, setRunningFramework] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('statutory_rights_evaluations')
      .select('*')
      .eq('incident_id', incident_id)
      .order('created_at', { ascending: false });
    setEvaluations((data || []) as Evaluation[]);
    setLoading(false);
  };

  useEffect(() => { if (user && incident_id) load(); }, [user, incident_id]);

  const run = async (framework: string) => {
    if (!user) return;
    setRunningFramework(framework);
    setError('');
    const { error: rpcErr } = await supabase.rpc('evaluate_statutory_rights', {
      p_incident_id: incident_id,
      p_actor_id: user.id,
      p_framework_code: framework,
      p_idempotency_key: `rights-${incident_id}-${framework}-${Date.now()}`,
    });
    setRunningFramework(null);
    if (rpcErr) {
      setError(rpcErr.message || 'Evaluation failed.');
      return;
    }
    await load();
  };

  const latestByFramework = new Map<string, Evaluation>();
  evaluations.forEach((ev) => {
    if (!latestByFramework.has(ev.framework_code)) latestByFramework.set(ev.framework_code, ev);
  });

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}/incidents/${incident_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to incident
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>Statutory rights</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.55 }}>
        Evaluate this incident against passenger-rights frameworks. Each evaluation is stored with its reasoning trace so you can reproduce the outcome.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FRAMEWORKS.map((fw) => {
            const latest = latestByFramework.get(fw.code);
            const det = latest?.determination_status;
            const style = det ? DETERMINATION_STYLES[det] || DETERMINATION_STYLES.INSUFFICIENT_DATA : null;
            const running = runningFramework === fw.code;
            const trace = latest?.reasoning_trace;
            const traceSteps: any[] = Array.isArray(trace?.steps) ? trace.steps
              : Array.isArray(trace) ? trace : [];
            return (
              <div key={fw.code} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>{fw.code}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '2px 0 4px' }}>{fw.label}</p>
                    <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.55 }}>{fw.desc}</p>
                  </div>
                  {style && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: style.fg,
                      background: style.bg, border: `1px solid ${style.border}`,
                      borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}>
                      {style.label}
                    </span>
                  )}
                </div>

                {traceSteps.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {traceSteps.map((s, i) => (
                      <div key={i} style={{ padding: '8px 10px', background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{s.label || s.rule_id || `Step ${i + 1}`}</p>
                        {s.outcome && <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>{s.outcome}</p>}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => run(fw.code)}
                    disabled={!!runningFramework}
                    style={{
                      padding: '7px 14px',
                      background: running ? '#93afd4' : latest ? 'white' : '#1A2B4A',
                      color: latest && !running ? '#1A2B4A' : 'white',
                      border: latest && !running ? '1px solid #dbeafe' : 'none',
                      borderRadius: 7, fontSize: 12, fontWeight: 600,
                      cursor: runningFramework ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {running ? 'Evaluating...' : latest ? 'Re-evaluate' : 'Evaluate'}
                  </button>
                  {latest && (
                    <span style={{ fontSize: 11, color: '#888' }}>
                      Last run {new Date(latest.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: '#991b1b', margin: '14px 0 0' }}>{error}</p>}
    </div>
  );
}
