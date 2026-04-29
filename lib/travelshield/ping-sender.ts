/**
 * Client-side location ping delivery + offline queue (in-memory; flushes on `online`).
 */

export type LocationPingPayload = {
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number | null;
  battery_level?: number | null;
  connection_type?: string | null;
  is_moving?: boolean | null;
  speed_mps?: number | null;
  heading?: number | null;
  altitude?: number | null;
  /** When true, server emits `travelshield_location_paused` (battery saver). */
  pause_for_battery_saver?: boolean;
};

const memoryQueue: Array<{ groupId: string; payload: LocationPingPayload }> = [];

function connectionType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return c?.effectiveType || 'unknown';
}

export async function sendLocationPing(groupId: string, payload: LocationPingPayload): Promise<Response> {
  const body = {
    ...payload,
    connection_type: payload.connection_type ?? connectionType(),
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    memoryQueue.push({ groupId, payload: body });
    return new Response(JSON.stringify({ queued: true, offline: true }), { status: 202 });
  }

  return fetch(`/api/travelshield/${groupId}/ping`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function flushPendingPings(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.onLine) return;
  const batch = memoryQueue.splice(0, memoryQueue.length);
  for (const { groupId, payload } of batch) {
    try {
      await fetch(`/api/travelshield/${groupId}/ping`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      memoryQueue.push({ groupId, payload });
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushPendingPings();
  });
}
