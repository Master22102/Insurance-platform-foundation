/**
 * F-6.5.18 — Client-side route validation (instant UI feedback).
 * Server-side overlap checks also run in `evaluate_trip_readiness`.
 */

export type RouteIssueSeverity = 'blocker' | 'warning';

export type RouteIssueType =
  | 'schedule_conflict'
  | 'tight_connection'
  | 'impossible_travel_time'
  | 'missing_times'
  | 'date_outside_trip';

export type RouteIssue = {
  type: RouteIssueType;
  severity: RouteIssueSeverity;
  message: string;
  segmentId?: string;
  segmentIndex?: number;
};

export type RouteSegmentInput = {
  segment_id?: string;
  segment_type?: string | null;
  origin?: string | null;
  destination?: string | null;
  depart_at?: string | null;
  arrive_at?: string | null;
  sort_order?: number | null;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function parseTs(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Sort segments like the server: sort_order, then depart_at.
 */
function sortSegments(segs: RouteSegmentInput[]): RouteSegmentInput[] {
  return [...segs].sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    const da = parseTs(a.depart_at ?? undefined)?.getTime() ?? 0;
    const db = parseTs(b.depart_at ?? undefined)?.getTime() ?? 0;
    return da - db;
  });
}

export function validateRouteSegments(
  segments: RouteSegmentInput[],
  opts?: {
    tripDepartureDate?: string | null;
    tripReturnDate?: string | null;
  },
): { valid: boolean; issues: RouteIssue[] } {
  const issues: RouteIssue[] = [];
  const ordered = sortSegments(segments);
  const tripStart = opts?.tripDepartureDate ? startOfDay(parseTs(opts.tripDepartureDate)!) : null;
  const tripEnd = opts?.tripReturnDate ? startOfDay(parseTs(opts.tripReturnDate)!) : null;
  if (opts?.tripDepartureDate && !tripStart) {
    /* ignore invalid trip dates */
  }
  if (opts?.tripReturnDate && !tripEnd) {
    /* ignore */
  }

  ordered.forEach((seg, index) => {
    const id = seg.segment_id;
    const depart = parseTs(seg.depart_at ?? undefined);
    const arrive = parseTs(seg.arrive_at ?? undefined);
    const type = (seg.segment_type || '').toLowerCase();

    if (!depart) {
      issues.push({
        type: 'missing_times',
        severity: 'warning',
        message: `Segment ${index + 1} (${seg.origin || '?'} → ${seg.destination || '?'}) has no departure/start time.`,
        segmentId: id,
        segmentIndex: index,
      });
    }

    if ((type === 'hotel' || type === 'car') && !arrive) {
      issues.push({
        type: 'missing_times',
        severity: 'warning',
        message: `Segment ${index + 1} (${type}) is missing an end date.`,
        segmentId: id,
        segmentIndex: index,
      });
    }

    if (depart && arrive && arrive < depart) {
      issues.push({
        type: 'impossible_travel_time',
        severity: 'blocker',
        message: `Segment ${index + 1} arrives before it departs.`,
        segmentId: id,
        segmentIndex: index,
      });
    }

    if (tripStart && depart && startOfDay(depart) < tripStart) {
      issues.push({
        type: 'date_outside_trip',
        severity: 'warning',
        message: `Segment ${index + 1} departs before your trip start date.`,
        segmentId: id,
        segmentIndex: index,
      });
    }
    if (tripEnd && depart && startOfDay(depart) > tripEnd) {
      issues.push({
        type: 'date_outside_trip',
        severity: 'warning',
        message: `Segment ${index + 1} departs after your trip end date.`,
        segmentId: id,
        segmentIndex: index,
      });
    }
  });

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    const prevEnd = parseTs(prev.arrive_at ?? undefined) ?? parseTs(prev.depart_at ?? undefined);
    const curStart = parseTs(cur.depart_at ?? undefined);
    if (!prevEnd || !curStart) continue;

    if (curStart < prevEnd) {
      issues.push({
        type: 'schedule_conflict',
        severity: 'blocker',
        message: `Segment ${i + 1} departs before segment ${i} finishes (schedule conflict).`,
        segmentId: cur.segment_id,
        segmentIndex: i,
      });
    } else if (curStart.getTime() - prevEnd.getTime() < TWO_HOURS_MS) {
      issues.push({
        type: 'tight_connection',
        severity: 'warning',
        message: `Less than 2 hours between end of segment ${i} and start of segment ${i + 1}.`,
        segmentId: cur.segment_id,
        segmentIndex: i,
      });
    }
  }

  const hasBlocker = issues.some((x) => x.severity === 'blocker');
  return { valid: !hasBlocker, issues };
}
