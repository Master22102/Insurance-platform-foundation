'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DraftHomeStepShell from '@/components/draft-home/DraftHomeStepShell';
import { useAuth } from '@/lib/auth/auth-context';
import { evaluateTripReadiness, confirmTripReadiness, type EvaluateTripReadinessResult } from '@/lib/draft-home/draft-home-api';

type Row = {
  key: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning';
  fixHref: string;
};

function fixHrefForAction(tripId: string, action?: string): string {
  const base = `/trips/${tripId}/draft`;
  switch (action) {
    case 'edit_trip_dates':
    case 'add_segment':
    case 'edit_segment':
    case 'review_segment':
      return `${base}/route`;
    case 'edit_trip_details':
      return `${base}/route`;
    case 'resolve_blockers':
      return `${base}/unresolved`;
    default:
      return `${base}/route`;
  }
}

function rowsFromEvaluation(ev: EvaluateTripReadinessResult | null, tripId: string): Row[] {
  const list = ev?.blockers || [];
  return list.map((b, i) => ({
    key: `${b.item_type}-${i}`,
    title: b.item_title || b.item_type,
    description: b.description || '',
    severity: b.severity === 'warning' ? 'warning' : 'critical',
    fixHref: fixHrefForAction(tripId, b.fix_action),
  }));
}

export default function ReadinessPanelPage() {
  const params = useParams();
  const tripId = params?.trip_id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [evaluation, setEvaluation] = useState<EvaluateTripReadinessResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingEval, setLoadingEval] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const runEval = useCallback(async () => {
    if (!tripId || !user) return;
    setLoadingEval(true);
    setError('');
    try {
      const ev = await evaluateTripReadiness({ tripId, actorId: user.id });
      setEvaluation(ev);
      if (!ev.success && ev.error) {
        setRows([]);
        setError(ev.error);
        return;
      }
      setRows(rowsFromEvaluation(ev, tripId));
    } catch (e: any) {
      setError(e?.message || 'Readiness check failed.');
      setEvaluation(null);
      setRows([]);
    } finally {
      setLoadingEval(false);
    }
  }, [tripId, user]);

  useEffect(() => {
    runEval();
  }, [runEval]);

  useEffect(() => {
    if (!confirmed || !tripId) return;
    const t = window.setTimeout(() => {
      router.push(`/trips/${tripId}`);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [confirmed, tripId, router]);

  const isReady = Boolean(evaluation?.ready);
  const notDraft = evaluation?.error === 'Trip is not in DRAFT state';

  async function handleConfirmReady() {
    if (!user) return;
    setError('');
    if (!isReady) {
      setError('Your trip is not ready yet. Fix blockers and tap “Check again”.');
      return;
    }

    setConfirming(true);
    try {
      const data = await confirmTripReadiness({ tripId, actorId: user.id });
      if (!data?.ok) {
        setError(data?.reason || data?.error || 'Confirmation failed.');
        if (data?.evaluation && typeof data.evaluation === 'object') {
          const ev = data.evaluation as EvaluateTripReadinessResult;
          setEvaluation(ev);
          setRows(rowsFromEvaluation(ev, tripId));
        }
        return;
      }
      setConfirmed(true);
    } catch (e: any) {
      setError(e?.message || 'Confirmation failed.');
    } finally {
      setConfirming(false);
    }
  }

  const criticalRows = rows.filter((r) => r.severity === 'critical');
  const warningRows = rows.filter((r) => r.severity === 'warning');

  if (confirmed) {
    return (
      <DraftHomeStepShell
        screenId="S-DRAFT-005"
        tripId={tripId}
        title="Readiness panel"
        step={6}
        total={6}
        backHref={`/trips/${tripId}/draft/unresolved`}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '36px 20px',
            borderRadius: 16,
            border: '1px solid #bbf7d0',
            background: 'linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%)',
          }}
        >
          <p style={{ margin: 0, fontSize: 42, lineHeight: 1 }} aria-hidden>
            ✓
          </p>
          <p style={{ margin: '12px 0 0', fontSize: 18, fontWeight: 900, color: '#14532d' }}>Your trip is ready!</p>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#166534', lineHeight: 1.6 }}>
            Moving you to your trip… Deep Scan unlocks on the Coverage tab once your trip is unlocked.
          </p>
        </div>
      </DraftHomeStepShell>
    );
  }

  return (
    <DraftHomeStepShell
      screenId="S-DRAFT-005"
      tripId={tripId}
      title="Readiness panel"
      step={6}
      total={6}
      backHref={`/trips/${tripId}/draft/unresolved`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            background: notDraft ? '#eff6ff' : isReady ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${notDraft ? '#bfdbfe' : isReady ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: 12,
            padding: '18px 16px',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#1A2B4A' }}>
            {loadingEval
              ? 'Checking readiness…'
              : notDraft
                ? `Trip state: ${evaluation?.current_state || '—'}`
                : isReady
                  ? 'Your trip passes the readiness gate'
                  : 'Not ready yet'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            {loadingEval
              ? 'Running server evaluation (dates, destination, segments, route timing).'
              : notDraft
                ? 'This trip is no longer in DRAFT. Deep Scan uses PRE_TRIP_STRUCTURED or later.'
                : isReady
                  ? 'Confirm to move to PRE_TRIP_STRUCTURED and unlock Deep Scan.'
                  : 'Fix blockers below. Warnings (for example tight connections) do not block confirmation.'}
          </p>
        </div>

        {error ? <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => runEval()}
            disabled={loadingEval || !user}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: 'white',
              fontWeight: 800,
              fontSize: 13,
              cursor: loadingEval ? 'wait' : 'pointer',
            }}
          >
            Check again
          </button>
        </div>

        {!loadingEval && criticalRows.length > 0 ? (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#1A2B4A' }}>Blockers</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {criticalRows.map((b) => (
                <div key={b.key} style={{ border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px', background: '#fffbeb' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 950, color: '#1A2B4A' }}>{b.title}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>{b.description}</p>
                  <button
                    type="button"
                    onClick={() => router.push(b.fixHref)}
                    style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Fix now
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loadingEval && warningRows.length > 0 ? (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 16px' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#1A2B4A' }}>Warnings</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {warningRows.map((b) => (
                <div key={b.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#92400e' }}>{b.title}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#666', lineHeight: 1.6 }}>{b.description}</p>
                  <button
                    type="button"
                    onClick={() => router.push(b.fixHref)}
                    style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      background: 'white',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleConfirmReady}
            disabled={!user || loadingEval || !isReady || confirming || confirmed || notDraft}
            style={{
              flex: 1,
              padding: '12px 0',
              background: !user || loadingEval || !isReady || confirming || confirmed || notDraft ? '#93afd4' : '#1A2B4A',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 900,
              cursor: !user || loadingEval || !isReady || confirming || confirmed || notDraft ? 'not-allowed' : 'pointer',
            }}
          >
            {confirming ? 'Confirming…' : confirmed ? 'Confirmed' : 'Confirm trip is ready'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}`)}
            style={{
              padding: '12px 16px',
              background: 'white',
              border: '1px solid #e5e7eb',
              color: '#555',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Go to trip
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
          Server RPCs: <code>evaluate_trip_readiness</code> → <code>confirm_trip_readiness</code> (sets PRE_TRIP_STRUCTURED + itinerary hash + events).
        </p>
      </div>
    </DraftHomeStepShell>
  );
}
