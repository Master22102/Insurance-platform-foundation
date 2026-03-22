import type { RouteSegmentRow } from './types';

type IncidentLike = {
  title?: string | null;
  description?: string | null;
  disruption_type?: string | null;
  disruption_start_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Returns only leg(s) plausibly tied to the incident — not the full itinerary.
 */
export function filterAffectedRouteSegments(
  segments: RouteSegmentRow[],
  incident: IncidentLike,
): RouteSegmentRow[] {
  const sorted = [...segments].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (sorted.length === 0) return [];
  if (sorted.length === 1) return sorted;

  const disrupt = incident.disruption_start_at ? new Date(incident.disruption_start_at) : null;

  if (disrupt && !Number.isNaN(disrupt.getTime())) {
    const day = disrupt.toISOString().slice(0, 10);
    const prev = new Date(disrupt.getTime() - 86400000).toISOString().slice(0, 10);
    const next = new Date(disrupt.getTime() + 86400000).toISOString().slice(0, 10);
    const matched = sorted.filter((s) => {
      const d0 = s.depart_at ? s.depart_at.slice(0, 10) : '';
      const a0 = s.arrive_at ? s.arrive_at.slice(0, 10) : '';
      return (
        d0 === day ||
        a0 === day ||
        d0 === prev ||
        a0 === prev ||
        d0 === next ||
        a0 === next
      );
    });
    if (matched.length > 0) return matched;
  }

  const meta = incident.metadata && typeof incident.metadata === 'object' ? incident.metadata : {};
  const metaDtype = typeof meta.disruption_type === 'string' ? meta.disruption_type : '';
  const hay = `${incident.title || ''} ${incident.description || ''} ${metaDtype}`.toLowerCase();
  const tokens = hay
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  const matchedByText = sorted.filter((s) => {
    const o = (s.origin || '').toLowerCase();
    const d = (s.destination || '').toLowerCase();
    const n = (s.notes || '').toLowerCase();
    return tokens.some((t) => o.includes(t) || d.includes(t) || n.includes(t));
  });
  if (matchedByText.length > 0) return matchedByText;

  const dtype = String(incident.disruption_type || metaDtype || '').toLowerCase();
  if (dtype.includes('flight') || dtype.includes('delay') || dtype.includes('cancellation')) {
    const air = sorted.filter((s) => {
      const st = (s.segment_type || '').toLowerCase();
      return st === 'air' || st === 'flight';
    });
    if (air.length === 1) return air;
    if (air.length > 1) return air.slice(0, 1);
  }

  return sorted.slice(0, 1);
}
