'use client';

export type PresenceStatus = 'online' | 'recent' | 'offline';

function initialsFromName(name: string, disambiguated?: string) {
  const src = (disambiguated || name || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase() || '?';
}

function hashHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: '#22c55e',
  recent: '#f59e0b',
  offline: '#ef4444',
};

/** Disambiguate duplicate first names: "Sarah A." / "Sarah M." */
export function disambiguatedLabels(names: string[]): string[] {
  const firstCounts = new Map<string, number>();
  for (const n of names) {
    const first = (n.split(/\s+/)[0] || '').toLowerCase();
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  }
  return names.map((full) => {
    const parts = full.trim().split(/\s+/);
    const first = parts[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1] : '';
    const key = first.toLowerCase();
    if ((firstCounts.get(key) ?? 0) > 1 && last) {
      return `${first} ${last.charAt(0).toUpperCase()}.`;
    }
    return full;
  });
}

export default function MemberAvatar({
  name,
  label,
  status = 'recent',
  size = 44,
}: {
  name: string;
  /** Override display for duplicate first names */
  label?: string;
  status?: PresenceStatus;
  size?: number;
}) {
  const hue = hashHue(name || label || 'x');
  const initials = initialsFromName(name, label);
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, hsl(${hue}, 62%, 52%), hsl(${(hue + 40) % 360}, 55%, 40%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.32,
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      title={name}
    >
      {initials}
      <span
        style={{
          position: 'absolute',
          bottom: 1,
          right: 1,
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: '50%',
          background: STATUS_COLOR[status],
          border: '2px solid white',
          boxSizing: 'border-box',
        }}
        aria-hidden
      />
    </div>
  );
}
