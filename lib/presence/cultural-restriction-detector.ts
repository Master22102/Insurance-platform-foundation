export type CulturalRestrictionRow = {
  restriction_id: string;
  country_code: string;
  region: string | null;
  event_name: string;
  event_name_local: string | null;
  event_type: string;
  severity: 'critical' | 'warning' | 'info';
  date_type: 'fixed' | 'variable' | 'recurring_weekly';
  fixed_month: number | null;
  fixed_day: number | null;
  current_year_start: string | null;
  current_year_end: string | null;
  next_year_start: string | null;
  next_year_end: string | null;
  recurring_day_of_week: number | null;
  recurring_start_time: string | null;
  recurring_end_time: string | null;
  duration_hours: number | null;
  advance_warning_days: number;
  restriction_summary: string;
  restriction_detail: string | null;
  traveler_impact: string[] | null;
  preparation_steps: unknown;
  positive_note: string | null;
  enforcement_level: string | null;
  penalty_description: string | null;
  insurance_note: string | null;
  official_source_url: string | null;
};

export type CulturalRestrictionAlert = {
  kind: 'cultural_restriction';
  restriction_id: string;
  event_name: string;
  event_name_local?: string | null;
  country_code: string;
  region?: string | null;
  severity: 'critical' | 'warning' | 'info';
  event_type: string;
  restriction_summary: string;
  restriction_detail?: string | null;
  traveler_impact: string[];
  preparation_steps: Array<{
    step_number: number;
    title: string;
    detail: string;
    deadline_days_before: number;
  }>;
  positive_note?: string | null;
  enforcement_level?: string | null;
  penalty_description?: string | null;
  insurance_note?: string | null;
  event_start: string;
  event_end: string;
  days_until: number;
  airport_closure_conflict?: boolean;
  checkout_conflict?: boolean;
};

type DestinationStay = {
  country_code: string;
  region?: string | null;
  arrive_date: string;
  depart_date: string;
};

type FlightDate = { date: string; airport_country: string };

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  // Treat ranges as [start, end] inclusive by day.
  const as = parseYmd(aStart).getTime();
  const ae = parseYmd(aEnd).getTime();
  const bs = parseYmd(bStart).getTime();
  const be = parseYmd(bEnd).getTime();
  return as <= be && bs <= ae;
}

function normalizeSteps(raw: unknown): CulturalRestrictionAlert['preparation_steps'] {
  if (!Array.isArray(raw)) return [];
  const out: CulturalRestrictionAlert['preparation_steps'] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const step_number = typeof o.step_number === 'number' ? o.step_number : Number(o.step_number);
    const title = typeof o.title === 'string' ? o.title : '';
    const detail = typeof o.detail === 'string' ? o.detail : '';
    const deadline_days_before =
      typeof o.deadline_days_before === 'number' ? o.deadline_days_before : Number(o.deadline_days_before);
    if (!Number.isFinite(step_number) || !title.trim() || !detail.trim() || !Number.isFinite(deadline_days_before)) continue;
    out.push({ step_number, title: title.trim(), detail: detail.trim(), deadline_days_before });
  }
  out.sort((a, b) => a.step_number - b.step_number);
  return out;
}

function firstMatchingWeekday(stayStart: string, stayEnd: string, dow: number): string | null {
  const start = parseYmd(stayStart);
  const end = parseYmd(stayEnd);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    // JS: 0=Sun..6=Sat matches schema.
    if (d.getUTCDay() === dow) return ymd(d);
  }
  return null;
}

