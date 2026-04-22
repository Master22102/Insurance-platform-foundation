'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { DEEP_SCAN_AXES } from '@/lib/deep-scan/axes';

interface TripOption {
  trip_id: string;
  trip_name: string;
  destination_summary: string | null;
  paid_unlock: boolean;
  deep_scan_credits_remaining: number;
}

export default function DeepScanIndexPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('trips')
      .select('trip_id, trip_name, destination_summary, paid_unlock, deep_scan_credits_remaining')
      .eq('account_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTrips((data || []) as TripOption[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <div style={{ maxWidth: 780, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
          Deep Scan
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.5 }}>
          Ten intelligence axes run against your specific itinerary. On-demand eleventh axis activates when authority-driven disruption signals are detected.
        </p>
      </div>

      <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 14px' }}>The ten axes</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {DEEP_SCAN_AXES.filter(a => a.scope !== 'on_demand').map((a) => (
            <div key={a.key} style={{ padding: '10px 12px', background: '#f7f8fa', borderRadius: 8, border: '1px solid #eee' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2E5FA3', margin: 0, letterSpacing: '0.03em' }}>AXIS {a.number}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '2px 0 4px' }}>{a.title}</p>
              <p style={{ fontSize: 11, color: '#666', margin: 0, lineHeight: 1.5 }}>{a.description}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef9f0', border: '1px solid #fde68a', borderRadius: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: 0, letterSpacing: '0.03em' }}>AXIS 11 — ON DEMAND</p>
          <p style={{ fontSize: 12, color: '#78350f', margin: '3px 0 0', lineHeight: 1.5 }}>
            Authority-Driven Disruption. Activates only when authority-driven signals are detected on your route.
          </p>
        </div>
      </div>

      <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 14px' }}>Choose a trip to scan</p>
        {loading ? (
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Loading trips…</p>
        ) : trips.length === 0 ? (
          <div>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px', lineHeight: 1.55 }}>
              You don't have any trips yet. Create one to run a Deep Scan.
            </p>
            <Link href="/trips/new" style={{ display: 'inline-block', padding: '9px 18px', background: '#1A2B4A', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              Plan a trip
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trips.map((t) => (
              <Link
                key={t.trip_id}
                href={`/deep-scan/${t.trip_id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', background: '#f7f8fa', borderRadius: 8,
                  border: '1px solid #eee', textDecoration: 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{t.trip_name}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
                    {t.destination_summary || 'No destination set'} · {t.deep_scan_credits_remaining} credit{t.deep_scan_credits_remaining === 1 ? '' : 's'}
                    {!t.paid_unlock && ' · locked'}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
