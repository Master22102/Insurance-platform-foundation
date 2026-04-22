'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

interface LedgerRow {
  ledger_id: string;
  credit_type: string;
  credit_delta: number;
  balance_after: number | null;
  reason: string;
  created_at: string;
}

interface TripCredits {
  trip_id: string;
  trip_name: string;
  deep_scan_credits_remaining: number;
  deep_scan_credits_purchased: number;
}

const PACKAGES = [
  { credits: 1, price: 44.99, label: '1 Deep Scan credit' },
  { credits: 3, price: 119.99, label: '3 Deep Scan credits', note: 'Best value' },
];

export default function CreditsPage() {
  const { user } = useAuth();
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [trips, setTrips] = useState<TripCredits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [ledgerRes, tripRes] = await Promise.all([
        supabase.from('scan_credit_ledger').select('*').eq('account_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('trips').select('trip_id, trip_name, deep_scan_credits_remaining, deep_scan_credits_purchased').eq('account_id', user.id).is('archived_at', null).eq('paid_unlock', true).order('created_at', { ascending: false }),
      ]);
      setLedger((ledgerRes.data || []) as LedgerRow[]);
      setTrips((tripRes.data || []) as TripCredits[]);
      if (tripRes.data?.[0]) setSelectedTrip(tripRes.data[0].trip_id);
      setLoading(false);
    })();
  }, [user]);

  const purchase = async (credits: number) => {
    if (!selectedTrip || !user) {
      setError('Select a trip first.');
      return;
    }
    setPurchasing(true);
    setError('');
    setSuccess('');
    const { error: rpcErr } = await supabase.rpc('add_deep_scan_credits', {
      p_trip_id: selectedTrip,
      p_actor_id: user.id,
      p_credits: credits,
      p_payment_ref: `sim_${Date.now()}`,
    });
    if (rpcErr) {
      setError(rpcErr.message || 'Purchase failed.');
      setPurchasing(false);
      return;
    }
    setSuccess(`Added ${credits} Deep Scan credit${credits === 1 ? '' : 's'} to your trip.`);
    const [ledgerRes, tripRes] = await Promise.all([
      supabase.from('scan_credit_ledger').select('*').eq('account_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('trips').select('trip_id, trip_name, deep_scan_credits_remaining, deep_scan_credits_purchased').eq('account_id', user.id).is('archived_at', null).eq('paid_unlock', true).order('created_at', { ascending: false }),
    ]);
    setLedger((ledgerRes.data || []) as LedgerRow[]);
    setTrips((tripRes.data || []) as TripCredits[]);
    setPurchasing(false);
  };

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href="/account" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Account
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>Scan credits</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.55 }}>
        Deep Scan credits are scoped per trip. Each credit runs a full 10+1 axis analysis.
      </p>

      <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '22px 24px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 12px' }}>Purchase credits</p>
        {trips.length === 0 ? (
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            You don't have any unlocked trips yet. <Link href="/trips/new" style={{ color: '#2E5FA3' }}>Create a trip</Link> and unlock it first.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#666', fontWeight: 500, display: 'block', marginBottom: 4 }}>Apply to trip</label>
              <select
                value={selectedTrip}
                onChange={(e) => setSelectedTrip(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 8, background: 'white' }}
              >
                {trips.map((t) => (
                  <option key={t.trip_id} value={t.trip_id}>
                    {t.trip_name} · {t.deep_scan_credits_remaining} credit{t.deep_scan_credits_remaining === 1 ? '' : 's'} remaining
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {PACKAGES.map((p) => (
                <button
                  key={p.credits}
                  onClick={() => purchase(p.credits)}
                  disabled={purchasing || !selectedTrip}
                  style={{
                    padding: '14px 16px', textAlign: 'left',
                    border: '1px solid #e5e7eb', borderRadius: 10,
                    background: purchasing ? '#f7f8fa' : 'white',
                    cursor: purchasing || !selectedTrip ? 'not-allowed' : 'pointer',
                    opacity: purchasing ? 0.6 : 1,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>{p.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#2E5FA3', margin: 0 }}>${p.price.toFixed(2)}</p>
                  {p.note && <p style={{ fontSize: 11, color: '#16a34a', margin: '4px 0 0', fontWeight: 600 }}>{p.note}</p>}
                </button>
              ))}
            </div>
            {error && <p style={{ fontSize: 13, color: '#991b1b', margin: '12px 0 0' }}>{error}</p>}
            {success && <p style={{ fontSize: 13, color: '#166534', margin: '12px 0 0' }}>{success}</p>}
          </>
        )}
      </div>

      <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 12px' }}>Ledger</p>
        {loading ? (
          <p style={{ fontSize: 13, color: '#888' }}>Loading…</p>
        ) : ledger.length === 0 ? (
          <p style={{ fontSize: 13, color: '#888' }}>No credit activity yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ledger.map((row, i) => (
              <div key={row.ledger_id} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>
                    {row.reason.replace(/_/g, ' ')}
                  </p>
                  <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
                    {new Date(row.created_at).toLocaleString()} · {row.credit_type}
                  </p>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: row.credit_delta > 0 ? '#166534' : '#991b1b',
                }}>
                  {row.credit_delta > 0 ? '+' : ''}{row.credit_delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
