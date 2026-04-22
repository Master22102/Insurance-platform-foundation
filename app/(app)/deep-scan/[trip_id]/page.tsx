'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { DEEP_SCAN_AXES } from '@/lib/deep-scan/axes';

interface AxisResult {
  axis_key: string;
  axis_number: number;
  title: string;
  summary: string;
  findings: Array<{ level: 'positive'|'risk'|'gap'|'info'; title: string; description: string; confidence: string }>;
  confidence: string;
  sources: string[];
}

const LEVEL_STYLES: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  positive: { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534', label: 'Positive' },
  risk:     { bg: '#fef9f0', border: '#fde68a', fg: '#92400e', label: 'Risk' },
  gap:      { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b', label: 'Gap' },
  info:     { bg: '#f7f8fa', border: '#e5e7eb', fg: '#555',    label: 'Info' },
};

export default function DeepScanTripPage() {
  const { trip_id } = useParams<{ trip_id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<AxisResult[] | null>(null);
  const [boundary, setBoundary] = useState('');
  const [priorResult, setPriorResult] = useState<any>(null);

  useEffect(() => {
    if (!user || !trip_id) return;
    (async () => {
      const { data: tripRow } = await supabase
        .from('trips')
        .select('*')
        .eq('trip_id', trip_id)
        .maybeSingle();
      setTrip(tripRow);

      const { data: priorRows } = await supabase
        .from('scan_connector_axis_results')
        .select('axis_results, created_at')
        .eq('trip_id', trip_id)
        .eq('account_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      setPriorResult(priorRows?.[0] || null);
      setLoading(false);
    })();
  }, [user, trip_id]);

  const runScan = async () => {
    if (!trip_id || !confirmed) return;
    setScanning(true);
    setError('');
    try {
      const res = await fetch('/api/deep-scan/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id, user_confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error === 'insufficient_credits' ? 'No Deep Scan credits remaining for this trip.' :
                 data?.error === 'trip_not_unlocked' ? 'This trip needs to be unlocked before running a Deep Scan.' :
                 'Deep Scan failed to start. Please try again.');
        setScanning(false);
        return;
      }
      setResults(data.axes);
      setBoundary(data.boundary_statement);
      setScanning(false);
    } catch {
      setError('Network error. Please try again.');
      setScanning(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#888', fontSize: 14 }}>Loading…</div>;
  if (!trip) return <div style={{ padding: 24, color: '#888', fontSize: 14 }}>Trip not found.</div>;

  const displayAxes: AxisResult[] | null =
    results || (priorResult?.axis_results?.axes as AxisResult[] | undefined) || null;
  const displayBoundary = boundary || priorResult?.axis_results?.boundary_statement;

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href="/deep-scan" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All trips
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>
        Deep Scan · {trip.trip_name}
      </h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
        {trip.destination_summary || 'No destination'} · {trip.deep_scan_credits_remaining} credit{trip.deep_scan_credits_remaining === 1 ? '' : 's'} remaining
      </p>

      {!trip.paid_unlock && (
        <div style={{ background: '#f0f4ff', border: '1px solid #dbeafe', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#1e40af', margin: 0, lineHeight: 1.55 }}>
            This trip needs to be unlocked before running a Deep Scan.{' '}
            <Link href={`/trips/${trip_id}`} style={{ color: '#1e40af', fontWeight: 600 }}>Unlock</Link>
          </p>
        </div>
      )}

      {!displayAxes && trip.paid_unlock && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 14px', lineHeight: 1.6 }}>
            Running a Deep Scan consumes <strong>1 credit</strong>. Axes 1–8 run for all trips; axes 9 and 10 run for international trips; axis 11 activates only when authority-driven disruption signals are detected.
          </p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 13, color: '#444', lineHeight: 1.55 }}>
              I understand this will use 1 Deep Scan credit from this trip.
            </span>
          </label>
          <button
            onClick={runScan}
            disabled={!confirmed || scanning || trip.deep_scan_credits_remaining <= 0}
            style={{
              padding: '11px 22px',
              background: !confirmed || scanning || trip.deep_scan_credits_remaining <= 0 ? '#e5e7eb' : '#1A2B4A',
              color: !confirmed || scanning || trip.deep_scan_credits_remaining <= 0 ? '#9ca3af' : 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: confirmed && !scanning && trip.deep_scan_credits_remaining > 0 ? 'pointer' : 'default',
            }}
          >
            {scanning ? 'Running Deep Scan…' : 'Run Deep Scan'}
          </button>
          {error && (
            <p style={{ fontSize: 13, color: '#991b1b', margin: '12px 0 0' }}>{error}</p>
          )}
        </div>
      )}

      {displayAxes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayAxes.map((axis) => (
            <div key={axis.axis_key} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', margin: 0, letterSpacing: '0.04em' }}>AXIS {axis.axis_number}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '2px 0 0' }}>{axis.title}</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: axis.confidence === 'HIGH' ? '#166534' : axis.confidence === 'CONDITIONAL' ? '#92400e' : '#6b7280',
                  background: axis.confidence === 'HIGH' ? '#f0fdf4' : axis.confidence === 'CONDITIONAL' ? '#fef9f0' : '#f3f4f6',
                  border: `1px solid ${axis.confidence === 'HIGH' ? '#bbf7d0' : axis.confidence === 'CONDITIONAL' ? '#fde68a' : '#e5e7eb'}`,
                  borderRadius: 20, padding: '2px 9px',
                }}>
                  {axis.confidence}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px', lineHeight: 1.55 }}>{axis.summary}</p>
              {axis.findings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {axis.findings.map((f, i) => {
                    const s = LEVEL_STYLES[f.level] || LEVEL_STYLES.info;
                    return (
                      <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '10px 12px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: s.fg, margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '2px 0 3px' }}>{f.title}</p>
                        <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.5 }}>{f.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {axis.sources.length > 0 && (
                <p style={{ fontSize: 11, color: '#aaa', margin: '10px 0 0' }}>Sources: {axis.sources.join(', ')}</p>
              )}
            </div>
          ))}

          {displayBoundary && (
            <div style={{ padding: '12px 14px', background: '#f7f8fa', border: '1px solid #eaeaea', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: '#888', margin: 0, lineHeight: 1.55 }}>{displayBoundary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
