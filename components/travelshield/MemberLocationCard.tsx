'use client';

import type { MemberLocation } from './GroupMapView';

function ageLabel(createdAt: string | null): string {
  if (!createdAt) return 'No recent location';
  const m = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.floor(m)} min ago`;
  return `${Math.floor(m / 60)} hr ago`;
}

export default function MemberLocationCard({
  member,
  onRequestCheckin,
}: {
  member: MemberLocation;
  onRequestCheckin?: (accountId: string) => void;
}) {
  const bat = member.battery_level;
  const batteryLow = bat != null && bat < 10;
  const ageMs = member.created_at ? Date.now() - new Date(member.created_at).getTime() : 999999;
  const ageMin = ageMs / 60_000;
  const dot =
    batteryLow || ageMin > 30 ? '#94a3b8' : ageMin > 5 ? '#d97706' : '#16a34a';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
        marginBottom: 8,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} title="status" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{member.display_name}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Last seen: {ageLabel(member.created_at)}
          {member.latitude != null && member.longitude != null
            ? ` · ~${member.latitude.toFixed(2)}, ${member.longitude.toFixed(2)}`
            : ''}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          {bat != null ? `Battery ${bat}%` : 'Battery —'} · {member.connection_type || 'network ?'}
          {batteryLow ? ' · Battery saver' : ''}
        </div>
      </div>
      {onRequestCheckin ? (
        <button
          type="button"
          onClick={() => onRequestCheckin(member.account_id)}
          style={{
            flexShrink: 0,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          Request check-in
        </button>
      ) : null}
    </div>
  );
}
