'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const CONFIDENCE_STYLE: Record<string, { bg: string; border: string; fg: string }> = {
  HIGH:       { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534' },
  CONDITIONAL:{ bg: '#fef9f0', border: '#fde68a', fg: '#92400e' },
  LOW:        { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' },
  UNRESOLVED: { bg: '#f7f8fa', border: '#e5e7eb', fg: '#64748b' },
};

interface PolicyVersion {
  version_id: string;
  version_number: number;
  extracted_clauses: any;
  exclusions: any;
  created_at: string;
}

export default function PolicyDetailPage() {
  const { policy_id } = useParams<{ policy_id: string }>();
  const { user } = useAuth();
  const [policy, setPolicy] = useState<any>(null);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [linkedTrips, setLinkedTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !policy_id) return;
    (async () => {
      const [policyRes, versionRes, tripsRes] = await Promise.all([
        supabase.from('policies').select('*').eq('policy_id', policy_id).maybeSingle(),
        supabase.from('policy_versions').select('*').eq('policy_id', policy_id).order('created_at', { ascending: false }),
        supabase.from('trips').select('trip_id, name, destination').limit(20),
      ]);
      setPolicy(policyRes.data);
      setVersions((versionRes.data || []) as PolicyVersion[]);
      setLinkedTrips(tripsRes.data || []);
      setLoading(false);
    })();
  }, [user, policy_id]);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}><p style={{ fontSize: 13, color: '#888' }}>Loading policy...</p></div>;
  }

  if (!policy) {
    return <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}><p style={{ fontSize: 14, color: '#555' }}>Policy not found.</p></div>;
  }

  const latestVersion = versions[0];
  const clauses: any[] = Array.isArray(latestVersion?.extracted_clauses) ? latestVersion.extracted_clauses : [];
  const exclusions: any[] = Array.isArray(latestVersion?.exclusions) ? latestVersion.exclusions : [];

  const statusStyle: Record<string, { bg: string; fg: string }> = {
    active:     { bg: '#f0fdf4', fg: '#166534' },
    superseded: { bg: '#fef9f0', fg: '#92400e' },
    archived:   { bg: '#f7f8fa', fg: '#64748b' },
  };
  const st = statusStyle[policy.status] || statusStyle.active;

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href="/coverage" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to coverage
      </Link>

      {/* Header */}
      <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>
              {policy.policy_name || policy.name || 'Untitled policy'}
            </h1>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              {policy.provider || 'Unknown provider'}{policy.policy_number ? ` — #${policy.policy_number}` : ''}
            </p>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, color: st.fg, background: st.bg,
            borderRadius: 20, padding: '3px 10px',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {policy.status || 'active'}
          </span>
        </div>
        {policy.document_url && (
          <a
            href={policy.document_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '7px 14px', borderRadius: 7,
              background: '#f7f8fa', border: '1px solid #e2e8f0',
              color: '#2E5FA3', fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            View document
          </a>
        )}
      </div>

      {/* Coverage alignment */}
      {clauses.length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Coverage alignment
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clauses.map((clause: any, i: number) => {
              const conf = clause.confidence || 'UNRESOLVED';
              const cs = CONFIDENCE_STYLE[conf] || CONFIDENCE_STYLE.UNRESOLVED;
              return (
                <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: '#f9fafb', border: '0.5px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>
                      {clause.benefit_type || clause.label || clause.clause_family || `Clause ${i + 1}`}
                    </p>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: cs.fg, background: cs.bg,
                      border: `1px solid ${cs.border}`, borderRadius: 12, padding: '2px 8px',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {conf}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0', lineHeight: 1.55 }}>
                    {clause.alignment_statement || (
                      conf === 'HIGH'
                        ? 'Aligns with stated criteria under the terms reviewed. No exclusion is indicated.'
                        : conf === 'LOW'
                        ? 'An exclusion applies under the terms reviewed.'
                        : 'Alignment could not be determined from the available text.'
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exclusions */}
      {exclusions.length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Key exclusions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exclusions.map((ex: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 6, background: '#fef2f2', border: '0.5px solid #fecaca' }}>
                <p style={{ fontSize: 12, color: '#991b1b', margin: 0, lineHeight: 1.55 }}>
                  {ex.text || ex.clause || ex.description || `Exclusion ${i + 1}`}
                  {ex.section ? ` (${ex.section})` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked trips */}
      {linkedTrips.length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Linked trips
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {linkedTrips.map((t: any) => (
              <Link
                key={t.trip_id}
                href={`/trips/${t.trip_id}`}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  background: '#f7f8fa', border: '0.5px solid #e2e8f0',
                  color: '#1A2B4A', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                }}
              >
                {t.name || t.destination || t.trip_id.slice(0, 8)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Version history */}
      {versions.length > 1 && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Version history
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {versions.map((v) => (
              <div key={v.version_id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#1A2B4A' }}>v{v.version_number}</span>
                <span style={{ color: '#888' }}>{new Date(v.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#aaa', margin: '16px 0 0', lineHeight: 1.55 }}>
        Final review is performed by the benefit administrator.
      </p>
    </div>
  );
}
