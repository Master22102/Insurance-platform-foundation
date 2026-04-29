import { estimateDriveMinutes, haversineKm, resolveAirportFromSegment } from './airport-coordinates';

export type CoverageGapLite = {
  gap_id?: string;
  gap_type: string;
  benefit_type: string;
  description: string;
  severity: string;
  affected_policy_ids?: string[] | null;
  metadata?: Record<string, unknown>;
};

export type CoverageSummaryLite = {
  benefit_type: string;
  plain_language_summary?: string | null;
  exclusion_summary?: string | null;
  has_exclusion?: boolean;
};

export type RouteSegmentLite = {
  segment_id: string;
  segment_type?: string | null;
  origin?: string | null;
  destination?: string | null;
  depart_at?: string | null;
  arrive_at?: string | null;
  destination_country_code?: string | null;
  notes?: string | null;
};

export type ActivityCategoryLite = {
  category_name: string;
  exclusion_keywords: string[];
};

export type ActivityZoneToggles = {
  ski_resorts?: boolean;
  dive_centers?: boolean;
  climbing_areas?: boolean;
  motorbike_rental?: boolean;
  water_sports?: boolean;
  high_altitude?: boolean;
};

export type PresenceSettingsLite = {
  enabled: boolean;
  activity_zones_enabled: boolean;
  border_crossings_enabled: boolean;
  missed_connection_enabled: boolean;
  risk_alerts_enabled: boolean;
  daily_summary_enabled: boolean;
  activity_zone_toggles: ActivityZoneToggles;
};

export type PolicyBreakdownRow = {
  policyLabel: string;
  status: 'covered' | 'excluded' | 'unclear';
  clauseCitation: string;
  benefit_type?: string;
};

export type PresenceUiAlert =
  | {
      kind: 'activity_zone';
      subtype: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      summary: string;
      policies: PolicyBreakdownRow[];
      gaps: CoverageGapLite[];
    }
  | {
      kind: 'border_crossing';
      severity: 'info';
      fromCountry: string | null;
      toCountry: string;
      coverageChanges: { title: string; detail: string; citation: string }[];
    }
  | {
      kind: 'missed_connection';
      severity: 'warning' | 'critical';
      segmentId: string;
      airportLabel: string;
      distanceKm: number;
      driveMinutes: number;
      minutesToDepart: number;
      coverageSummary?: string | null;
    }
  | {
      kind: 'visa_window';
      severity: 'info' | 'warning' | 'critical';
      countryCode: string;
      visaType: string;
      title: string;
      summary: string;
      daysRemaining?: number | null;
      daysUsed?: number | null;
      zoneId?: string | null;
      officialSourceUrl?: string | null;
    }
  | {
      kind: 'cultural_restriction';
      severity: 'info' | 'warning' | 'critical';
      restrictionId: string;
      countryCode: string;
      region?: string | null;
      eventName: string;
      eventNameLocal?: string | null;
      eventType: string;
      restrictionSummary: string;
      restrictionDetail?: string | null;
      travelerImpact: string[];
      preparationSteps: Array<{
        step_number: number;
        title: string;
        detail: string;
        deadline_days_before: number;
      }>;
      positiveNote?: string | null;
      enforcementLevel?: string | null;
      penaltyDescription?: string | null;
      insuranceNote?: string | null;
      eventStart: string;
      eventEnd: string;
      daysUntil: number;
    };

const CATEGORY_MAP: Record<
  keyof ActivityZoneToggles,
  { keywords: string[]; matchCategories: string[] }
> = {
  ski_resorts: {
    keywords: ['ski', 'resort', 'piste', 'snowboard', 'gondola', 'lift'],
    matchCategories: ['winter_sports'],
  },
  dive_centers: {
    keywords: ['dive', 'scuba', 'diving', 'reef'],
    matchCategories: ['scuba_diving'],
  },
  climbing_areas: {
    keywords: ['climb', 'climbing', 'crag', 'via ferrata'],
    matchCategories: ['climbing'],
  },
  motorbike_rental: {
    keywords: ['motorbike', 'motorcycle', 'moped', 'scooter rental'],
    matchCategories: ['motorsports'],
  },
  water_sports: {
    keywords: ['surf', 'kayak', 'rafting', 'wakeboard', 'jetski', 'jet ski'],
    matchCategories: ['water_sports'],
  },
  high_altitude: {
    keywords: ['altitude', 'base camp', 'trek', 'summit', 'pass'],
    matchCategories: ['high_altitude'],
  },
};

function haystackForLocation(displayName: string | undefined, gaps: CoverageGapLite[]): string {
  const g = gaps
    .filter((x) => x.gap_type === 'activity_excluded')
    .map((x) => `${x.description} ${x.benefit_type}`)
    .join(' ');
  return `${displayName || ''} ${g}`.toLowerCase();
}

function keywordHit(haystack: string, words: string[]): boolean {
  return words.some((w) => haystack.includes(w.toLowerCase()));
}

