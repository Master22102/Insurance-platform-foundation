'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';

type DisruptionType = 'delay' | 'cancellation' | 'baggage' | string;

type TrackerStep = {
  key: string;
  label: string;
  done: boolean;
  timestamp?: string | null;
  actionHint?: string;
  actionCta?: string;
  onAction?: () => void;
};

type Props = {
  tripId: string;
  incidentId: string;
  disruptionType?: DisruptionType | null;
  incidentCreatedAt?: string | null;
  evidence: Array<Record<string, unknown>>;
  carrierResponses: Array<Record<string, unknown>>;
  onOpenEvidenceUpload?: () => void;
  onOpenCarrierForm?: () => void;
  onOpenClaimRouting?: () => void;
  onOpenCoverageTab?: () => void;
};

type DerivedSignals = {
  coverageCheckedAt: string | null;
  claimFiledAt: string | null;
  outcomeAt: string | null;
};

function fmt(ts?: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function inferActiveIndex(steps: TrackerStep[]): number {
  const firstFuture = steps.findIndex((s) => !s.done);
  return firstFuture === -1 ? steps.length - 1 : firstFuture;
}

export default function ResolutionTracker(props: Props) {
  const {
    tripId,
    incidentId,
    disruptionType,
    incidentCreatedAt,
    evidence,
    carrierResponses,
    onOpenEvidenceUpload,
    onOpenCarrierForm,
    onOpenClaimRouting,
    onOpenCoverageTab,
  } = props;

  const [signals, setSignals] = useState<DerivedSignals>({
    coverageCheckedAt: null,
    claimFiledAt: null,
    outcomeAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [snapshotRes, claimRes] = await Promise.all([
        supabase
          .from('coverage_graph_snapshots')
          .select('computation_timestamp')
          .eq('trip_id', tripId)
          .eq('graph_status', 'COMPLETE')
          .order('computation_timestamp', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('claims')
          .select('created_at, claim_status, outcome, outcome_recorded_at')
          .eq('incident_id', incidentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      const claim = claimRes.data as
        | { created_at?: string | null; claim_status?: string | null; outcome?: string | null; outcome_recorded_at?: string | null }
        | null;
      const claimStatus = String(claim?.claim_status || '').toLowerCase();
      const claimFiled = Boolean(claim && claimStatus && claimStatus !== 'initiated');
      const outcomeAt = claim?.outcome ? (claim?.outcome_recorded_at || claim?.created_at || null) : null;

      setSignals({
        coverageCheckedAt: (snapshotRes.data as { computation_timestamp?: string | null } | null)?.computation_timestamp || null,
        claimFiledAt: claimFiled ? (claim?.created_at || null) : null,
        outcomeAt,
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [incidentId, tripId]);

  const normalizedType = String(disruptionType || '').toLowerCase();
  const isDelay = normalizedType.includes('delay');
  const isCancellation = normalizedType.includes('cancel');
  const isBaggage = normalizedType.includes('baggage') || normalizedType.includes('luggage');

  const hasCarrierContact = carrierResponses.length > 0;
  const hasCarrierResponse = carrierResponses.some((row) => String(row.action_type || '') !== 'no_response');
  const rebookingKnown = carrierResponses.some((row) => String(row.action_type || '').startsWith('rebooking_'));
  const pirFiled = carrierResponses.some((row) => String(row.action_type || '') === 'baggage_claim_filed');
  const expensesCaptured = evidence.some((ev) => {
    const category = String((ev.evidence_category || (ev as { category?: unknown }).category || '')).toLowerCase();
    const md = (ev.metadata && typeof ev.metadata === 'object') ? (ev.metadata as Record<string, unknown>) : {};
    const mdCategory = String(md.category || '').toLowerCase();
    return ['receipt', 'expense'].includes(category) || ['receipt', 'expense'].includes(mdCategory);
  });

  const steps = useMemo<TrackerStep[]>(() => {
    const documentedStep: TrackerStep = {
      key: 'documented',
      label: isCancellation ? 'Cancellation documented' : isBaggage ? 'Loss reported' : 'Delay documented',
      done: Boolean(disruptionType),
      timestamp: incidentCreatedAt || null,
    };

    const coverageStep: TrackerStep = {
      key: 'coverage_checked',
      label: 'Coverage checked',
      done: Boolean(signals.coverageCheckedAt),
      timestamp: signals.coverageCheckedAt,
      actionHint: 'Run coverage check to map policy limits and waiting periods.',
      actionCta: 'Run coverage check',
      onAction: onOpenCoverageTab,
    };

    const claimStep: TrackerStep = {
      key: 'claim_filed',
      label: 'Claim filed',
      done: Boolean(signals.claimFiledAt),
      timestamp: signals.claimFiledAt,
      actionHint: 'Route this incident into a structured claim packet.',
      actionCta: 'Route claim',
      onAction: onOpenClaimRouting,
    };

    const outcomeStep: TrackerStep = {
      key: 'outcome',
      label: 'Outcome',
      done: Boolean(signals.outcomeAt),
      timestamp: signals.outcomeAt,
    };

    if (isCancellation) {
      return [
        documentedStep,
        {
          key: 'rebooking_status',
          label: 'Rebooking status',
          done: rebookingKnown,
          timestamp: rebookingKnown ? String(carrierResponses[carrierResponses.length - 1]?.created_at || '') : null,
          actionHint: 'Record whether rebooking was offered or declined.',
          actionCta: 'Add carrier action',
          onAction: onOpenCarrierForm,
        },
        coverageStep,
        {
          key: 'expenses_captured',
          label: 'Expenses captured',
          done: expensesCaptured,
          timestamp: expensesCaptured ? String(evidence[0]?.created_at || '') : null,
          actionHint: 'Upload receipts for replacement transport, meals, or lodging.',
          actionCta: 'Upload receipt',
          onAction: onOpenEvidenceUpload,
        },
        claimStep,
        outcomeStep,
      ];
    }

    if (isBaggage) {
      return [
        documentedStep,
        {
          key: 'pir_filed',
          label: 'PIR filed',
          done: pirFiled,
          timestamp: pirFiled ? String(carrierResponses[carrierResponses.length - 1]?.created_at || '') : null,
          actionHint: 'Record your PIR or baggage desk report reference.',
          actionCta: 'Add carrier action',
          onAction: onOpenCarrierForm,
        },
        coverageStep,
        {
          key: 'expenses_tracked',
          label: 'Expenses tracked',
          done: expensesCaptured,
          timestamp: expensesCaptured ? String(evidence[0]?.created_at || '') : null,
          actionHint: 'Upload essential purchase receipts for delayed baggage.',
          actionCta: 'Upload receipt',
          onAction: onOpenEvidenceUpload,
        },
        claimStep,
        outcomeStep,
      ];
    }

    return [
      documentedStep,
      coverageStep,
      {
        key: 'carrier_contacted',
        label: 'Carrier contacted',
        done: hasCarrierContact,
        timestamp: hasCarrierContact ? String(carrierResponses[carrierResponses.length - 1]?.created_at || '') : null,
        actionHint: 'Log your airline contact attempt or message.',
        actionCta: 'Add carrier action',
        onAction: onOpenCarrierForm,
      },
      {
        key: 'carrier_response',
        label: 'Carrier response',
        done: hasCarrierResponse,
        timestamp: hasCarrierResponse ? String(carrierResponses[carrierResponses.length - 1]?.created_at || '') : null,
        actionHint: 'Upload the carrier email or update the response record.',
        actionCta: 'Upload response',
        onAction: onOpenEvidenceUpload,
      },
      claimStep,
      outcomeStep,
    ];
  }, [
    carrierResponses,
    disruptionType,
    evidence,
    expensesCaptured,
    hasCarrierContact,
    hasCarrierResponse,
    incidentCreatedAt,
    isBaggage,
    isCancellation,
    onOpenCarrierForm,
    onOpenClaimRouting,
    onOpenCoverageTab,
    onOpenEvidenceUpload,
    pirFiled,
    rebookingKnown,
    signals.claimFiledAt,
    signals.coverageCheckedAt,
    signals.outcomeAt,
  ]);

  const activeIndex = inferActiveIndex(steps);

  return (
    <section
      data-testid="resolution-tracker"
      style={{
        marginBottom: 16,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Resolution tracker
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {steps.map((step, idx) => {
          const done = step.done;
          const active = idx === activeIndex && !done;
          const connectorDone = idx < activeIndex;
          return (
            <div key={step.key} style={{ minWidth: 130, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ marginTop: 1 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: done ? '1px solid #16a34a' : active ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                    background: done ? '#16a34a' : active ? '#f59e0b' : '#fff',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    boxShadow: active ? '0 0 0 6px rgba(245, 158, 11, 0.14)' : 'none',
                  }}
                >
                  {done ? '✓' : ''}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      width: 42,
                      height: 2,
                      background: connectorDone ? '#16a34a' : '#d1d5db',
                      marginTop: 8,
                      marginLeft: 20,
                    }}
                  />
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{step.label}</p>
                {done ? (
                  <p style={{ margin: 0, fontSize: 11, color: '#16a34a' }}>{fmt(step.timestamp)}</p>
                ) : active ? (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#92400e', lineHeight: 1.45 }}>{step.actionHint || 'Continue documenting this incident.'}</p>
                    {step.onAction && step.actionCta ? (
                      <button
                        type="button"
                        onClick={step.onAction}
                        style={{
                          border: '1px solid #fcd34d',
                          background: '#fffbeb',
                          color: '#92400e',
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {step.actionCta}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Pending</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
