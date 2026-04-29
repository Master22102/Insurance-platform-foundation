export type PresenceAlertRow = {
  alert_type: string;
  alert_subtype: string | null;
  was_displayed: boolean;
  was_suppressed: boolean;
  created_at: string;
  snoozed_until?: string | null;
  dismissed_at?: string | null;
};

const FOUR_H_MS = 4 * 60 * 60 * 1000;

export function shouldSuppress(
  recentAlerts: PresenceAlertRow[],
  alertType: string,
  alertSubtype: string | null | undefined,
  nowMs: number,
): boolean {
  // CRITICAL cultural restrictions are never suppressed (Nyepi-level events must always surface).
  if (alertType === 'cultural_restriction') return false;

  const sub = alertSubtype ?? '';
  const cutoff = nowMs - FOUR_H_MS;

  const snoozeByType = recentAlerts.filter((r) => {
    if (r.alert_type !== alertType) return false;
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t) || t < cutoff) return false;
    return true;
  });
  if (
    snoozeByType.some((r) => {
      if (!r.snoozed_until) return false;
      const u = new Date(r.snoozed_until).getTime();
      return !Number.isNaN(u) && u > nowMs;
    })
  ) {
    return true;
  }

  const relevant = snoozeByType.filter((r) => {
    const rs = r.alert_subtype ?? '';
    return rs === sub;
  });

  const hadDisplay = relevant.some((r) => r.was_displayed && !r.was_suppressed);
  return hadDisplay;
}

export function getSuppressedCountForDay(
  alerts: PresenceAlertRow[],
  _tripId: string,
  dayStartLocal: Date,
  dayEndLocal: Date,
): number {
  const start = dayStartLocal.getTime();
  const end = dayEndLocal.getTime();
  return alerts.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return !Number.isNaN(t) && t >= start && t <= end && r.was_suppressed;
  }).length;
}

export type SnoozeDuration = '2h' | 'rest_of_day' | 'trip';

export function snoozeUntilMs(kind: SnoozeDuration, now: Date, tripReturnDate?: string | null): number {
  const nowMs = now.getTime();
  if (kind === '2h') return nowMs + 2 * 60 * 60 * 1000;

  if (kind === 'rest_of_day') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  }

  if (kind === 'trip' && tripReturnDate) {
    const d = new Date(`${tripReturnDate}T23:59:59`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  return nowMs + 24 * 60 * 60 * 1000;
}
