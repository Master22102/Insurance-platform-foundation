/**
 * Browser-only GPS helper: opt-in per session, battery-aware ping intervals.
 * Use only after explicit user consent. Never call silently on mount.
 */

export type BatteryStatus = { level: number; charging: boolean; supported: boolean };

export type TrackingCallbacks = {
  onPosition: (pos: GeolocationPosition) => void;
  /** Battery < 10% (and not charging): stop outbound pings; notify partners separately. */
  onBatteryPause?: (reason: string) => void;
};

export type ActiveTracker = {
  watchId: number;
  tickId: ReturnType<typeof setInterval>;
  stop: () => void;
};

const LOW_BATTERY_PAUSE = 0.1;
const LOW_BATTERY_SLOW = 0.2;
const MID_BATTERY = 0.5;
const MOVING_SPEED = 1;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

export async function getBatteryStatus(): Promise<BatteryStatus> {
  if (!isBrowser()) return { level: 1, charging: false, supported: false };
  const bat = (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery;
  if (!bat) return { level: 1, charging: false, supported: false };
  try {
    const b = await bat.call(navigator);
    return { level: Math.max(0, Math.min(1, b.level)), charging: Boolean(b.charging), supported: true };
  } catch {
    return { level: 1, charging: false, supported: false };
  }
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isBrowser() || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 });
  });
}

function speedMps(pos: GeolocationPosition): number | null {
  const s = pos.coords.speed;
  if (s == null || Number.isNaN(s)) return null;
  return s;
}

/**
 * Ping interval from battery + movement + charging.
 * <10% not charging → null (pause). Charging → 30s.
 */
export async function computePingIntervalMs(pos: GeolocationPosition | null): Promise<number | null> {
  const bat = await getBatteryStatus();
  if (bat.supported && !bat.charging && bat.level < LOW_BATTERY_PAUSE) return null;
  if (bat.charging) return 30_000;

  const sp = pos ? speedMps(pos) : null;
  const moving = sp != null && sp > MOVING_SPEED;

  if (bat.supported && bat.level < LOW_BATTERY_SLOW) return 15 * 60_000;
  if (bat.supported && bat.level < MID_BATTERY) return 5 * 60_000;
  if (moving) return 30_000;
  return 2 * 60_000;
}

/**
 * `watchPosition` keeps last fix; a 5s ticker emits `onPosition` when interval elapsed.
 */
export function startTracking(_groupId: string, callbacks: TrackingCallbacks): ActiveTracker {
  void _groupId;
  if (!isBrowser() || !navigator.geolocation) {
    throw new Error('Geolocation not supported');
  }

  let lastFix: GeolocationPosition | null = null;
  let lastEmitAt = 0;
  let pauseNotified = false;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      lastFix = pos;
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 25_000 },
  );

  const tickId = setInterval(() => {
    void (async () => {
      const bat = await getBatteryStatus();
      if (bat.supported && !bat.charging && bat.level < LOW_BATTERY_PAUSE) {
        if (!pauseNotified) {
          pauseNotified = true;
          callbacks.onBatteryPause?.('Battery saver — location paused');
        }
        return;
      }
      pauseNotified = false;

      if (!lastFix) return;
      const interval = await computePingIntervalMs(lastFix);
      if (interval == null) {
        if (!pauseNotified) {
          pauseNotified = true;
          callbacks.onBatteryPause?.('Battery saver — location paused');
        }
        return;
      }

      const now = Date.now();
      if (now - lastEmitAt >= interval) {
        lastEmitAt = now;
        callbacks.onPosition(lastFix);
      }
    })();
  }, 5_000);

  return {
    watchId,
    tickId,
    stop: () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tickId);
    },
  };
}

export function stopTracking(tracker: ActiveTracker | null): void {
  tracker?.stop();
}
