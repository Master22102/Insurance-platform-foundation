'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

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

function ScanResultCard({ result }: { result: any }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const gaps = (result.signals || []).filter((s: any) => s.type === 'gap');
  const risks = (result.signals || []).filter((s: any) => s.type === 'risk');
  const positives = (result.signals || []).filter((s: any) => s.type === 'positive');

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
                  {item.confidence && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: item.confidence === 'HIGH' ? '#16a34a' : item.confidence === 'CONDITIONAL' ? '#d97706' : '#888',
                      background: item.confidence === 'HIGH' ? '#f0fdf4' : item.confidence === 'CONDITIONAL' ? '#fffbeb' : '#f5f5f5',
                      border: `1px solid ${item.confidence === 'HIGH' ? '#bbf7d0' : item.confidence === 'CONDITIONAL' ? '#fde68a' : '#e0e0e0'}`,
                      borderRadius: 20, padding: '1px 7px', marginTop: 4, display: 'inline-block',
                    }}>
                      {item.confidence}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <p style={{
        fontSize: 11, color: '#aaa', lineHeight: 1.55, margin: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        Results are based on extracted policy clauses and your declared itinerary.
        Coverage amounts and conditions depend on your specific policy terms and the circumstances of any claim.
      </p>
    </div>
  );
}

export default function DeepScanPanel({ trip, onUnlock, onScanComplete }: DeepScanPanelProps) {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [latestScan, setLatestScan] = useState<any>(null);
  const [loadingPrior, setLoadingPrior] = useState(true);

  const credits: number = trip.deep_scan_credits_remaining ?? 0;

  // Load most recent completed scan for this trip
  useEffect(() => {
    if (!trip.trip_id) return;
    supabase
      .from('scan_jobs')
      .select('scan_id, scan_status, created_at, result_id')
      .eq('trip_id', trip.trip_id)
      .eq('scan_type', 'deep')
      .eq('scan_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setLatestScan(data?.[0] || null);
        setLoadingPrior(false);
      });
  }, [trip.trip_id]);

  const runDeepScan = async () => {
    if (!user || !confirmed) return;
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

      if (rpcErr || !data?.success) {
        const errCode = data?.error || rpcErr?.message || 'unknown';
        if (errCode === 'insufficient_credits') {
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

      // Poll for scan completion
      const scanId = data.scan_id;
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data: jobData } = await supabase
          .from('scan_jobs')
          .select('scan_status, result_id')
          .eq('scan_id', scanId)
          .maybeSingle();

        if (jobData?.scan_status === 'completed') {
          clearInterval(poll);
          setProgress(100);

          // Try to load scan result
          if (jobData.result_id) {
            const { data: scanResult } = await supabase
              .from('scan_results')
              .select('*')
              .eq('result_id', jobData.result_id)
              .maybeSingle();
            setResult(scanResult || { scan_id: scanId, policies_analyzed: 0, signals: [] });
          } else {
            setResult({ scan_id: scanId, policies_analyzed: 0, signals: [] });
          }

          setScanning(false);
          setConfirmed(false);
          onScanComplete?.();
        } else if (jobData?.scan_status === 'failed' || attempts > 30) {
          clearInterval(poll);
          setError('The scan did not complete. Your credit has not been consumed. Please try again.');
          setScanning(false);
        }
      }, 4000);

    } catch {
      clearInterval(cycle);
      setError('Something went wrong. Please try again.');
      setScanning(false);
    }
  };

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
          Unlock this trip for $14.99 to get clause-level coverage analysis against your specific itinerary.
        </p>
        <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 20px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          Includes 2 Deep Scan credits — each one cross-references your policies against your itinerary: dates, routes, destinations, and connection buffers.
        </p>
        <button
          onClick={onUnlock}
          style={{
            padding: '10px 24px', background: '#1A2B4A', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Unlock trip — $14.99
        </button>
      </div>
    );
  }

  // Show prior result if we have one and haven't just scanned
  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ScanResultCard result={result} />
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
              if (!latestScan.result_id) return;
              const { data } = await supabase
                .from('scan_results')
                .select('*')
                .eq('result_id', latestScan.result_id)
                .maybeSingle();
              if (data) setResult(data);
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
      {!scanning && credits > 0 && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '16px 20px',
        }}>
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
              Credits are per trip and are consumed when the scan starts.
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
        </div>
      )}

      {!scanning && credits === 0 && (
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px', lineHeight: 1.6 }}>
            You've used all Deep Scan credits for this trip. Purchase additional scans to run another analysis.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: '1 scan — $44.99', credits: 1 },
              { label: '3 scans — $119.99', credits: 3 },
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
