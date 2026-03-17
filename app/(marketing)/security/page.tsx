import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const PILLARS = [
  {
    icon: 'M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z',
    iconColor: '#2E5FA3', iconBg: '#eff4fc', iconBorder: '#bfdbfe',
    title: 'Row-level security on every table',
    desc: 'Every database table enforces RLS policies. No cross-account data access is possible by design — a user\'s trips, policies, and incidents are only readable by that user.',
  },
  {
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    iconColor: '#16a34a', iconBg: '#f0fdf4', iconBorder: '#bbf7d0',
    title: 'Immutable audit logs',
    desc: 'All state transitions — incident status changes, claim submissions, evidence registrations — are written to an append-only event ledger with actor, timestamp, and machine-readable reason.',
  },
  {
    icon: 'M9 12l2 2 4-4',
    iconColor: '#0369a1', iconBg: '#f0f9ff', iconBorder: '#bae6fd',
    title: 'Interpretive trace integrity lock',
    desc: 'Every AI-generated clause extraction is signed and locked. Extracted coverage data cannot be silently modified after it\'s been committed — any change requires a new extraction record.',
  },
  {
    icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    iconColor: '#92400e', iconBg: '#fffbeb', iconBorder: '#fde68a',
    title: 'Jurisdiction-aware data retention',
    desc: 'Users can configure per-trip data retention aligned to their jurisdiction — GDPR Article 17, CCPA, or other applicable standards. Archived trips are flagged and can be purged on schedule.',
  },
  {
    icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
    iconColor: '#b45309', iconBg: '#fff7ed', iconBorder: '#fed7aa',
    title: 'Bypasses closed by design',
    desc: 'Database write paths are routed through guarded RPCs — direct table writes are disabled. Every mutation requires an authenticated session and passes through role-verified stored procedures.',
  },
  {
    icon: 'M15 7h3a5 5 0 010 10h-3m-6 0H6A5 5 0 010 12a5 5 0 015-5h3',
    iconColor: '#4a7c59', iconBg: '#f0fdf4', iconBorder: '#bbf7d0',
    title: 'MFA and session controls',
    desc: 'TOTP-based multi-factor authentication is available for all accounts on Frequent and Lifetime plans. Sessions are scoped and can be revoked at any time from account settings.',
  },
];

const STANDARDS = [
  { name: 'SOC 2 Type II', status: 'In progress', desc: 'Audit initiated Q1 2026. Controls mapped against CC6, CC7, and CC9 trust service criteria.', color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  { name: 'GDPR', status: 'Aligned', desc: 'Data processing agreements, right-to-erasure flows, and DPA-compliant data residency handling.', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { name: 'CCPA', status: 'Aligned', desc: 'California-resident data requests, opt-out flows, and retention controls comply with CCPA requirements.', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { name: 'PCI DSS', status: 'Delegated', desc: 'Payment processing is fully delegated to Stripe (PCI DSS Level 1). Wayfarer never stores card data.', color: '#2E5FA3', bg: '#eff4fc', border: '#bfdbfe' },
];

const RETENTION_DEFAULTS = [
  { jurisdiction: 'Default', trips: '3 years', incidents: '5 years', evidence: '5 years', claims: '7 years' },
  { jurisdiction: 'EU/EEA (GDPR)', trips: '2 years', incidents: '3 years', evidence: '3 years', claims: '6 years' },
  { jurisdiction: 'California (CCPA)', trips: '2 years', incidents: '3 years', evidence: '3 years', claims: '6 years' },
  { jurisdiction: 'User-controlled', trips: 'Configurable', incidents: 'Configurable', evidence: 'Configurable', claims: 'Configurable' },
];

export default function SecurityPage() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: 'white' }}>
      <section style={{
        background: 'linear-gradient(160deg, #0d1b2a 0%, #0a1f13 50%, #0d1b2a 100%)',
        padding: '140px 24px 96px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(ellipse at 50% 60%, rgba(22,163,74,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 8px #4ade80' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>All systems operational</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: 'white', margin: '0 0 20px', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
            Security is not a feature. It&rsquo;s the foundation.
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.65 }}>
            Your travel records contain some of the most sensitive personal data you own. We protect it at every layer.
          </p>
        </div>
      </section>

      <section style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 14px', letterSpacing: '-0.6px' }}>
              Security architecture
            </h2>
            <p style={{ fontSize: 16, color: '#666', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
              Six independently enforced layers, all active by default.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {PILLARS.map((p, i) => (
              <div key={i} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 16, padding: '28px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: p.iconBg, border: `1px solid ${p.iconBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d={p.icon} stroke={p.iconColor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: '0 0 10px', letterSpacing: '-0.2px' }}>{p.title}</h3>
                <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: '#f7f8fa' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 14px', letterSpacing: '-0.5px' }}>
              Compliance and standards
            </h2>
            <p style={{ fontSize: 16, color: '#666', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
              We hold ourselves to the standards your data deserves.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
            {STANDARDS.map((s, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: 14, padding: '24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0d1b2a', margin: 0 }}>{s.name}</h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '3px 10px' }}>
                    {s.status}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 14px', letterSpacing: '-0.5px' }}>
              Data retention policies
            </h2>
            <p style={{ fontSize: 16, color: '#666', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
              Default retention periods by data type and jurisdiction. All settings are configurable on Frequent and Lifetime plans.
            </p>
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e8e8e8' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f7f8fa', borderBottom: '1px solid #e8e8e8' }}>
                  {['Jurisdiction', 'Trips', 'Incidents', 'Evidence', 'Claims'].map((h) => (
                    <th key={h} style={{ padding: '14px 18px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RETENTION_DEFAULTS.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < RETENTION_DEFAULTS.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <td style={{ padding: '14px 18px', color: '#1A2B4A', fontWeight: 600 }}>{row.jurisdiction}</td>
                    <td style={{ padding: '14px 18px', color: '#555' }}>{row.trips}</td>
                    <td style={{ padding: '14px 18px', color: '#555' }}>{row.incidents}</td>
                    <td style={{ padding: '14px 18px', color: '#555' }}>{row.evidence}</td>
                    <td style={{ padding: '14px 18px', color: '#555' }}>{row.claims}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: '#f7f8fa' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#0d1b2a', margin: '0 0 14px', letterSpacing: '-0.5px' }}>
            Responsible disclosure
          </h2>
          <p style={{ fontSize: 16, color: '#666', margin: '0 0 28px', lineHeight: 1.7 }}>
            If you believe you&rsquo;ve found a security vulnerability in Wayfarer, please report it responsibly. We review all reports within 48 hours and credit researchers who help us improve.
          </p>
          <a href="mailto:security@wayfarer.app" style={{
            display: 'inline-block', padding: '12px 28px', background: '#1A2B4A', color: 'white',
            borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700,
          }}>
            security@wayfarer.app
          </a>
        </div>
      </section>
    </div>
  );
}
