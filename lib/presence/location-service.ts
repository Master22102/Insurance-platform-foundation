'use client';

export type ConnectionHint = {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  saveData?: boolean;
};

export type PresenceLocationSnapshot = {
  latitude: number;
  longitude: number;
  country_code: string | null;
  connection_type: string;
  battery_level: number | null;
  accuracy: number | null;
};

async function readBatteryLevelAsync(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    if (typeof nav.getBattery !== 'function') return null;
    const bat = await nav.getBattery();
    return typeof bat.level === 'number' ? Math.round(bat.level * 100) : null;
  } catch {
    return null;
  }
}

function connectionTypeLabel(): string {
  const c = (navigator as Navigator & { connection?: ConnectionHint }).connection;
  if (!c) return 'unknown';
  if (c.type === 'cellular' || (c.effectiveType && String(c.effectiveType).includes('4g'))) {
    return c.type === 'cellular' ? 'cellular' : String(c.effectiveType || 'unknown');
  }
  return String(c.type || c.effectiveType || 'unknown');
}

export function isLikelyCellularData(): boolean {
  const c = (navigator as Navigator & { connection?: ConnectionHint }).connection;
  return c?.type === 'cellular';
}

export type WatchOptions = {
  onUpdate: (snap: PresenceLocationSnapshot) => void;
  onError?: (code: number | null) => void;
};

/**
 * Battery-aware watch: high accuracy when plugged / charging heuristic omitted — use moderate accuracy to limit drain.
 */
export function watchPresenceLocation(opts: WatchOptions): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    opts.onError?.(null);
    return () => {};
  }

  let cancelled = false;
  let watchId: number | null = null;

  const pump = async (pos: GeolocationPosition) => {
    if (cancelled) return;
    const [battery_level] = await Promise.all([readBatteryLevelAsync()]);
    opts.onUpdate({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      country_code: null,
      connection_type: connectionTypeLabel(),
      battery_level,
      accuracy: pos.coords.accuracy ?? null,
    });
  };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      void pump(pos);
    },
    (err) => {
      opts.onError?.(err?.code ?? null);
    },
    {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 25_000,
    },
  );

  return () => {
    cancelled = true;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
  };
}

export function requestPresenceLocationOnce(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 20_000,
    });
  });
}
