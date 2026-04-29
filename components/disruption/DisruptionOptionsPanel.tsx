'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/auth/supabase-client';

type Props = {
  tripId: string;
  disruptionType?: string | null;
};

type CoverageHints = {
  waitHours: number | null;
  limitAmount: number | null;
  currency: string;
};

export default function DisruptionOptionsPanel({ tripId, disruptionType }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [hints, setHints] = useState<CoverageHints>({ waitHours: null, limitAmount: null, currency: 'USD' });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data: latestSnapshot } = await supabase
        .from('coverage_graph_snapshots')
        .select('snapshot_id')
        .eq('trip_id', tripId)
        .eq('graph_status', 'COMPLETE')
        .order('computation_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const snapshotId = (latestSnapshot as { snapshot_id?: string } | null)?.snapshot_id;
      if (!snapshotId) return;

      const { data: sums } = await supabase
        .from('coverage_summaries')
        .select('benefit_type, shortest_waiting_period_hours, combined_limit, combined_currency')
        .eq('trip_id', tripId)
        .eq('snapshot_id', snapshotId);

      if (cancelled || !sums || sums.length === 0) return;
      const type = String(disruptionType || '').toLowerCase();
      const target = sums.find((row) => {
        const benefit = String(row.benefit_type || '').toLowerCase();
        if (type.includes('baggage')) return benefit.includes('baggage');
        if (type.includes('cancel')) return benefit.includes('cancel');
        return benefit.includes('delay');
      }) || sums[0];

      setHints({
        waitHours: typeof target.shortest_waiting_period_hours === 'number' ? target.shortest_waiting_period_hours : null,
        limitAmount: typeof target.combined_limit === 'number' ? target.combined_limit : null,
        currency: String(target.combined_currency || 'USD'),
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [disruptionType, tripId]);

  const type = String(disruptionType || '').toLowerCase();
  const isDelay = type.includes('delay');
  const isCancellation = type.includes('cancel');
  const isBaggage = type.includes('baggage') || type.includes('luggage');

  const wait = hints.waitHours != null ? `${hints.waitHours}` : 'policy-defined';
  const amount = hints.limitAmount != null ? `${hints.currency} ${hints.limitAmount.toLocaleString('en-US')}` : 'policy-defined limits';

  const content = useMemo(() => {
    if (isCancellation) {
      return [
        ['Get it in writing', 'Request a written cancellation notice from the airline and screenshot the app notification.'],
        ['Document rebooking', 'If rebooked, save the new booking confirmation. If not, record that no rebooking was offered.'],
        ['Track alternative transport costs', 'Keep itemized receipts for replacement transport and related expenses.'],
        ['Know your rights', 'Review EU261 cancellation references and your own coverage details before filing.'],
      ];
    }
    if (isBaggage) {
      return [
        ['File a PIR', 'Complete a Property Irregularity Report at the airport before leaving and photograph it.'],
        ['Keep baggage tags', 'Do not discard tags; photograph them as backup evidence.'],
        ['Track essential purchases', `Your baggage delay benefit may activate after ${wait} hours, up to ${amount}. Keep itemized receipts.`],
        ['Follow up', 'Many bags are found within 24-48 hours. If unresolved after 21 days, document a lost-baggage claim path.'],
      ];
    }
    return [
      ['Document the delay', 'Photograph departure boards and retain all airline notifications.'],
      ['Track your expenses', `Keep itemized receipts. Delay coverage often activates after ${wait} hours with limits up to ${amount}.`],
      ['Know your rights', 'Use regulation references to understand obligations and compensation frameworks.'],
      ['Stay in contact with your airline', 'Ask for written delay-cause confirmation and meal vouchers if provided.'],
    ];
  }, [amount, isBaggage, isCancellation, wait]);

  return (
    <section
      data-testid="disruption-options-panel"
      style={{ marginBottom: 18, border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Active disruption options</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 14px 14px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#334155' }}>
            {isCancellation
              ? 'Your flight has been cancelled. Here are practical next steps based on what you have documented.'
              : isBaggage
                ? 'Your baggage is delayed or lost. Here are practical next steps.'
                : 'Your flight is delayed. Here are practical next steps.'}
          </p>
          <div style={{ display: 'grid', gap: 9 }}>
            {content.map(([title, body], idx) => (
              <div key={title} style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 700 }}>{idx + 1}.</span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.55 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <Link href="/rights#eu261" style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'none' }}>
              View EU261 rights
            </Link>
            <Link href="/rights#montreal" style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'none' }}>
              View Montreal Convention rights
            </Link>
            <Link href={`/trips/${tripId}/coverage`} style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'none' }}>
              View your coverage details
            </Link>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8' }}>
            Guidance reflects your incident record and policy summary data. It does not include live flight status feeds.
          </p>
        </div>
      )}
    </section>
  );
}
