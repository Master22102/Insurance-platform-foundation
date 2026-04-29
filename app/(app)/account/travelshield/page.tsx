'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import CreateGroupSheet from '@/components/travelshield/CreateGroupSheet';
import AppPageRoot from '@/components/layout/AppPageRoot';

type Row = {
  group_id: string;
  travelshield_groups: { trip_id: string | null; group_status: string; created_at: string } | null;
};

export default function AccountTravelShieldPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tripChoice, setTripChoice] = useState<string>('');
  const [tripList, setTripList] = useState<{ trip_id: string; trip_name: string }[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('travelshield_members')
      .select('group_id, travelshield_groups ( trip_id, group_status, created_at )')
      .eq('account_id', user.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });
    if (error || !data) setRows([]);
    else {
      const normalized = (data as { group_id: string; travelshield_groups: unknown }[]).map((r) => {
        const g = r.travelshield_groups;
        const rel = Array.isArray(g) ? g[0] : g;
        return {
          group_id: r.group_id,
          travelshield_groups: (rel as Row['travelshield_groups']) ?? null,
        };
      });
      setRows(normalized);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('trips')
      .select('trip_id, trip_name')
      .eq('account_id', user.id)
      .is('archived_at', null)
      .order('departure_date', { ascending: false })
      .limit(40)
      .then(({ data }) => setTripList(data ?? []));
  }, [user?.id]);

  useEffect(() => {
    if (tripList.length === 0) return;
    setTripChoice((c) => (c && tripList.some((t) => t.trip_id === c) ? c : tripList[0].trip_id));
  }, [tripList]);

  const openCreate = () => {
    if (tripList.length === 0) {
      alert('Create a trip first, then start TravelShield from the trip overview or here after you have trips.');
      return;
    }
    setSheetOpen(true);
  };

  return (
    <AppPageRoot style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href="/account" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
        ← Account
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '16px 0 8px' }}>TravelShield</h1>
      <p style={{ color: '#64748b', lineHeight: 1.55, marginBottom: 24 }}>
        Mutual-consent safety groups for trips — QR or link only, 2–8 people, equal permissions.
      </p>

      {tripList.length > 1 ? (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            New groups attach to trip
          </label>
          <select
            value={tripChoice}
            onChange={(e) => setTripChoice(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 14,
            }}
          >
            {tripList.map((t) => (
              <option key={t.trip_id} value={t.trip_id}>
                {t.trip_name || 'Trip'} ({t.trip_id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button
        type="button"
        onClick={openCreate}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background: '#1e3a8a',
          color: 'white',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
          marginBottom: 20,
        }}
      >
        Create new group
      </button>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Active groups
      </h2>
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#64748b' }}>No active TravelShield groups.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {rows.map((r) => (
            <li
              key={r.group_id}
              style={{
                padding: '12px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                marginBottom: 8,
              }}
            >
              <span style={{ fontWeight: 600, color: '#0f172a' }}>Group</span>{' '}
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.group_id.slice(0, 8)}…</span>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Status: {r.travelshield_groups?.group_status ?? '—'}
                {r.travelshield_groups?.trip_id ? (
                  <>
                    {' · '}
                    <Link href={`/trips/${r.travelshield_groups.trip_id}?tab=Overview`} style={{ color: '#1e3a8a' }}>
                      Open trip
                    </Link>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>About TravelShield</h2>
        <section style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>What is TravelShield?</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
            TravelShield is a mutual-consent safety layer for people traveling together or meeting on the road. You connect only via QR code
            or invite link — no username search. Each person keeps their own check-in preferences, lock code, and emergency contact.
          </p>
        </section>
        <section style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>Traveling with a friend?</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
            Start a group from your trip, show the QR code or share the link, and both choose trust presets that match how well you know each
            other. Phase 2 adds live location and structured check-ins.
          </p>
        </section>
        <section style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>Met someone at a hostel?</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
            Solo trips are supported. Use a stricter preset like &quot;Just met&quot; with shorter check-in intervals until you are comfortable.
          </p>
        </section>
        <section style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>What if something goes wrong?</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
            Phase 2 introduces check-in requests and escalation paths to your own emergency contacts if someone does not respond — without
            exposing those contacts to other group members.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>Your privacy</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
            Location tables are provisioned in Phase 1; GPS data flows only when you enable Phase 2 location sharing. Pings are designed for
            rolling retention (e.g. 30-day cleanup) to limit how long raw points are kept.
          </p>
        </section>
      </div>

      {sheetOpen && tripChoice ? (
        <CreateGroupSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            void load();
          }}
          tripId={tripChoice}
          onGroupCreated={() => void load()}
        />
      ) : null}
    </AppPageRoot>
  );
}
