'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MemberAvatar, { disambiguatedLabels, type PresenceStatus } from './MemberAvatar';
import QRCodeDisplay from './QRCodeDisplay';
import ConfigureSheet from './ConfigureSheet';
import MemberLocationCard from './MemberLocationCard';
import CheckinRequestCard from './CheckinRequestCard';
import CheckinEscalationBanner from './CheckinEscalationBanner';
import GroupCoverageDashboard from './GroupCoverageDashboard';
import type { MemberLocation } from './GroupMapView';
import { startTracking, stopTracking, getBatteryStatus, type ActiveTracker } from '@/lib/travelshield/location-tracker';
import { sendLocationPing } from '@/lib/travelshield/ping-sender';

const GroupMapView = dynamic(() => import('./GroupMapView'), { ssr: false, loading: () => null });

type MemberRow = {
  member_id: string;
  account_id: string;
  display_name: string;
  joined_at: string;
  status: string;
  is_self?: boolean;
};

type LocRow = {
  account_id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters?: number | null;
  battery_level?: number | null;
  connection_type?: string | null;
  is_moving?: boolean | null;
  created_at: string;
};

function presenceFromPing(createdAt: string | null, battery: number | null | undefined): PresenceStatus {
  if (battery != null && battery < 10) return 'offline';
  if (!createdAt) return 'offline';
  const m = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  if (m <= 5) return 'online';
  if (m <= 30) return 'recent';
  return 'offline';
}

