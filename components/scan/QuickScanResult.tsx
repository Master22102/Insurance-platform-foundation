'use client';

import { useRouter } from 'next/navigation';

const QUALITY_DOT: Record<string, { color: string; label: string }> = {
  high:   { color: '#16a34a', label: 'High quality' },
  medium: { color: '#d97706', label: 'Medium quality' },
  low:    { color: '#dc2626', label: 'Low quality' },
};

interface ScanResult {
  document_name?: string;
  quality?: 'high' | 'medium' | 'low';
  coverage_categories?: Array<{
    category: string;
    description?: string;
    threshold?: string;
    limit?: string;
  }>;
  highlights?: string[];
  documentation_hints?: string[];
  advisory_summary?: string;
  action_plan?: string[];
  claim_routing?: string[];
  expires_at?: string;
}

export default function QuickScanResult({ result }: { result: ScanResult }) {
  const router = useRouter();
  const quality = QUALITY_DOT[result.quality || 'medium'];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
        padding: '14px 16px', background: 'white',
        border: '0.5px solid #e8e8e8', borderRadius: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: '#f0f4ff', border: '1px solid #dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#2E5FA3" strokeWidth="1.6"/>
            <path d="M8 8h8M8 12h8M8 16h5" stroke="#2E5FA3" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.document_name || 'Scanned document'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: quality.color }} />
          <span style={{ fontSize: 11, color: quality.color, fontWeight: 500 }}>{quality.label}</span>
        </div>
      </div>

      {result.coverage_categories && result.coverage_categories.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Coverage categories found
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.coverage_categories.map((cat, i) => (
              <div key={i} style={{
                background: 'white', border: '0.5px solid #e8e8e8',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px' }}>
                  {cat.category}
                </p>
                {cat.description && (
                  <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px', lineHeight: 1.5 }}>{cat.description}</p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {cat.threshold && (
                    <span style={{ fontSize: 11, color: '#888' }}>Threshold: {cat.threshold}</span>
                  )}
                  {cat.limit && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1A2B4A' }}>Limit: {cat.limit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.advisory_summary && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            What this means right now
          </p>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.55 }}>
              {result.advisory_summary}
            </p>
          </div>
        </div>
      )}

      {result.highlights && result.highlights.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Key highlights
          </p>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                </svg>
                <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.documentation_hints && result.documentation_hints.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Documents commonly requested for claims
          </p>
          <div style={{ background: '#f7f8fa', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.documentation_hints.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#888" strokeWidth="1.5"/>
                  <path d="M8 8h8M8 12h5" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.action_plan && result.action_plan.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            What to do next
          </p>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.action_plan.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ minWidth: 18, height: 18, borderRadius: '50%', background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.claim_routing && result.claim_routing.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Suggested filing order
          </p>
          <div style={{ background: '#f9fafb', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.claim_routing.map((route, i) => (
              <p key={i} style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.45 }}>
                {route}
              </p>
            ))}
          </div>
        </div>
      )}

      {result.expires_at && (
        <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 20px' }}>
          This scan result is visible for 7 days.
        </p>
      )}

      <div style={{
        background: '#f7f8fa', border: '0.5px solid #e8e8e8',
        borderRadius: 10, padding: '16px 18px',
      }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B4A', margin: '0 0 6px' }}>
          Want the full picture?
        </p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 14px', lineHeight: 1.5 }}>
          A trip unlock includes deep coverage analysis across all your policies.
        </p>
        <button
          onClick={() => router.push('/trips')}
          style={{
            padding: '9px 18px', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Unlock a trip
        </button>
      </div>
    </div>
  );
}
