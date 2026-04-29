'use client';

import { useEffect, useState } from 'react';

type Outgoing = {
  checkin_id: string;
  requested_of: string;
  created_at: string;
  reminder_sent_at: string | null;
  second_reminder_sent_at: string | null;
  emergency_contact_notified_at: string | null;
};

export default function CheckinEscalationBanner({
  groupId,
  outgoing,
  nameByAccount,
  onCancelled,
}: {
  groupId: string;
  outgoing: Outgoing[];
  nameByAccount: Record<string, string>;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  void tick;

  if (!outgoing.length) return null;

  const cancel = async (checkinId: string) => {
    setBusy(checkinId);
    try {
      const res = await fetch(`/api/travelshield/${groupId}/checkin?checkin_id=${encodeURIComponent(checkinId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) onCancelled();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {outgoing.map((o) => {
        const name = nameByAccount[o.requested_of] || 'Partner';
        const created = new Date(o.created_at).getTime();
        const waitingMin = Math.floor((Date.now() - created) / 60_000);
        const step =
          o.emergency_contact_notified_at != null ? 3 : o.second_reminder_sent_at != null ? 2 : o.reminder_sent_at != null ? 1 : 0;
        const canCancel = !o.emergency_contact_notified_at;
        return (
          <div
            key={o.checkin_id}
            style={{
              padding: 12,
              borderRadius: 10,
              border: '1px solid #fde68a',
              background: '#fffbeb',
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 700 }}>Waiting for {name}&apos;s response… ({waitingMin} min)</div>
            <div style={{ marginTop: 6, color: '#92400e' }}>
              Escalation: {step >= 1 ? '✓' : '○'} reminder (15m) · {step >= 2 ? '✓' : '○'} group alert (30m) ·{' '}
              {step >= 3 ? '✓' : '○'} emergency SMS (45m)
            </div>
            {canCancel ? (
              <button
                type="button"
                disabled={busy === o.checkin_id}
                onClick={() => void cancel(o.checkin_id)}
                style={{
                  marginTop: 8,
                  border: 'none',
                  background: 'none',
                  color: '#b45309',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Cancel check-in
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
