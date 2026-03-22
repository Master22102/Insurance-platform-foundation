'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { deriveDecisionGuidance, inferStrongestRuleLabel, postureColor, postureLabel } from '@/lib/decision-language';
import { AxisResult, initConnectorRegistry, runAxisConnectors } from '@/lib/intelligence/connectors';
import { CANONICAL_CONFIDENCE_LABELS, normalizeConfidenceLabel } from '@/lib/confidence/labels';
import { formatUsd, PRICING } from '@/lib/config/pricing';
import InterpretiveBoundaryNotice from '@/components/InterpretiveBoundaryNotice';
import { computeCoverageGraphWithIntelligence } from '@/lib/pipeline/coverage-and-routing';
import { validateRouteSegments, type RouteIssue } from '@/lib/route-validation';

interface DeepScanPanelProps {
  trip: any;
  onUnlock: () => void;
  onScanComplete?: () => void;
}

const SCAN_MESSAGES = [
  'Reading your itinerary…',
  'Checking coverage clauses…',
  'Identifying exclusions…',
  'Mapping gaps to your route…',
  'Finalising results…',
];

function CreditsDisplay({ credits, tripId }: { credits: number; tripId: string }) {
  const color = credits === 0 ? '#dc2626' : credits === 1 ? '#d97706' : '#16a34a';
  const bg = credits === 0 ? '#fef2f2' : credits === 1 ? '#fffbeb' : '#f0fdf4';
  const border = credits === 0 ? '#fecaca' : credits === 1 ? '#fde68a' : '#bbf7d0';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', background: bg,
      border: `1px solid ${border}`, borderRadius: 10,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.7" />
        <path d="M12 7v5l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>
        {credits === 0
          ? 'No Deep Scan credits remaining'
          : `${credits} Deep Scan credit${credits !== 1 ? 's' : ''} remaining`}
      </span>
    </div>
  );
}