function policyRowsFromGaps(gaps: CoverageGapLite[]): PolicyBreakdownRow[] {
  const activity = gaps.filter((g) => g.gap_type === 'activity_excluded');
  return activity.map((g, i) => {
    const meta = g.metadata || {};
    const cite =
      (meta.clause_ref as string) ||
      (meta.citation as string) ||
      (meta.policy_clause_id as string) ||
      `Gap ${g.gap_type} · ${g.benefit_type}`;
    const excluded = g.gap_type === 'activity_excluded' || Boolean(meta.excluded);
    return {
      policyLabel: (meta.policy_label as string) || `Policy ${i + 1}`,
      status: excluded ? 'excluded' : 'unclear',
      clauseCitation: cite,
      benefit_type: g.benefit_type,
    };
  });
}

function coverageChangesForBorder(gaps: CoverageGapLite[]): { title: string; detail: string; citation: string }[] {
  const pick = gaps.filter((g) =>
    ['geographic_excluded', 'exclusion_conflict', 'activity_excluded', 'no_coverage'].includes(g.gap_type),
  );
  return pick.slice(0, 12).map((g) => ({
    title: g.benefit_type.replace(/_/g, ' '),
    detail: g.description,
    citation: (g.metadata?.citation as string) || g.gap_type,
  }));
}

export function evaluatePresenceAlerts(input: {
  now: Date;
  displayName?: string;
  countryCode: string | null;
  lastCountryCode: string | null;
  settings: PresenceSettingsLite;
  coverageGaps: CoverageGapLite[];
  coverageSummaries: CoverageSummaryLite[];
  routeSegments: RouteSegmentLite[];
  activityCategories: ActivityCategoryLite[];
  userLat: number;
  userLon: number;
}): PresenceUiAlert[] {
  const out: PresenceUiAlert[] = [];
  if (!input.settings.enabled) return out;

  const hay = haystackForLocation(input.displayName, input.coverageGaps);
  const toggles = input.settings.activity_zone_toggles || {};

  if (input.settings.activity_zones_enabled) {
    let matchedKey: keyof ActivityZoneToggles | null = null;
    for (const key of Object.keys(CATEGORY_MAP) as (keyof ActivityZoneToggles)[]) {
      if (toggles[key] === false) continue;
      const cfg = CATEGORY_MAP[key];
      const catHit = input.activityCategories.some(
        (c) => cfg.matchCategories.includes(c.category_name) && keywordHit(hay, c.exclusion_keywords),
      );
      const locHit = keywordHit(hay, cfg.keywords);
      if (!locHit && !catHit) continue;
      matchedKey = key;
      break;
    }
    if (matchedKey) {
      const relevantGaps = input.coverageGaps.filter((g) => g.gap_type === 'activity_excluded');
      const policies = policyRowsFromGaps(
        relevantGaps.length ? relevantGaps : [{ gap_type: 'activity_excluded', benefit_type: 'activities', description: 'Review policy activity exclusions.', severity: 'warning' }],
      );
      out.push({
        kind: 'activity_zone',
        subtype: matchedKey,
        severity: relevantGaps.some((g) => g.severity === 'critical') ? 'critical' : 'warning',
        title: 'Activity zone coverage check',
        summary:
          'Your location or itinerary suggests a higher-risk activity area. Here is how attached policies line up.',
        policies,
        gaps: relevantGaps.length ? relevantGaps : input.coverageGaps.slice(0, 5),
      });
    }
  }

  if (
    input.settings.border_crossings_enabled &&
    input.countryCode &&
    input.lastCountryCode &&
    input.countryCode !== input.lastCountryCode
  ) {
    out.push({
      kind: 'border_crossing',
      severity: 'info',
      fromCountry: input.lastCountryCode,
      toCountry: input.countryCode,
      coverageChanges: coverageChangesForBorder(input.coverageGaps),
    });
  }

  if (input.settings.missed_connection_enabled) {
    const segs = [...input.routeSegments].sort((a, b) => {
      const ta = a.depart_at ? new Date(a.depart_at).getTime() : 0;
      const tb = b.depart_at ? new Date(b.depart_at).getTime() : 0;
      return ta - tb;
    });
    const nowMs = input.now.getTime();
    for (const seg of segs) {
      if (!seg.depart_at) continue;
      const depart = new Date(seg.depart_at).getTime();
      if (depart <= nowMs || depart > nowMs + 6 * 60 * 60 * 1000) continue;
      const ap = resolveAirportFromSegment(seg.origin);
      if (!ap) continue;
      const km = haversineKm(input.userLat, input.userLon, ap.lat, ap.lon);
      const driveMin = estimateDriveMinutes(km);
      const minutesToDepart = Math.round((depart - nowMs) / 60_000);
      if (minutesToDepart < 8) continue;
      const bufferMin = 45;
      if (driveMin + bufferMin > minutesToDepart) {
        const delaySummary =
          input.coverageSummaries.find(
            (s) => s.benefit_type === 'trip_delay' || s.benefit_type === 'travel_delay',
          ) || null;
        out.push({
          kind: 'missed_connection',
          severity: minutesToDepart < 60 ? 'critical' : 'warning',
          segmentId: seg.segment_id,
          airportLabel: ap.label,
          distanceKm: Math.round(km * 10) / 10,
          driveMinutes: driveMin,
          minutesToDepart,
          coverageSummary:
            delaySummary?.plain_language_summary ||
            delaySummary?.exclusion_summary ||
            'Check your trip delay / missed connection benefits in the Coverage tab.',
        });
      }
      break;
    }
  }

  return out;
}
