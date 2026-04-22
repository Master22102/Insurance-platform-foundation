'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

interface PinState {
  item_key: string;
  status: string;
  assist_mode: string;
}

export default function ReadinessPage() {
  const { trip_id } = useParams<{ trip_id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [pins, setPins] = useState<PinState[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    if (!user) return;
    const [{ data: tripRow }, { data: evalData, error: evalErr }, { data: pinRows }] = await Promise.all([
      supabase.from('trips').select('trip_id, trip_name, destination_summary').eq('trip_id', trip_id).maybeSingle(),
      supabase.rpc('evaluate_trip_readiness', { p_trip_id: trip_id, p_actor_id: user.id }),
      supabase.from('readiness_pin_states').select('item_key, status, assist_mode').eq('trip_id', trip_id).eq('user_id', user.id),
    ]);
    setTrip(tripRow);
    if (evalErr) setError(evalErr.message);
    setEvalResult(evalData);
    setPins(pinRows || []);
    setLoading(false);
  };

  useEffect(() => { if (user && trip_id) load(); }, [user, trip_id]);

  const confirm = async () => {
    if (!user) return;
    setConfirming(true);
    setError('');
    setSuccess('');
    const { error: rpcErr } = await supabase.rpc('confirm_trip_readiness', {
      p_trip_id: trip_id,
      p_actor_id: user.id,
    });
    setConfirming(false);
    if (rpcErr) {
      setError(rpcErr.message || 'Could not confirm readiness.');
      return;
    }
    setSuccess('Readiness confirmed.');
    await load();
  };

  const items: any[] = Array.isArray(evalResult?.items) ? evalResult.items
    : Array.isArray(evalResult?.checklist) ? evalResult.checklist : [];

  const pinMap = new Map(pins.map((p) => [p.item_key, p]));

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to trip
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>
        Readiness checklist{trip ? ` · ${trip.trip_name}` : ''}
      </h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.55 }}>
        We surface what we can verify, what you need to confirm, and what falls outside our scope.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: '#888' }}>Loading...</p>
      ) : (
        <>
          {evalResult?.overall_state && (
            <div style={{
              background: '#f7f9fc', border: '1px solid #e0e8f4',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1A2B4A',
            }}>
              Overall state: <strong>{String(evalResult.overall_state).replace(/_/g, ' ')}</strong>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.length === 0 ? (
              <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '16px 18px' }}>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>No readiness items yet.</p>
              </div>
            ) : items.map((it: any, i: number) => {
              const key = it.item_key || it.key || `item_${i}`;
              const pinned = pinMap.get(key);
              const state = pinned?.status || it.status || 'pending';
              return (
                <div key={key} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{it.title || key.replace(/_/g, ' ')}</p>
                      {it.description && <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0', lineHeight: 1.5 }}>{it.description}</p>}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: state === 'confirmed' ? '#166534' : state === 'out_of_scope' ? '#6b7280' : '#92400e',
                      background: state === 'confirmed' ? '#f0fdf4' : state === 'out_of_scope' ? '#f3f4f6' : '#fef9f0',
                      border: `1px solid ${state === 'confirmed' ? '#bbf7d0' : state === 'out_of_scope' ? '#e5e7eb' : '#fde68a'}`,
                      borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {state.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={confirm}
              disabled={confirming}
              style={{
                padding: '10px 20px',
                background: confirming ? '#93afd4' : '#1A2B4A',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: confirming ? 'not-allowed' : 'pointer',
              }}
            >
              {confirming ? 'Confirming...' : 'Confirm readiness'}
            </button>
            {success && <p style={{ fontSize: 13, color: '#166534', margin: 0 }}>{success}</p>}
          </div>
          {error && <p style={{ fontSize: 13, color: '#991b1b', margin: '10px 0 0' }}>{error}</p>}
        </>
      )}
    </div>
  );
}
