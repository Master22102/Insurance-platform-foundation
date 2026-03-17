'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RetentionPolicy {
  policy_name: string;
  target_table: string;
  jurisdiction: string;
  retention_days: number;
  legal_basis: string | null;
  legal_citation: string | null;
  auto_delete: boolean;
  notes: string;
}

const JURISDICTION_LABELS: Record<string, { label: string; flag: string }> = {
  DEFAULT:  { label: 'Default (Global)',     flag: '' },
  EU:       { label: 'European Union',        flag: 'EU' },
  'US-CA':  { label: 'United States (California)', flag: 'US' },
  HIPAA:    { label: 'Healthcare (HIPAA)',    flag: 'US' },
};

const LEGAL_BASIS_LABELS: Record<string, string> = {
  legitimate_interest:   'Legitimate Interest',
  right_to_erasure:      'GDPR Right to Erasure',
  ccpa_deletion_right:   'CCPA Deletion Right',
  hipaa_minimum_retention: 'HIPAA Minimum Retention',
};

function formatDays(days: number) {
  if (days >= 365 && days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? 's' : ''}`;
  if (days >= 30 && days % 30 === 0) return `${days / 30} months`;
  return `${days} days`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, color: '#999',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      margin: '0 0 10px', paddingLeft: 2,
    }}>
      {children}
    </p>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #f0f0f0',
      borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

function CheckItem({ children, status = 'active' }: { children: React.ReactNode; status?: 'active' | 'pending' | 'info' }) {
  const colors = {
    active:  { stroke: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    pending: { stroke: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    info:    { stroke: '#2E5FA3', bg: '#eff4fc', border: '#bfdbfe' },
  };
  const c = colors[status];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: c.bg, border: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        {status === 'active' ? (
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M3 7l3 3 5-5" stroke={c.stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : status === 'pending' ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={c.stroke} strokeWidth="2"/>
            <path d="M12 6v6l4 2" stroke={c.stroke} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={c.stroke} strokeWidth="2"/>
            <path d="M12 8v4M12 16v1" stroke={c.stroke} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <span style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function StandardBadge({ label, status }: { label: string; status: 'ready' | 'in-progress' | 'planned' }) {
  const colors = {
    'ready':       { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: 'Ready' },
    'in-progress': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: 'In progress' },
    'planned':     { color: '#6b7280', bg: '#f5f5f5', border: '#e0e0e0', text: 'Planned' },
  };
  const c = colors[status];
  return (
    <div style={{
      border: `1px solid ${c.border}`, borderRadius: 12,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, color: c.color,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 20, padding: '2px 9px',
      }}>{c.text}</span>
    </div>
  );
}

export default function TrustSafetyPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trust/retention-policies')
      .then((r) => r.json())
      .then((data) => {
        setPolicies(data.policies ?? []);
        setGeneratedAt(data.generated_at ?? null);
        setLoadingPolicies(false);
      })
      .catch(() => setLoadingPolicies(false));
  }, []);

  const tripPolicies = policies.filter((p) => p.target_table === 'trips');

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: 48 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#888', padding: 4, display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: 0, letterSpacing: '-0.3px' }}>
            Trust &amp; Safety
          </h1>
          <p style={{ fontSize: 12, color: '#aaa', margin: '2px 0 0' }}>
            Security standards, data retention, and your rights
          </p>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)',
        borderRadius: 18, padding: '20px 20px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -16, top: -16, width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l7 4v5c0 5.25-3 9.74-7 11-4-1.26-7-5.75-7-11V6l7-4z" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>
            Your data is protected
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
            All data is encrypted at rest and in transit. Every action is recorded to an immutable audit log.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Security Standards</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StandardBadge label="AES-256 Encryption at Rest" status="ready" />
          <StandardBadge label="TLS 1.3 Encryption in Transit" status="ready" />
          <StandardBadge label="Immutable Event Audit Log" status="ready" />
          <StandardBadge label="SHA-256 Content Integrity Hashing" status="ready" />
          <StandardBadge label="Row-Level Security (RLS) on All Tables" status="ready" />
          <StandardBadge label="SOC 2 Type II" status="in-progress" />
          <StandardBadge label="HIPAA-Ready Architecture" status="in-progress" />
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Information Security Policy</SectionLabel>
        <Card>
          <div style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 14px', lineHeight: 1.6 }}>
              Document ingestion and data processing follow a quarantine-first security model. No document enters the active corpus without passing all admission gates.
            </p>
            <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 8 }}>
              <CheckItem status="active">Quarantine-first document ingestion — all uploads enter quarantine before review</CheckItem>
              <CheckItem status="active">5-check admission gates before any document is promoted to active status</CheckItem>
              <CheckItem status="active">SHA-256 content hashing on all artifacts for tampering detection and deduplication</CheckItem>
              <CheckItem status="active">Trust-level tagging (official / high / medium / low / unverified) on every document</CheckItem>
              <CheckItem status="active">Complete actor accountability — every action logs actor ID, kind, and timestamp</CheckItem>
              <CheckItem status="active">Append-only event ledger — historical records cannot be modified or deleted</CheckItem>
              <CheckItem status="active">Interpretive Trace Records (ITR) for full extraction lineage and reproducibility</CheckItem>
              <CheckItem status="active">Active-only extraction pipeline — zero-yield or unverified documents are excluded</CheckItem>
              <CheckItem status="pending">End-to-end KMS-backed encryption for stored artifacts</CheckItem>
              <CheckItem status="pending">Webhook alerts on quarantine threshold breaches</CheckItem>
              <CheckItem status="pending">Signed artifact manifests for tamper evidence</CheckItem>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Data Retention Policy</SectionLabel>
        <Card>
          <div style={{ padding: '14px 18px 6px', borderBottom: '1px solid #f5f5f5' }}>
            <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.6 }}>
              Retention windows are jurisdiction-specific. When you archive a trip, the applicable retention period is calculated at the time of archival and shown to you before confirmation.
            </p>
            {generatedAt && (
              <p style={{ fontSize: 11, color: '#ccc', margin: '6px 0 0' }}>
                Policy data retrieved {new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
          </div>

          {loadingPolicies ? (
            <div style={{ padding: '24px 18px', textAlign: 'center' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #e0e0e0', borderTopColor: '#2E5FA3', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div>
              {tripPolicies.map((policy, idx) => {
                const jLabel = JURISDICTION_LABELS[policy.jurisdiction] ?? { label: policy.jurisdiction, flag: '' };
                const basisLabel = policy.legal_basis ? (LEGAL_BASIS_LABELS[policy.legal_basis] ?? policy.legal_basis) : null;
                const isLast = idx === tripPolicies.length - 1;
                return (
                  <div key={policy.policy_name} style={{
                    padding: '14px 18px',
                    borderBottom: isLast ? 'none' : '1px solid #f5f5f5',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>
                          {jLabel.label}
                        </p>
                        {basisLabel && (
                          <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{basisLabel}</p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>
                          {formatDays(policy.retention_days)}
                        </p>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: policy.auto_delete ? '#c2410c' : '#6b7280',
                          background: policy.auto_delete ? '#fff7ed' : '#f5f5f5',
                          border: `1px solid ${policy.auto_delete ? '#fdba74' : '#e0e0e0'}`,
                          borderRadius: 20, padding: '1px 7px',
                        }}>
                          {policy.auto_delete ? 'Auto-delete eligible' : 'Operator review required'}
                        </span>
                      </div>
                    </div>
                    {policy.legal_citation && (
                      <p style={{ fontSize: 11, color: '#bbb', margin: '4px 0 0' }}>{policy.legal_citation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Your Data Rights</SectionLabel>
        <Card>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f7f8fa', border: '1px solid #efefef', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Right to erasure (GDPR Article 17)</p>
                <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>
                  If you are an EU/EEA resident, you may request deletion of your personal data. Archived trips are retained for 90 days before permanent deletion to allow for dispute resolution, then auto-deleted.
                </p>
              </div>
              <div style={{ background: '#f7f8fa', border: '1px solid #efefef', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Right to delete (CCPA § 1798.105)</p>
                <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>
                  California residents have the right to request deletion of personal information. Archived trips are retained for 45 days before permanent deletion.
                </p>
              </div>
              <div style={{ background: '#f7f8fa', border: '1px solid #efefef', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Healthcare data (HIPAA-adjacent)</p>
                <p style={{ fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>
                  Trip data associated with medical travel is subject to a 6-year minimum retention period under HIPAA 45 CFR § 164.530(j). Deletion requires operator review and cannot be automated.
                </p>
              </div>
            </div>
          </div>
          <div style={{
            margin: '0 18px 16px',
            background: '#eff4fc', border: '1px solid #bfdbfe',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <p style={{ fontSize: 12, color: '#1e40af', margin: 0, lineHeight: 1.6 }}>
              To exercise a data deletion right, archive the relevant trips from your Trips page. An erasure request is automatically logged and the applicable jurisdiction-specific retention window begins.
            </p>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Incident &amp; Audit Trail</SectionLabel>
        <Card>
          <div style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 14px', lineHeight: 1.6 }}>
              Every significant action in the platform — document ingestion, extraction, claim routing, archival, and erasure — is written to an immutable, append-only event ledger. No event can be modified or deleted after creation.
            </p>
            <CheckItem status="active">Erasure &amp; redaction log with 9 classified event types</CheckItem>
            <CheckItem status="active">Actor accountability on every event (user, operator, system, legal process)</CheckItem>
            <CheckItem status="active">GDPR/CCPA legal basis codes recorded on all erasure events</CheckItem>
            <CheckItem status="active">Jurisdiction captured per event for cross-border compliance</CheckItem>
            <CheckItem status="active">Before/after SHA-256 hashes stored for integrity verification without storing PII</CheckItem>
            <CheckItem status="info">Event ledger is readable only by the owning account — no cross-account visibility</CheckItem>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Contact</SectionLabel>
        <Card>
          <div style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>Security team</p>
            <p style={{ fontSize: 13, color: '#2563eb', margin: '0 0 12px' }}>
              security@wayfarer.app
            </p>
            <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.6 }}>
              To report a security vulnerability, exercise a data right, or request a copy of your audit trail, email the security team with your account email in the subject line. We respond within 72 hours.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
