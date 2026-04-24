'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

interface ChecklistItem {
  item_id: string;
  label: string;
  category: string;
  status: string;
  participant_name?: string;
  source?: string;
}

const CATEGORY_ORDER = ['Entry Requirements', 'Health Requirements', 'Platform Documents', 'Emergency Preparedness'];

const STATUS_STYLE: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  not_started: { bg: '#f7f8fa', border: '#e5e7eb', fg: '#64748b', label: 'Not started' },
  uploaded:    { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af', label: 'Uploaded' },
  verified:   { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534', label: 'Verified' },
  waived:     { bg: '#fef9f0', border: '#fde68a', fg: '#92400e', label: 'Waived' },
};

export default function TripChecklistPage() {
  const { trip_id } = useParams<{ trip_id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !trip_id) return;
    (async () => {
      const [tripRes, readinessRes] = await Promise.all([
        supabase.from('trips').select('*').eq('trip_id', trip_id).maybeSingle(),
        supabase.rpc('evaluate_trip_readiness', { p_trip_id: trip_id }),
      ]);
      setTrip(tripRes.data);
      const raw = readinessRes.data;
      if (raw && typeof raw === 'object') {
        const arr = Array.isArray(raw) ? raw
          : Array.isArray((raw as any).items) ? (raw as any).items
          : [];
        setItems(arr.map((it: any, i: number) => ({
          item_id: it.item_id || it.id || `item-${i}`,
          label: it.label || it.name || it.requirement || 'Requirement',
          category: it.category || 'Platform Documents',
          status: it.status || 'not_started',
          participant_name: it.participant_name || it.participant,
          source: it.source || it.source_authority,
        })));
      }
      setLoading(false);
    })();
  }, [user, trip_id]);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((it) => it.category === cat),
  })).filter((g) => g.items.length > 0);

  const allComplete = items.length > 0 && items.every((it) => it.status === 'verified' || it.status === 'waived');
  const completionPct = items.length > 0
    ? Math.round((items.filter((it) => it.status === 'verified' || it.status === 'waived').length / items.length) * 100)
    : 0;

  const confirmReadiness = async () => {
    if (!user) return;
    setConfirming(true);
    setError('');
    const { error: rpcErr } = await supabase.rpc('confirm_trip_readiness', {
      p_trip_id: trip_id,
      p_actor_id: user.id,
    });
    if (rpcErr) setError(rpcErr.message || 'Could not confirm readiness.');
    setConfirming(false);
  };

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to trip
      </Link>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Requirements checklist</h1>
        {items.length > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, color: completionPct === 100 ? '#166534' : '#64748b' }}>
            {completionPct}% complete
          </span>
        )}
      </div>

      {trip && (
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
          {trip.name || trip.destination || 'Trip'}{trip.depart_date ? ` — departs ${new Date(trip.depart_date).toLocaleDateString()}` : ''}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Evaluating requirements...</p>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'white', borderRadius: 12, border: '0.5px solid #e8e8e8' }}>
          <p style={{ fontSize: 14, color: '#555', margin: 0 }}>
            No checklist items yet. Add route segments and policies to generate requirements.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map((g) => (
            <div key={g.category}>
              <h2 style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                {g.category}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.items.map((it) => {
                  const st = STATUS_STYLE[it.status] || STATUS_STYLE.not_started;
                  return (
                    <Link
                      key={it.item_id}
                      href={`/trips/${trip_id}/checklist/${it.item_id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 10,
                        background: 'white', border: '0.5px solid #e8e8e8',
                        textDecoration: 'none', gap: 10, transition: 'border-color 0.12s ease',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#1A2B4A', margin: 0 }}>{it.label}</p>
                        {it.participant_name && (
                          <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>{it.participant_name}</p>
                        )}
                        {it.source && (
                          <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>{it.source}</p>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: st.fg,
                        background: st.bg, border: `1px solid ${st.border}`,
                        borderRadius: 20, padding: '3px 10px',
                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                      }}>
                        {st.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <button
            onClick={confirmReadiness}
            disabled={!allComplete || confirming}
            style={{
              padding: '12px 24px', borderRadius: 10,
              background: allComplete && !confirming ? 'linear-gradient(135deg, #2E5FA3, #1A2B4A)' : '#e5e7eb',
              border: 'none', color: allComplete ? 'white' : '#999',
              fontSize: 14, fontWeight: 600,
              cursor: allComplete && !confirming ? 'pointer' : 'not-allowed',
            }}
          >
            {confirming ? 'Confirming...' : 'Confirm readiness'}
          </button>
          {!allComplete && (
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
              Complete all required items before confirming.
            </p>
          )}
          {error && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#aaa', margin: '32px 0 0', lineHeight: 1.55 }}>
        Checklist items are informational — verify requirements with official sources.
      </p>
    </div>
  );
}
