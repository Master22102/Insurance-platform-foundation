export type VisaType =
  | 'visa_free'
  | 'visa_on_arrival'
  | 'eta_required'
  | 'visa_required'
  | 'transit_only'
  | 'restricted';

export type VisaRequirementRow = {
  passport_country_code: string;
  destination_country_code: string;
  visa_type: VisaType;
  max_stay_days: number | null;
  rolling_window_days: number | null;
  rolling_window_max_days: number | null;
  zone_id: string | null;
  notes: string | null;
  official_source_url: string | null;
  last_verified_at: string | null;
};

export type VisaWindowAlert = {
  kind: 'visa_window';
  severity: 'info' | 'warning' | 'critical';
  passportCountry: string;
  destinationCountry: string;
  zoneId?: string | null;
  visaType: VisaType;
  daysUsed?: number | null;
  daysRemaining?: number | null;
  title: string;
  summary: string;
  officialSourceUrl?: string | null;
};

type Stay = { country_code: string; arrive_date: string; depart_date: string; region?: string | null };

function parseYmd(s: string): Date {
  // Treat YYYY-MM-DD as UTC midnight for deterministic math.
  return new Date(`${s}T00:00:00.000Z`);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clampDate(d: Date, min: Date, max: Date): Date {
  const t = d.getTime();
  return new Date(Math.min(max.getTime(), Math.max(min.getTime(), t)));
}

function daysBetweenExclusive(startYmd: string, endYmd: string): number {
  const a = parseYmd(startYmd);
  const b = parseYmd(endYmd);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function countStayDays(stay: Stay): number {
  return daysBetweenExclusive(stay.arrive_date, stay.depart_date);
}

function summarizeVisaType(v: VisaType): string {
  if (v === 'visa_free') return 'visa-free';
  if (v === 'visa_on_arrival') return 'visa on arrival';
  if (v === 'eta_required') return 'ETA required';
  if (v === 'visa_required') return 'visa required';
  if (v === 'transit_only') return 'transit only';
  return 'restricted';
}

export function detectVisaWindowAlerts(input: {
  passportCountry: string | null;
  stays: Stay[];
  requirements: VisaRequirementRow[];
  zoneMembers: Array<{ zone_id: string; country_code: string }>;
  now: Date;
}): VisaWindowAlert[] {
  const out: VisaWindowAlert[] = [];
  const passport = (input.passportCountry || '').toUpperCase().slice(0, 2);
  if (!passport) return out;

  const reqByDest = new Map<string, VisaRequirementRow>();
  for (const r of input.requirements) {
    const dest = String(r.destination_country_code || '').toUpperCase().slice(0, 2);
    if (!dest) continue;
    reqByDest.set(dest, r);
  }

  const schengenSet = new Set(
    input.zoneMembers
      .filter((z) => String(z.zone_id).toLowerCase() === 'schengen')
      .map((z) => String(z.country_code).toUpperCase().slice(0, 2)),
  );

  const stays = input.stays
    .map((s) => ({
      ...s,
      country_code: String(s.country_code || '').toUpperCase().slice(0, 2),
    }))
    .filter((s) => s.country_code && s.arrive_date && s.depart_date)
    .filter((s) => s.depart_date > s.arrive_date);

  // Group zone stays (Schengen = single jurisdiction for visa counting).
  const schengenStays = stays.filter((s) => schengenSet.has(s.country_code));
  if (schengenStays.length > 0) {
    const anyReq =
      schengenStays
        .map((s) => reqByDest.get(s.country_code))
        .find((r) => r && String(r.zone_id || '').toLowerCase() === 'schengen') || null;

    const used = schengenStays.reduce((sum, s) => sum + countStayDays(s), 0);
    const max = anyReq?.rolling_window_max_days ?? anyReq?.max_stay_days ?? 90;
    const window = anyReq?.rolling_window_days ?? 180;
    const remaining = max != null ? max - used : null;

    const sev: VisaWindowAlert['severity'] =
      remaining != null && remaining < 0 ? 'critical' : remaining != null && remaining <= 10 ? 'warning' : 'info';
    const title = 'Schengen visa window (rolling)';
    const summary =
      remaining == null
        ? `Based on general Schengen rules (${max} days in any ${window}-day period), your planned stays may need review. Confirm via official sources.`
        : remaining < 0
          ? `Based on general Schengen rules (${max} days in any ${window}-day period), your planned stays exceed the visa-free window by ${Math.abs(remaining)} day(s). Confirm with official sources before travel.`
          : `Based on general Schengen rules (${max} days in any ${window}-day period), your planned Schengen stays use ${used} day(s), leaving about ${remaining} day(s). Confirm with official sources.`;

    out.push({
      kind: 'visa_window',
      severity: sev,
      passportCountry: passport,
      destinationCountry: 'SCHENGEN',
      zoneId: 'schengen',
      visaType: (anyReq?.visa_type || 'visa_free') as VisaType,
      daysUsed: used,
      daysRemaining: remaining,
      title,
      summary,
      officialSourceUrl: anyReq?.official_source_url || null,
    });
  }

  // Non-zone destinations.
  for (const s of stays) {
    if (schengenSet.has(s.country_code)) continue;
    const req = reqByDest.get(s.country_code);
    if (!req) continue;

    const used = countStayDays(s);
    const max = req.max_stay_days;
    const remaining = max != null ? max - used : null;

    const visaType = req.visa_type;
    if (visaType !== 'visa_free') {
      out.push({
        kind: 'visa_window',
        severity: visaType === 'visa_required' || visaType === 'restricted' ? 'warning' : 'info',
        passportCountry: passport,
        destinationCountry: s.country_code,
        visaType,
        daysUsed: used,
        daysRemaining: remaining,
        title: `Entry status: ${summarizeVisaType(visaType)}`,
        summary:
          visaType === 'visa_required'
            ? `Based on general requirements, this destination may require a visa before travel. Confirm requirements via official sources.`
            : `Based on general requirements, this destination may require ${summarizeVisaType(visaType)}. Confirm requirements via official sources.`,
        officialSourceUrl: req.official_source_url,
      });
      continue;
    }

    if (max == null) continue;
    const sev: VisaWindowAlert['severity'] =
      remaining != null && remaining < 0 ? 'critical' : remaining != null && remaining <= 10 ? 'warning' : 'info';

    out.push({
      kind: 'visa_window',
      severity: sev,
      passportCountry: passport,
      destinationCountry: s.country_code,
      visaType,
      daysUsed: used,
      daysRemaining: remaining,
      title: `Visa-free stay window (${s.country_code})`,
      summary:
        remaining != null && remaining < 0
          ? `Based on general requirements, your planned stay may exceed the visa-free limit by ${Math.abs(remaining)} day(s). Confirm with official sources.`
          : `Based on general requirements, your planned stay uses ${used} of ${max} visa-free day(s), leaving about ${remaining ?? 'unknown'} day(s). Confirm with official sources.`,
      officialSourceUrl: req.official_source_url,
    });
  }

  // Sort most severe first.
  const rank = (s: VisaWindowAlert['severity']) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
  out.sort((a, b) => rank(a.severity) - rank(b.severity));

  // Avoid repeating multiple alerts for the same destination code.
  const seen = new Set<string>();
  const dedup: VisaWindowAlert[] = [];
  for (const a of out) {
    const key = `${a.zoneId || ''}:${a.destinationCountry}:${a.visaType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(a);
  }
  return dedup;
}