export function detectCulturalRestrictions(input: {
  now: Date;
  destinations: DestinationStay[];
  restrictions: CulturalRestrictionRow[];
  flightDates?: FlightDate[];
}): CulturalRestrictionAlert[] {
  const out: CulturalRestrictionAlert[] = [];
  const nowMs = input.now.getTime();

  const flights = (input.flightDates || []).map((f) => ({
    date: String(f.date).slice(0, 10),
    airport_country: String(f.airport_country).toUpperCase().slice(0, 2),
  }));

  for (const stay of input.destinations) {
    const cc = String(stay.country_code).toUpperCase().slice(0, 2);
    if (!cc) continue;
    const region = stay.region ? String(stay.region) : null;
    const sStart = String(stay.arrive_date).slice(0, 10);
    const sEnd = String(stay.depart_date).slice(0, 10);
    if (!sStart || !sEnd || sEnd <= sStart) continue;

    const candidates = input.restrictions.filter((r) => {
      if (String(r.country_code).toUpperCase().slice(0, 2) !== cc) return false;
      if (!r.region) return true;
      if (!region) return false;
      return String(r.region).toLowerCase() === region.toLowerCase();
    });

    for (const r of candidates) {
      let evStart: string | null = null;
      let evEnd: string | null = null;

      if (r.date_type === 'variable') {
        const pairs: Array<[string | null, string | null]> = [
          [r.current_year_start, r.current_year_end],
          [r.next_year_start, r.next_year_end],
        ];
        const match = pairs.find(([a, b]) => a && b && overlaps(sStart, sEnd, a, b));
        if (match) {
          evStart = match[0]!;
          evEnd = match[1]!;
        }
      } else if (r.date_type === 'fixed') {
        const m = r.fixed_month;
        const d = r.fixed_day;
        if (m && d) {
          const startYear = parseYmd(sStart).getUTCFullYear();
          const endYear = parseYmd(sEnd).getUTCFullYear();
          for (let y = startYear; y <= endYear; y++) {
            const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
            const on = ymd(dt);
            if (on >= sStart && on <= sEnd) {
              evStart = on;
              evEnd = on;
              break;
            }
          }
        }
      } else if (r.date_type === 'recurring_weekly') {
        const dow = r.recurring_day_of_week;
        if (typeof dow === 'number' && Number.isFinite(dow)) {
          const first = firstMatchingWeekday(sStart, sEnd, dow);
          if (first) {
            evStart = first;
            evEnd = first;
          }
        }
      }

      if (!evStart || !evEnd) continue;
      const evStartIso = evStart;
      const evEndIso = evEnd;

      const evStartMs = parseYmd(evStartIso).getTime();
      const daysUntil = Math.round((evStartMs - nowMs) / 86_400_000);

      const impacts = Array.isArray(r.traveler_impact) ? r.traveler_impact.map(String) : [];
      const steps = normalizeSteps(r.preparation_steps);

      const airportClosure =
        (r.event_type === 'total_shutdown' || impacts.includes('airport_closed')) &&
        flights.some((f) => f.airport_country === cc && f.date >= evStartIso && f.date <= evEndIso);

      const checkoutConflict =
        r.event_type === 'total_shutdown' && (stay.depart_date >= evStartIso && stay.depart_date <= evEndIso);

      const severity: CulturalRestrictionAlert['severity'] =
        airportClosure ? 'critical' : r.severity;

      // Only emit if within advance warning window OR overlapping now/travel (best-effort).
      const withinWarning = daysUntil <= Math.max(1, r.advance_warning_days || 7);
      const overlapsTravel = overlaps(sStart, sEnd, evStartIso, evEndIso);
      if (!withinWarning && !overlapsTravel) continue;

      out.push({
        kind: 'cultural_restriction',
        restriction_id: r.restriction_id,
        event_name: r.event_name,
        event_name_local: r.event_name_local,
        country_code: cc,
        region: r.region,
        severity,
        event_type: r.event_type,
        restriction_summary: r.restriction_summary,
        restriction_detail: r.restriction_detail,
        traveler_impact: impacts,
        preparation_steps: steps,
        positive_note: r.positive_note,
        enforcement_level: r.enforcement_level,
        penalty_description: r.penalty_description,
        insurance_note: r.insurance_note,
        event_start: evStartIso,
        event_end: evEndIso,
        days_until: daysUntil,
        airport_closure_conflict: airportClosure,
        checkout_conflict: checkoutConflict,
      });
    }
  }

  const rank = (s: CulturalRestrictionAlert['severity']) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
  out.sort((a, b) => rank(a.severity) - rank(b.severity) || a.days_until - b.days_until);

  // Dedup by restriction_id + event_start
  const seen = new Set<string>();
  const dedup: CulturalRestrictionAlert[] = [];
  for (const a of out) {
    const key = `${a.restriction_id}:${a.event_start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(a);
  }
  return dedup;
}

