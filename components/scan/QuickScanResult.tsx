'use client';

import { useRouter } from 'next/navigation';
import InterpretiveBoundaryNotice from '@/components/InterpretiveBoundaryNotice';
import { CANONICAL_CONFIDENCE_LABELS, normalizeConfidenceLabel } from '@/lib/confidence/labels';

const QUALITY_DOT: Record<string, { color: string; label: string }> = {
  high:   { color: '#16a34a', label: 'High quality' },
  medium: { color: '#d97706', label: 'Medium quality' },
  low:    { color: '#dc2626', label: 'Low quality' },
};

const CONFIDENCE_DOT: Record<string, { color: string; label: string }> = {
  [CANONICAL_CONFIDENCE_LABELS.HIGH_STRUCTURAL_ALIGNMENT]: { color: '#16a34a', label: 'High structural alignment' },
  [CANONICAL_CONFIDENCE_LABELS.CONDITIONAL_ALIGNMENT]: { color: '#d97706', label: 'Conditional alignment' },
  [CANONICAL_CONFIDENCE_LABELS.DOCUMENTATION_INCOMPLETE]: { color: '#6b7280', label: 'Documentation incomplete' },
  [CANONICAL_CONFIDENCE_LABELS.INSUFFICIENT_DATA]: { color: '#dc2626', label: 'Insufficient data' },
};

interface ScanResult {
  document_name?: string;
  quality?: 'high' | 'medium' | 'low';
  confidence?: {
    confidence_label?: string;
    confidence_version?: string;
  };
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
  transit_flags?: string[];
  quick_scan_tier?: 'surface';
  detected_locations?: string[];
  stay_hints?: string[];
  itinerary_hash?: string;
  expires_at?: string;
}

export default function QuickScanResult({ result }: { result: ScanResult }) {
  const router = useRouter();
  const fallbackQuality = QUALITY_DOT[result.quality || 'medium'];
  const canonicalConfidence = result.confidence?.confidence_label
    ? normalizeConfidenceLabel(result.confidence.confidence_label)
    : null;
  const quality = canonicalConfidence ? CONFIDENCE_DOT[canonicalConfidence] : fallbackQuality;

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

      <div style={{ marginBottom: 20 }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>
            Quick Scan Overview
          </p>
          <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.55 }}>
            A fast look at your trip. This is not a full analysis.
          </p>
        </div>
      </div>

      {(result.detected_locations && result.detected_locations.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            What we detected
          </p>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              We identified key parts of your trip, including travel and booking details.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: result.stay_hints?.length ? 8 : 0 }}>
              {result.detected_locations.map((loc, i) => (
                <span key={i} style={{ fontSize: 11, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '3px 8px' }}>
                  {loc}
                </span>
              ))}
            </div>
            {result.stay_hints && result.stay_hints.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.stay_hints.map((hint, i) => (
                  <p key={i} style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.45 }}>
                    • {hint}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {result.advisory_summary && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Possible coverage areas
          </p>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.55 }}>
              Some protections may apply to parts of this trip, depending on your providers. {result.advisory_summary}
            </p>
          </div>
        </div>
      )}

      {result.transit_flags && result.transit_flags.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            Potential gaps
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.transit_flags.map((flag, i) => (
              <p key={i} style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                • {flag}
              </p>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            We couldn&apos;t clearly detect coverage for some parts of this trip.
          </p>
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
            What we can help with
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

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
          What this means
        </p>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.55 }}>
            This is a quick scan and does not include full policy or rule analysis.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <InterpretiveBoundaryNotice />
      </div>

      {result.expires_at && (
        <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 20px' }}>
          This scan result is visible for 7 days.
        </p>
      )}
      {result.itinerary_hash && (
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 20px', wordBreak: 'break-all' }}>
          Itinerary hash: {result.itinerary_hash}
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
          Run Deep Scan for a full breakdown of your coverage, gaps, and next steps.
        </p>
        <button
          onClick={() => router.push('/trips')}
          style={{
            padding: '9px 18px', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            marginRight: 8,
          }}
        >
          Run Deep Scan
        </button>
        <button
          onClick={() => router.push('/trips')}
          style={{
            padding: '9px 18px', background: 'white', color: '#1A2B4A',
            border: '1px solid #dbeafe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          See insurance options
        </button>
      </div>
    </div>
  );
}