function ScanResultCard({ result, axisResults }: { result: any; axisResults: AxisResult[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const gaps = (result.signals || []).filter((s: any) => s.type === 'gap');
  const risks = (result.signals || []).filter((s: any) => s.type === 'risk');
  const positives = (result.signals || []).filter((s: any) => s.type === 'positive');
  const topSignal = (result.signals || [])[0];
  const derivedDecisionGuidance = result.decision_guidance || deriveDecisionGuidance({
    strongestRuleLabel: inferStrongestRuleLabel(topSignal?.clause_type || topSignal?.clause_reference),
    documentationHints: (result.signals || [])
      .filter((s: any) => String(s.type || '').toLowerCase() === 'gap')
      .slice(0, 4)
      .map((s: any) => s.title || s.label)
      .filter(Boolean),
    actionPlan: (result.signals || [])
      .slice(0, 4)
      .map((s: any) => s.description || s.title || s.label)
      .filter(Boolean),
  });

  const sections = [
    { key: 'gaps', label: 'Coverage gaps', items: gaps, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    { key: 'risks', label: 'Risk signals', items: risks, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    { key: 'positives', label: 'Confirmed coverage', items: positives, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  ].filter(s => s.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.6" />
        </svg>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#14532d', margin: 0 }}>
            Deep Scan complete
          </p>
          <p style={{ fontSize: 12, color: '#166534', margin: '2px 0 0' }}>
            {result.policies_analyzed ?? 0} {result.policies_analyzed === 1 ? 'policy' : 'policies'} analyzed
            {result.clauses_reviewed ? ` · ${result.clauses_reviewed} clauses reviewed` : ''}
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '12px 14px',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 12,
            fontWeight: 700,
            color: postureColor(derivedDecisionGuidance.posture),
          }}
        >
          {postureLabel(derivedDecisionGuidance.posture)} · Structural clarity: {derivedDecisionGuidance.confidence}
        </p>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
          {derivedDecisionGuidance.what_applies}
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
          {derivedDecisionGuidance.why_it_applies}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {derivedDecisionGuidance.sequencing_notes.map((note: string, idx: number) => (
            <p key={idx} style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              • {note}
            </p>
          ))}
        </div>
      </div>

      {axisResults.length > 0 && (
        <div
          style={{
            background: 'white',
            border: '0.5px solid #e8e8e8',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1A2B4A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Intelligence connectors
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {axisResults.map((item) => (
              <div key={item.axis} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: '8px 10px', background: '#fbfdff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'capitalize' }}>
                    {item.axis.replace(/_/g, ' ')}
                  </p>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 20,
                    padding: '2px 7px',
                    border: `1px solid ${item.status === 'ok' ? '#bbf7d0' : item.status === 'degraded' ? '#fde68a' : '#e5e7eb'}`,
                    background: item.status === 'ok' ? '#f0fdf4' : item.status === 'degraded' ? '#fffbeb' : '#f8fafc',
                    color: item.status === 'ok' ? '#166534' : item.status === 'degraded' ? '#92400e' : '#64748b',
                  }}>
                    {item.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                  {item.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((section) => (
        <div key={section.key} style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <button
            onClick={() => setExpanded(expanded === section.key ? null : section.key)}
            style={{
              width: '100%', padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: section.color,
                background: section.bg, border: `1px solid ${section.border}`,
                borderRadius: 20, padding: '2px 9px',
              }}>
                {section.items.length}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {section.label}
              </span>
            </div>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ transform: expanded === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path d="M6 9l6 6 6-6" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {expanded === section.key && (
            <div style={{ borderTop: '1px solid #f0f0f0' }}>
              {section.items.map((item: any, i: number) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderBottom: i < section.items.length - 1 ? '1px solid #f7f7f7' : 'none',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {item.title || item.label || 'Signal'}
                  </p>
                  {item.description && (
                    <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px', lineHeight: 1.55, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {item.description}
                    </p>
                  )}
                  {item.clause_reference && (
                    <p style={{ fontSize: 11, color: '#aaa', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Ref: {item.clause_reference}
                    </p>
                  )}
                  {item.confidence && (() => {
                    const canonicalConfidence = normalizeConfidenceLabel(item.confidence);
                    const isHigh = canonicalConfidence === CANONICAL_CONFIDENCE_LABELS.HIGH_STRUCTURAL_ALIGNMENT;
                    const isConditional = canonicalConfidence === CANONICAL_CONFIDENCE_LABELS.CONDITIONAL_ALIGNMENT;
                    return (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: isHigh ? '#16a34a' : isConditional ? '#d97706' : '#888',
                        background: isHigh ? '#f0fdf4' : isConditional ? '#fffbeb' : '#f5f5f5',
                        border: `1px solid ${isHigh ? '#bbf7d0' : isConditional ? '#fde68a' : '#e0e0e0'}`,
                        borderRadius: 20, padding: '1px 7px', marginTop: 4, display: 'inline-block',
                      }}>
                        {canonicalConfidence}
                      </span>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{
          fontSize: 11, color: '#94a3b8', lineHeight: 1.55, margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Results are based on extracted policy clauses and your declared itinerary.
        </p>
        <InterpretiveBoundaryNotice compact />
      </div>
    </div>
  );
}

export default function DeepScanPanel({ trip, onUnlock, onScanComplete }: DeepScanPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [axisResults, setAxisResults] = useState<AxisResult[]>([]);
  const [error, setError] = useState('');
  const [latestScan, setLatestScan] = useState<any>(null);
  const [loadingPrior, setLoadingPrior] = useState(true);
  const [organizerPreview, setOrganizerPreview] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState<Array<{
    account_id: string;
    status: string;
    residence_country_code: string | null;
    residence_state_code: string | null;
  }>>([]);
  const [routeScheduleIssues, setRouteScheduleIssues] = useState<RouteIssue[]>([]);

  const credits: number = trip.deep_scan_credits_remaining ?? 0;
  const activeGroupParticipants = groupParticipants.filter((p) => p.status === 'active');
  const participantCount = trip?.is_group_trip
    ? Math.max(1, activeGroupParticipants.length || 1)
    : 1;
  const jurisdictionCounts = (trip?.is_group_trip ? activeGroupParticipants : []).reduce<Record<string, number>>((acc, t) => {
    const code = String(t?.residence_country_code || '').trim().toUpperCase();
    if (!code) return acc;
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});
  const jurisdictionSummary = Object.entries(jurisdictionCounts)
    .map(([code, count]) => `${code} (${count})`)
    .join(', ');
  const missingResidenceForGroup = Boolean(
    trip?.is_group_trip && activeGroupParticipants.some((t) => {
      const country = String(t?.residence_country_code || '').trim().toUpperCase();
      if (!country) return true;
      if (country === 'US') {
        const state = String(t?.residence_state_code || '').trim().toUpperCase();
        return !state;
      }
      return false;
    }),
  );
  const declaredActivitiesCount = Array.isArray(trip?.metadata?.activities) ? trip.metadata.activities.length : 0;
  const coveragePreferenceCount = Array.isArray(trip?.metadata?.coverage_preferences) ? trip.metadata.coverage_preferences.length : 0;

  useEffect(() => {
    initConnectorRegistry();
  }, []);

  useEffect(() => {
    if (!trip?.is_group_trip || !trip?.trip_id) {
      setGroupParticipants([]);
      return;
    }
    supabase
      .from('group_participants')
      .select('account_id, status, residence_country_code, residence_state_code')
      .eq('trip_id', trip.trip_id)
      .then(({ data }) => {
        setGroupParticipants((data || []) as any[]);
      });
  }, [trip?.is_group_trip, trip?.trip_id]);

  useEffect(() => {
    if (!trip?.trip_id) {
      setRouteScheduleIssues([]);
      return;
    }
    supabase
      .from('route_segments')
      .select('*')
      .eq('trip_id', trip.trip_id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const rows = data || [];
        const inputs = rows.map((s: any) => ({
          segment_id: s.segment_id,
          segment_type: s.segment_type,
          origin: s.origin,
          destination: s.destination,
          depart_at: s.depart_at,
          arrive_at: s.arrive_at,
          sort_order: s.sort_order,
        }));
        const { issues } = validateRouteSegments(inputs, {
          tripDepartureDate: trip.departure_date,
          tripReturnDate: trip.return_date,
        });
        setRouteScheduleIssues(issues);
      });
  }, [trip?.trip_id, trip?.departure_date, trip?.return_date]);

  const runDeepScanConnectors = async (scanResult: any, jobQueueId?: string | null) => {
    const destinationText = String(trip?.destination_summary || '');
    const isInternational =
      /\b(uk|france|germany|japan|italy|spain|portugal|greece|canada|mexico|brazil|thailand|singapore|korea|india|china|australia|new zealand)\b/i.test(destinationText);
    const hasAuthoritySignal = Array.isArray(scanResult?.signals)
      ? scanResult.signals.some((s: any) => /\b(authority|atc|government|border|airport authority)\b/i.test(`${s?.title || ''} ${s?.description || ''}`))
      : false;
    const locations = destinationText
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    const connectorResults = await runAxisConnectors({
      scanTier: 'deep',
      isInternational,
      hasAuthoritySignal,
      tripId: trip?.trip_id,
      itineraryHash: trip?.itinerary_hash || undefined,
      locations,
      deepScanSnapshot: {
        policiesAnalyzed: typeof scanResult?.policies_analyzed === 'number' ? scanResult.policies_analyzed : undefined,
        signals: Array.isArray(scanResult?.signals) ? scanResult.signals : undefined,
      },
    });
    setAxisResults(connectorResults);

    if (user?.id && trip?.trip_id && jobQueueId) {
      const { error: persistErr } = await supabase.from('scan_connector_axis_results').insert({
        trip_id: trip.trip_id,
        account_id: user.id,
        job_queue_id: jobQueueId,
        axis_results: connectorResults as unknown as object,
      });
      if (persistErr) {
        console.warn('[scan_connector_axis_results] persist failed', persistErr);
      }
    }
  };

  // Load most recent completed deep scan for this trip (`initiate_deep_scan` uses `job_queue.id` as `scan_id`).
  useEffect(() => {
    if (!trip.trip_id) return;
    supabase
      .from('job_queue')
      .select('id, status, metadata, created_at, payload')
      .eq('job_type', 'deep_scan')
      .eq('status', 'completed')
      .contains('payload', { trip_id: trip.trip_id })
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setLatestScan(data?.[0] || null);
        setLoadingPrior(false);
      });
  }, [trip.trip_id]);

  const runDeepScan = async () => {
    if (!user || !confirmed) return;
    const actorId = user.id;
    setScanning(true);
    setError('');
    setMsgIdx(0);
    setProgress(5);

    const cycle = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % SCAN_MESSAGES.length);
      setProgress((prev) => Math.min(prev + 15, 88));
    }, 1800);

    try {
      const itinerarySnapshot = {
        destination: trip.destination_summary,
        departure_date: trip.departure_date,
        return_date: trip.return_date,
        travel_mode: trip.travel_mode_primary,
        itinerary_version: trip.itinerary_version,
      };

      const { data, error: rpcErr } = await supabase.rpc('initiate_deep_scan', {
        p_user_id: user.id,
        p_trip_id: trip.trip_id,
        p_itinerary_snapshot: itinerarySnapshot,
        p_user_confirmed: true,
      });

      clearInterval(cycle);

      if (rpcErr || !data?.success || !data?.scan_id) {
        const errCode = data?.error || rpcErr?.message || 'unknown';
        if (errCode === 'group_residence_incomplete') {
          setError('Some participants are missing required residence details. Invite participants to finish setup or use organizer-only preview.');
        } else if (errCode === 'insufficient_credits' || errCode === 'no_deep_scan_credits_remaining') {
          setError('You have no Deep Scan credits remaining for this trip.');
        } else if (errCode === 'trip_not_unlocked') {
          setError('This trip needs to be unlocked before running a Deep Scan.');
        } else {
          setError('Something went wrong starting the scan. Please try again.');
        }
        setScanning(false);
        return;
      }

      setProgress(95);

      // Poll for scan completion (`scan_id` from RPC is `job_queue.id`).
      const scanId = data.scan_id as string;

      if (process.env.NEXT_PUBLIC_E2E_DEEP_SCAN_AUTOCOMPLETE === '1') {
        void fetch('/api/e2e/complete-deep-scan-job', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: scanId }),
        }).catch(() => {});
      }

      let attempts = 0;
      const pollOnce = async () => {
        attempts++;
        try {
          const { data: jobData } = await supabase
            .from('job_queue')
            .select('status, metadata')
            .eq('id', scanId)
            .eq('job_type', 'deep_scan')
            .maybeSingle();

          const st = String(jobData?.status || '').toLowerCase();

          if (st === 'completed') {
            setProgress(100);
            const meta = (jobData?.metadata && typeof jobData.metadata === 'object'
              ? jobData.metadata
              : {}) as Record<string, unknown>;
            const deep = meta.deep_scan_result;
            const finalResult =
              deep && typeof deep === 'object' && !Array.isArray(deep)
                ? { ...(deep as Record<string, unknown>), scan_id: scanId }
                : { scan_id: scanId, policies_analyzed: 0, signals: [] };

            setResult(finalResult);
            await runDeepScanConnectors(finalResult, scanId);

            if (trip?.trip_id) {
              void computeCoverageGraphWithIntelligence(supabase, trip.trip_id, actorId).then((res) => {
                if (!res.ok) {
                  console.warn('[compute_coverage_graph after deep scan]', res.message);
                }
              });
            }

            setScanning(false);
            setConfirmed(false);
            onScanComplete?.();
            return true;
          }

          if (st === 'failed' || attempts > 30) {
            setError(
              'The scan did not complete this time. If a credit was used for this attempt, it will be restored automatically. Please try again.',
            );
            setScanning(false);
            return true;
          }
          return false;
        } catch {
          if (attempts > 30) {
            setError(
              'The scan did not complete this time. If a credit was used for this attempt, it will be restored automatically. Please try again.',
            );
            setScanning(false);
            return true;
          }
          return false;
        }
      };

      void (async () => {
        if (await pollOnce()) return;
        const poll = setInterval(async () => {
          if (await pollOnce()) clearInterval(poll);
        }, 2000);
      })();

    } catch {
      clearInterval(cycle);
      setError('Something went wrong. Please try again.');
      setScanning(false);
    }
  };

  const maturityState = trip?.maturity_state || 'DRAFT';

  if (maturityState === 'DRAFT') {
    return (
      <div
        style={{
          background: 'white',
          border: '0.5px solid #e8e8e8',
          borderRadius: 12,
          padding: '32px 24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 9v4" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 17h.01" stroke="#92400e" strokeWidth="2.6" strokeLinecap="round" />
            <path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#92400e"
              strokeWidth="1.2"
            />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
          Complete Draft Home before Deep Scan
        </p>
        <p
          style={{
            fontSize: 13,
            color: '#666',
            margin: '0 0 20px',
            lineHeight: 1.6,
            maxWidth: 340,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Your trip needs route + dates confirmed. Open Draft Home, resolve blockers, and confirm readiness.
        </p>
        <Link
          href={`/trips/${trip.trip_id}/draft/readiness`}
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#1A2B4A',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Continue Draft Home
        </Link>
      </div>
    );
  }

  if (!trip.paid_unlock) {
    return (
      <div style={{
        background: 'white', border: '0.5px solid #e8e8e8',
        borderRadius: 12, padding: '32px 24px', textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#f0f4ff', border: '1px solid #dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#2E5FA3" strokeWidth="1.7" />
            <path d="M11 8v3l2 2" stroke="#2E5FA3" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M16.5 16.5L20 20" stroke="#2E5FA3" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>
          Deep Scan requires an unlocked trip
        </p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 8px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          Unlock this trip for {formatUsd(PRICING.tripUnlockUsd)} to get clause-level coverage analysis against your specific itinerary.
        </p>
        <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 20px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          Includes {PRICING.deepScanCreditsIncludedOnUnlock} Deep Scan credits — each one cross-references your policies against your itinerary: dates, routes, destinations, and connection buffers.
        </p>
        <button
          onClick={onUnlock}
          style={{
            padding: '10px 24px', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Unlock trip — {formatUsd(PRICING.tripUnlockUsd)}
        </button>
      </div>
    );
  }

  // Show prior result if we have one and haven't just scanned
  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ScanResultCard result={result} axisResults={axisResults} />
        <CreditsDisplay credits={credits} tripId={trip.trip_id} />
        {credits > 0 && (
          <button
            onClick={() => { setResult(null); setConfirmed(false); }}
            style={{
              padding: '9px 16px', background: 'none',
              border: '1px solid #e5e7eb', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: '#555', cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Run another scan
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Explain what Deep Scan does */}
      <div style={{
        background: 'white', border: '0.5px solid #e8e8e8',
        borderRadius: 12, padding: '20px 20px',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 10px', letterSpacing: '-0.2px' }}>
          Deep Scan
        </p>
        <p style={{ fontSize: 13, color: '#555', margin: '0 0 14px', lineHeight: 1.65 }}>
          Analyzes every clause in your attached policies against your specific itinerary —
          dates, routes, destinations, and connection buffers. Surfaces hidden exclusions,
          coverage gaps, and claim triggers before you travel.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            'Clause-level match against your itinerary',
            'Coverage gaps and missing protection',
            'Risk signals and exclusion triggers',
            'Confidence-labeled findings',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5" />
              </svg>
              <span style={{ fontSize: 13, color: '#444' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Itinerary preview */}
        {(trip.destination_summary || trip.departure_date) && (
          <div style={{
            padding: '10px 12px', background: '#f7f8fa',
            border: '1px solid #eaeaea', borderRadius: 8, marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Itinerary being scanned
            </p>
            {trip.destination_summary && (
              <p style={{ fontSize: 13, color: '#333', margin: '0 0 2px', fontWeight: 500 }}>
                {trip.destination_summary}
              </p>
            )}
            {trip.departure_date && (
              <p style={{ fontSize: 12, color: '#777', margin: 0 }}>
                {new Date(trip.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {trip.return_date && ` – ${new Date(trip.return_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </p>
            )}
          </div>
        )}

        <CreditsDisplay credits={credits} tripId={trip.trip_id} />
      </div>

      {/* Prior scan indicator */}
      {!loadingPrior && latestScan && (
        <div style={{
          padding: '10px 14px', background: '#f7f8fa',
          border: '1px solid #eaeaea', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#555', margin: 0 }}>Previous scan available</p>
            <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>
              {new Date(latestScan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={async () => {
              const meta = (latestScan?.metadata && typeof latestScan.metadata === 'object'
                ? latestScan.metadata
                : null) as Record<string, unknown> | null;
              const deep = meta?.deep_scan_result;
              if (deep && typeof deep === 'object' && !Array.isArray(deep)) {
                const jobId = latestScan?.id as string | undefined;
                const payload = { ...(deep as Record<string, unknown>), scan_id: jobId };
                setResult(payload);
                await runDeepScanConnectors(payload, jobId ?? null);
                return;
              }
              if (!latestScan?.result_id) return;
              const { data } = await supabase
                .from('scan_results')
                .select('*')
                .eq('result_id', latestScan.result_id)
                .maybeSingle();
              if (data) {
                setResult(data);
                await runDeepScanConnectors(data, latestScan?.scan_id ?? latestScan?.id ?? null);
              }
            }}
            style={{
              padding: '6px 12px', background: 'white',
              border: '1px solid #e5e7eb', borderRadius: 7,
              fontSize: 12, fontWeight: 600, color: '#2E5FA3', cursor: 'pointer',
            }}
          >
            View results
          </button>
        </div>
      )}

      {/* Scan in progress */}
      {scanning && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '24px 20px', textAlign: 'center',
        }}>
          <div style={{
            height: 4, background: '#f0f0f0', borderRadius: 2, marginBottom: 16,
          }}>
            <div style={{
              height: '100%', background: '#2E5FA3', borderRadius: 2,
              width: `${progress}%`, transition: 'width 1s ease',
            }} />
          </div>
          <p style={{ fontSize: 14, color: '#555', margin: 0 }}>{SCAN_MESSAGES[msgIdx]}</p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px', background: '#fef9f0',
          border: '1px solid #fde68a', borderRadius: 8,
          fontSize: 13, color: '#92400e', lineHeight: 1.55,
        }}>
          {error}
        </div>
      )}

      {/* Confirmation gate */}
      {missingResidenceForGroup && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
            Before we spend a Deep Scan credit...
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#92400e', lineHeight: 1.55 }}>
            Deep Scan can filter insurance options based on where each traveler lives. Some participants haven&apos;t added their location yet.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ border: '1px solid #f59e0b', background: 'white', color: '#92400e', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Invite participants to finish setup
            </button>
            <button
              type="button"
              onClick={() => setOrganizerPreview((v) => !v)}
              style={{ border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Organizer-only preview (no credit)
            </button>
            <Link
              href={`/trips/${trip.trip_id}`}
              style={{ border: '1px solid #e5e7eb', background: 'white', color: '#475569', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              Not now
            </Link>
          </div>
          {organizerPreview && (
            <div style={{ marginTop: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', padding: '10px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Organizer preview
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                We can show itinerary-derived checklist guidance and coverage concept summaries while participant setup is incomplete.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                Full eligibility filtering will be available once all participants complete their residence profile.
              </p>
            </div>
          )}
        </div>
      )}

      {!scanning && credits > 0 && !missingResidenceForGroup && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ marginBottom: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Before we run your Deep Scan
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              Participants: <strong>{participantCount}</strong>
              {jurisdictionSummary ? <> · Jurisdictions: <strong>{jurisdictionSummary}</strong></> : null}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              Declared activities: <strong>{declaredActivitiesCount}</strong> · Coverage preference signals: <strong>{coveragePreferenceCount}</strong>
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Deep Scan will use this information to filter eligible plans and highlight gaps.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              You&apos;ll use 1 Deep Scan credit. You have {credits} left for this trip.
            </p>
          </div>
          {routeScheduleIssues.some((i) => i.severity === 'blocker') ? (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.55 }}>
                Your route has schedule conflicts. You can still run Deep Scan, but results may be less accurate until
                those times line up.
              </p>
            </div>
          ) : null}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            marginBottom: 16,
          }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: '#444', lineHeight: 1.55 }}>
              I understand this will use <strong>1 Deep Scan credit</strong> from this trip.
              Credits are per trip and are consumed when the scan starts. If processing fails before completion, the used credit is restored.
            </span>
          </label>
          <button
            onClick={runDeepScan}
            disabled={!confirmed}
            style={{
              width: '100%', padding: '12px 0',
              background: confirmed ? '#1A2B4A' : '#e5e7eb',
              color: confirmed ? 'white' : '#9ca3af',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              cursor: confirmed ? 'pointer' : 'default',
            }}
          >
            Run Deep Scan
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => router.push(`/trips/${trip.trip_id}/group`)}
              style={{ border: '1px solid #e5e7eb', background: 'white', color: '#475569', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Edit participants
            </button>
            <button
              type="button"
              onClick={() => router.push(`/trips/${trip.trip_id}/draft/readiness`)}
              style={{ border: '1px solid #e5e7eb', background: 'white', color: '#475569', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Review preferences
            </button>
            <Link
              href={`/trips/${trip.trip_id}`}
              style={{ border: '1px solid #e5e7eb', background: 'white', color: '#475569', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              Not now
            </Link>
          </div>
        </div>
      )}

      {!scanning && credits === 0 && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px', lineHeight: 1.6 }}>
            You&apos;ve used all Deep Scan credits for this trip. Choose a credit pack to continue. Credits are added after payment confirmation.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: `1 scan — ${formatUsd(PRICING.deepScanSingleUsd)}`, credits: 1 },
              { label: `3 scans — ${formatUsd(PRICING.deepScanPack3Usd)}`, credits: 3 },
            ].map((pkg) => (
              <button
                key={pkg.credits}
                onClick={() => {
                  // In production: open payment modal for additional credits
                  // For now: link to unlock flow
                  onUnlock();
                }}
                style={{
                  padding: '9px 16px', background: '#1A2B4A', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {pkg.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