export default function ActiveGroupCard({
  groupId,
  tripId,
}: {
  groupId: string;
  tripId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groupStatus, setGroupStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<{ token: string; expires_at: string; uses_count: number; max_uses: number } | null>(null);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState('');
  const [locations, setLocations] = useState<LocRow[]>([]);
  const [locDisabled, setLocDisabled] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [checkinPicker, setCheckinPicker] = useState(false);
  const [incomingCheckins, setIncomingCheckins] = useState<
    Array<{ checkin_id: string; requested_by: string; created_at: string }>
  >([]);
  const [outgoingCheckins, setOutgoingCheckins] = useState<
    Array<{
      checkin_id: string;
      requested_of: string;
      created_at: string;
      reminder_sent_at: string | null;
      second_reminder_sent_at: string | null;
      emergency_contact_notified_at: string | null;
    }>
  >([]);
  const [selfPos, setSelfPos] = useState<{ lat: number; lng: number } | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const trackerRef = useRef<ActiveTracker | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/travelshield/${groupId}`, { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMembers([]);
        setLoading(false);
        return;
      }
      setGroupStatus((j as { group?: { group_status?: string } }).group?.group_status ?? '');
      setMembers(((j as { members?: MemberRow[] }).members ?? []) as MemberRow[]);
    } catch {
      setMembers([]);
    }
    setLoading(false);
  }, [groupId]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/travelshield/${groupId}/locations`, { credentials: 'include' });
      if (res.status === 403) {
        setLocDisabled(true);
        setLocations([]);
        return;
      }
      if (!res.ok) return;
      const j = (await res.json()) as { locations?: LocRow[] };
      setLocDisabled(false);
      setLocations(j.locations ?? []);
    } catch {
      /* ignore */
    }
  }, [groupId]);

  const loadCheckins = useCallback(async () => {
    try {
      const res = await fetch(`/api/travelshield/${groupId}/checkin`, { credentials: 'include' });
      if (res.status === 403) return;
      if (!res.ok) return;
      const j = (await res.json()) as { incoming?: typeof incomingCheckins; outgoing?: typeof outgoingCheckins };
      setIncomingCheckins(j.incoming ?? []);
      setOutgoingCheckins(j.outgoing ?? []);
    } catch {
      /* ignore */
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadLocations();
    const t = setInterval(() => void loadLocations(), 30_000);
    return () => clearInterval(t);
  }, [loadLocations]);

  useEffect(() => {
    void loadCheckins();
    const t = setInterval(() => void loadCheckins(), 20_000);
    return () => clearInterval(t);
  }, [loadCheckins]);

  useEffect(() => {
    return () => {
      stopTracking(trackerRef.current);
      trackerRef.current = null;
    };
  }, []);

  const names = members.map((m) => m.display_name || 'Partner');
  const labels = disambiguatedLabels(names);

  const locByAccount = useMemo(() => {
    const m = new Map<string, LocRow>();
    for (const l of locations) m.set(l.account_id, l);
    return m;
  }, [locations]);

  const nameByAccount = useMemo(() => {
    const o: Record<string, string> = {};
    for (const mem of members) o[mem.account_id] = mem.display_name;
    return o;
  }, [members]);

  const mergedForMap: MemberLocation[] = useMemo(
    () =>
      members.map((mem) => {
        const l = locByAccount.get(mem.account_id);
        return {
          account_id: mem.account_id,
          display_name: mem.display_name,
          latitude: l?.latitude ?? null,
          longitude: l?.longitude ?? null,
          created_at: l?.created_at ?? null,
          battery_level: l?.battery_level ?? null,
          connection_type: l?.connection_type ?? null,
          is_moving: l?.is_moving,
        };
      }),
    [members, locByAccount],
  );

  const openPlus = async () => {
    const res = await fetch(`/api/travelshield/${groupId}/token`, {
      method: 'POST',
      credentials: 'include',
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setQr({
      token: (j as { token: string }).token,
      expires_at: (j as { expires_at: string }).expires_at,
      uses_count: (j as { uses_count: number }).uses_count,
      max_uses: (j as { max_uses: number }).max_uses,
    });
  };

  const leave = async () => {
    setLeaveMsg('');
    const lock = window.prompt('Lock code (if required)') || '';
    const res = await fetch(`/api/travelshield/${groupId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(lock ? { lock_code: lock } : {}),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLeaveMsg((j as { error?: string }).error || 'Could not leave');
      return;
    }
    router.replace(`/trips/${tripId}?tab=Overview`);
    router.refresh();
  };

  const startLiveSharing = () => {
    if (locDisabled) {
      alert('Live location is disabled for this environment (FOCL / F-6.6.13-location).');
      return;
    }
    try {
      stopTracking(trackerRef.current);
      trackerRef.current = startTracking(groupId, {
        onPosition: async (pos) => {
          const bat = await getBatteryStatus();
          const bl = bat.supported ? Math.round(bat.level * 100) : null;
          if (bat.supported && !bat.charging && bat.level < 0.1) {
            await sendLocationPing(groupId, { pause_for_battery_saver: true });
            stopTracking(trackerRef.current);
            trackerRef.current = null;
            setSharingLocation(false);
            void loadLocations();
            return;
          }
          setSelfPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          await sendLocationPing(groupId, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_meters: pos.coords.accuracy,
            battery_level: bl,
            speed_mps: pos.coords.speed ?? undefined,
            heading: pos.coords.heading ?? undefined,
            altitude: pos.coords.altitude ?? undefined,
            is_moving: pos.coords.speed != null && pos.coords.speed > 1,
          });
          void loadLocations();
        },
        onBatteryPause: async () => {
          await sendLocationPing(groupId, { pause_for_battery_saver: true });
          stopTracking(trackerRef.current);
          trackerRef.current = null;
          setSharingLocation(false);
          void loadLocations();
        },
      });
      setSharingLocation(true);
    } catch {
      alert('Could not start location sharing. Check browser permissions.');
    }
  };

  const stopLiveSharing = () => {
    stopTracking(trackerRef.current);
    trackerRef.current = null;
    setSharingLocation(false);
  };

  const requestCheckinFor = async (targetAccountId: string) => {
    setCheckinPicker(false);
    const res = await fetch(`/api/travelshield/${groupId}/checkin`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_account_id: targetAccountId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((j as { error?: string }).error || 'Could not request check-in');
      return;
    }
    void loadCheckins();
  };

  if (loading) {
    return (
      <div
        data-testid="travelshield-active-card"
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#64748b',
          fontSize: 13,
        }}
      >
        Loading TravelShield…
      </div>
    );
  }

  const self = members.find((m) => m.is_self);
  const firstIncoming = incomingCheckins[0];

  return (
    <div
      data-testid="travelshield-active-card"
      style={{
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '16px 16px 14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {firstIncoming ? (
        <CheckinRequestCard
          groupId={groupId}
          checkinId={firstIncoming.checkin_id}
          requesterName={nameByAccount[firstIncoming.requested_by] || 'Partner'}
          onDone={() => void loadCheckins()}
        />
      ) : null}

      <CheckinEscalationBanner
        groupId={groupId}
        outgoing={outgoingCheckins}
        nameByAccount={nameByAccount}
        onCancelled={() => void loadCheckins()}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>TRAVELSHIELD</p>
          <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Safety group</p>
        </div>
        <button
          type="button"
          onClick={() => setConfigureOpen(true)}
          style={{
            border: 'none',
            background: 'none',
            color: '#1e3a8a',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Settings
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        {members.map((m, i) => {
          const l = locByAccount.get(m.account_id);
          const st = presenceFromPing(l?.created_at ?? null, l?.battery_level ?? undefined);
          return (
            <MemberAvatar key={m.member_id} name={m.display_name} label={labels[i]} status={st} />
          );
        })}
        <button
          type="button"
          aria-label="Show invite QR code"
          onClick={() => void openPlus()}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '2px dashed #94a3b8',
            background: '#f8fafc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: '#64748b',
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setCheckinPicker(true)}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '10px 0',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: 'white',
            fontWeight: 600,
            fontSize: 13,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          Request check-in
        </button>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '10px 0',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: 'white',
            fontWeight: 600,
            fontSize: 13,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          View on map
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {!sharingLocation ? (
          <button
            type="button"
            onClick={() => startLiveSharing()}
            style={{
              flex: 1,
              minWidth: 160,
              padding: '8px 0',
              borderRadius: 10,
              border: '1px solid #1e3a8a',
              background: '#1e3a8a',
              color: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Share live location (opt-in)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => stopLiveSharing()}
            style={{
              flex: 1,
              minWidth: 160,
              padding: '8px 0',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: 'white',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Stop sharing location
          </button>
        )}
      </div>

      <GroupCoverageDashboard groupId={groupId} names={nameByAccount} />

      <div
        style={{
          borderTop: '1px solid #f1f5f9',
          paddingTop: 10,
          fontSize: 11,
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          Status: {groupStatus || '—'} · Location: {locDisabled ? 'feature off' : 'Phase 2'}
          {self?.account_id ? ` · You: ${self.display_name}` : ''}
        </span>
        <button
          type="button"
          onClick={() => void leave()}
          style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
        >
          Leave group
        </button>
      </div>
      {leaveMsg ? <p style={{ color: '#b91c1c', fontSize: 12, margin: '8px 0 0' }}>{leaveMsg}</p> : null}

      {checkinPicker ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(15,23,42,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ background: 'white', borderRadius: 12, padding: 16, maxWidth: 360, width: '100%' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 700 }}>Request check-in</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {members
                .filter((m) => !m.is_self)
                .map((m) => (
                  <li key={m.member_id}>
                    <button
                      type="button"
                      onClick={() => void requestCheckinFor(m.account_id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 8px',
                        border: 'none',
                        background: '#f8fafc',
                        marginBottom: 6,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {m.display_name}
                    </button>
                  </li>
                ))}
            </ul>
            <button type="button" onClick={() => setCheckinPicker(false)} style={{ marginTop: 8, border: 'none', background: 'none', color: '#64748b' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {mapOpen ? (
        <GroupMapView
          members={mergedForMap}
          centerMe={selfPos}
          onClose={() => setMapOpen(false)}
          footer={mergedForMap.map((m) => (
            <MemberLocationCard key={m.account_id} member={m} onRequestCheckin={(id) => void requestCheckinFor(id)} />
          ))}
        />
      ) : null}

      {qr ? (
        <QRCodeDisplay
          token={qr.token}
          expiresAt={qr.expires_at}
          usesCount={qr.uses_count}
          maxUses={qr.max_uses}
          onClose={() => setQr(null)}
        />
      ) : null}

      <ConfigureSheet open={configureOpen} groupId={groupId} onClose={() => setConfigureOpen(false)} onActivated={() => void load()} />
    </div>
  );
}
