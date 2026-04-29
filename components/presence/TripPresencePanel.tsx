'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import {
  evaluatePresenceAlerts,
  type CoverageGapLite,
  type CoverageSummaryLite,
  type PresenceSettingsLite,
  type PresenceUiAlert,
  type RouteSegmentLite,
} from '@/lib/presence/alert-engine';
import { snoozeUntilMs } from '@/lib/presence/fatigue-manager';
import { isLikelyCellularData, requestPresenceLocationOnce, watchPresenceLocation } from '@/lib/presence/location-service';
import ActivityZoneAlert from './ActivityZoneAlert';
import BorderCrossingAlert, { type CountryInfoPayload } from './BorderCrossingAlert';
import MissedConnectionAlert from './MissedConnectionAlert';
import DailySummaryCard, { type TimelineEntry } from './DailySummaryCard';
import PresenceSettingsSheet, { type PresenceSettingsForm } from './PresenceSettingsSheet';
import VisaWindowAlert from './VisaWindowAlert';
import CulturalRestrictionAlert from './CulturalRestrictionAlert';
import { detectVisaWindowAlerts, type VisaRequirementRow } from '@/lib/presence/visa-detector';
import { detectCulturalRestrictions, type CulturalRestrictionRow } from '@/lib/presence/cultural-restriction-detector';

const GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';
const FEATURE_ID = 'F-6.6.7';
const VISA_FEATURE_ID = 'F-6.6.7-visa';
const CULTURAL_FEATURE_ID = 'F-6.6.7-cultural';

type VisibleItem = { key: string; alert: PresenceUiAlert };

function readTimeline(tripId: string): TimelineEntry[] {
  try {
    const raw = localStorage.getItem(`wayfarer_presence_timeline_${tripId}`);
    const arr = raw ? (JSON.parse(raw) as TimelineEntry[]) : [];
    return Array.isArray(arr) ? arr.slice(-20) : [];
  } catch {
    return [];
  }
}

function pushTimeline(tripId: string, label: string) {
  try {
    const key = `wayfarer_presence_timeline_${tripId}`;
    const prev = readTimeline(tripId);
    prev.push({ id: crypto.randomUUID(), at: new Date().toISOString(), label });
    localStorage.setItem(key, JSON.stringify(prev.slice(-40)));
  } catch {
    /* ignore */
  }
}

export default function TripPresencePanel({
  tripId,
  returnDate,
  routeSegments,
  baseCurrency = 'USD',
}: {
  tripId: string;
  returnDate?: string | null;
  routeSegments: RouteSegmentLite[];
  baseCurrency?: string;
}) {
  const { profile } = useAuth();
  const [featureOn, setFeatureOn] = useState(true);
  const [visaOn, setVisaOn] = useState(false);
  const [culturalOn, setCulturalOn] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoReady, setGeoReady] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [settings, setSettings] = useState<PresenceSettingsForm | null>(null);
  const [gaps, setGaps] = useState<CoverageGapLite[]>([]);
  const [summaries, setSummaries] = useState<CoverageSummaryLite[]>([]);
  const [categories, setCategories] = useState<{ category_name: string; exclusion_keywords: string[] }[]>([]);
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [countryInfo, setCountryInfo] = useState<Record<string, CountryInfoPayload>>({});
  const [suppressedSummary, setSuppressedSummary] = useState<{ lines: string[]; count: number }>({ lines: [], count: 0 });
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [settingsReady, setSettingsReady] = useState(false);

  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeoCall = useRef(0);
  const firedRef = useRef<Set<string>>(new Set());
  const stopWatchRef = useRef<(() => void) | null>(null);
  const [trackingStarted, setTrackingStarted] = useState(false);

  const settingsLite: PresenceSettingsLite | null = useMemo(() => {
    if (!settings) return null;
    return {
      enabled: settings.enabled,
      activity_zones_enabled: settings.activity_zones_enabled,
      border_crossings_enabled: settings.border_crossings_enabled,
      missed_connection_enabled: settings.missed_connection_enabled,
      risk_alerts_enabled: settings.risk_alerts_enabled,
      daily_summary_enabled: settings.daily_summary_enabled,
      activity_zone_toggles: settings.activity_zone_toggles || {},
    };
  }, [settings]);

  const loadGovernance = useCallback(async () => {
    const [activationRes, registryRes] = await Promise.all([
      supabase.from('feature_activation_state').select('feature_id, enabled').eq('region_id', GLOBAL_REGION).eq('feature_id', FEATURE_ID).maybeSingle(),
      supabase.from('feature_registry').select('feature_id, default_enabled').eq('feature_id', FEATURE_ID).maybeSingle(),
    ]);
    const enabled = activationRes.data?.enabled ?? registryRes.data?.default_enabled ?? true;
    setFeatureOn(Boolean(enabled));

    const [visaRes, culturalRes] = await Promise.all([
      supabase.from('feature_activation_state').select('enabled').eq('region_id', GLOBAL_REGION).eq('feature_id', VISA_FEATURE_ID).maybeSingle(),
      supabase.from('feature_activation_state').select('enabled').eq('region_id', GLOBAL_REGION).eq('feature_id', CULTURAL_FEATURE_ID).maybeSingle(),
    ]);
    setVisaOn(Boolean(visaRes.data?.enabled));
    setCulturalOn(Boolean(culturalRes.data?.enabled));
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch(`/api/presence/settings?trip_id=${encodeURIComponent(tripId)}`, { credentials: 'include' });
    if (!res.ok) {
      setSettingsReady(true);
      return;
    }
    const j = (await res.json()) as { settings: PresenceSettingsForm };
    setSettings(j.settings);
    setSettingsReady(true);
  }, [tripId]);

  const loadContext = useCallback(async () => {
    const [g, s, c] = await Promise.all([
      supabase.from('coverage_gaps').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(50),
      supabase.from('coverage_summaries').select('*').eq('trip_id', tripId).limit(40),
      supabase.from('activity_risk_categories').select('category_name, exclusion_keywords').eq('is_active', true),
    ]);
    setGaps((g.data || []) as CoverageGapLite[]);
    setSummaries((s.data || []) as CoverageSummaryLite[]);
    setCategories((c.data || []) as { category_name: string; exclusion_keywords: string[] }[]);
  }, [tripId]);

  const refreshAlertsSummary = useCallback(async () => {
    const res = await fetch(`/api/presence/alerts?trip_id=${encodeURIComponent(tripId)}`, { credentials: 'include' });
    if (!res.ok) return;
    const j = (await res.json()) as { alerts: any[]; suppressed_count_today: number };
    const alerts = j.alerts || [];
    const counts = new Map<string, number>();
    for (const a of alerts) {
      if (!a.was_suppressed) continue;
      if (a.suppression_reason !== 'duplicate_within_4hr') continue;
      const sub = (a.alert_subtype as string) || a.alert_type;
      counts.set(sub, (counts.get(sub) || 0) + 1);
    }
    const lines = Array.from(counts.entries()).map(
      ([k, v]) => `${v} times today you were notified about “${k}” (suppressed after the first)`,
    );
    setSuppressedSummary({ lines, count: j.suppressed_count_today || 0 });
  }, [tripId]);

  useEffect(() => {
    void loadGovernance();
    void loadSettings();
    void loadContext();
    void refreshAlertsSummary();
    setTimeline(readTimeline(tripId));
  }, [loadGovernance, loadSettings, loadContext, refreshAlertsSummary, tripId]);

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      const now = Date.now();
      if (lastGeoCall.current !== 0 && now - lastGeoCall.current < 45_000) return;
      lastGeoCall.current = now;
      const res = await fetch(
        `/api/presence/reverse-geocode?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const j = (await res.json()) as { display_name?: string; country_code?: string | null };
      setDisplayName(j.display_name || '');
      setCountryCode(j.country_code || null);
      if (j.display_name) {
        pushTimeline(tripId, j.display_name);
        setTimeline(readTimeline(tripId));
      }
    },
    [tripId],
  );

  const emitAlert = useCallback(
    async (alert: PresenceUiAlert) => {
      let alert_type = 'risk_alert';
      let alert_subtype: string | null = null;
      let severity: string = 'info';
      let country_code: string | null = null;
      const metadata: Record<string, unknown> = {};

      if (alert.kind === 'activity_zone') {
        alert_type = 'activity_zone';
        alert_subtype = alert.subtype;
        severity = alert.severity;
      } else if (alert.kind === 'border_crossing') {
        alert_type = 'border_crossing';
        alert_subtype = null;
        severity = 'info';
        country_code = alert.toCountry;
      } else if (alert.kind === 'missed_connection') {
        alert_type = 'missed_connection';
        alert_subtype = alert.segmentId;
        severity = alert.severity;
        metadata.segment_id = alert.segmentId;
      } else if (alert.kind === 'visa_window') {
        alert_type = 'visa_window';
        alert_subtype = alert.zoneId ? String(alert.zoneId) : alert.countryCode;
        severity = alert.severity;
        country_code = alert.countryCode;
        metadata.visa_type = alert.visaType;
        metadata.zone_id = alert.zoneId || null;
        metadata.days_used = alert.daysUsed ?? null;
        metadata.days_remaining = alert.daysRemaining ?? null;
      } else if (alert.kind === 'cultural_restriction') {
        alert_type = 'cultural_restriction';
        alert_subtype = alert.restrictionId;
        severity = alert.severity;
        country_code = alert.countryCode;
        metadata.event_name = alert.eventName;
        metadata.event_start = alert.eventStart;
        metadata.event_end = alert.eventEnd;
        metadata.event_type = alert.eventType;
        metadata.region = alert.region || null;
      }

      const res = await fetch('/api/presence/alerts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'emit',
          trip_id: tripId,
          alert_type,
          alert_subtype,
          severity,
          country_code,
          metadata,
        }),
      });
      const j = (await res.json()) as { displayed?: boolean };
      return Boolean(j.displayed);
    },
    [tripId],
  );

  function inferStayRegion(countryCode: string, seg: RouteSegmentLite): string | null {
    const hay = `${seg.destination || ''} ${seg.notes || ''}`.toLowerCase();
    if (countryCode === 'ID' && hay.includes('bali')) return 'Bali';
    if (countryCode === 'BR' && (hay.includes('rio') || hay.includes('rio de janeiro'))) return 'Rio de Janeiro';
    return null;
  }

  function buildStaysFromSegments(
    segs: RouteSegmentLite[],
  ): Array<{ country_code: string; region?: string | null; arrive_date: string; depart_date: string }> {
    const sorted = [...segs].filter((s) => s.destination_country_code).sort((a, b) => {
      const ta = a.arrive_at ? new Date(a.arrive_at).getTime() : a.depart_at ? new Date(a.depart_at).getTime() : 0;
      const tb = b.arrive_at ? new Date(b.arrive_at).getTime() : b.depart_at ? new Date(b.depart_at).getTime() : 0;
      return ta - tb;
    });
    const out: Array<{ country_code: string; region?: string | null; arrive_date: string; depart_date: string }> = [];
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const cc = String(s.destination_country_code || '').toUpperCase().slice(0, 2);
      const arrive = s.arrive_at || s.depart_at;
      if (!cc || !arrive) continue;
      const arriveDate = new Date(arrive).toISOString().slice(0, 10);
      const next = sorted[i + 1];
      const nextDepart = next?.depart_at
        ? new Date(next.depart_at).toISOString().slice(0, 10)
        : returnDate
          ? String(returnDate).slice(0, 10)
          : null;
      const departDate = nextDepart || new Date(new Date(arriveDate).getTime() + 86_400_000).toISOString().slice(0, 10);
      if (departDate <= arriveDate) continue;
      out.push({ country_code: cc, region: inferStayRegion(cc, s), arrive_date: arriveDate, depart_date: departDate });
    }
    return out;
  }

  const runEvaluation = useCallback(async () => {
    if (!featureOn || !settingsLite?.enabled) return;

    const borderKey = `wayfarer_presence_border_${tripId}`;
    let lastCountry: string | null = null;
    try {
      lastCountry = sessionStorage.getItem(borderKey);
    } catch {
      lastCountry = null;
    }

    const evaluated: PresenceUiAlert[] = [];

    if (trackingStarted && lat != null && lon != null) {
      evaluated.push(
        ...evaluatePresenceAlerts({
          now: new Date(),
          displayName,
          countryCode,
          lastCountryCode: lastCountry,
          settings: settingsLite,
          coverageGaps: gaps,
          coverageSummaries: summaries,
          routeSegments,
          activityCategories: categories,
          userLat: lat,
          userLon: lon,
        }),
      );
    }

    const passportCountry = String(profile?.preferences?.passport_country || '').toUpperCase().slice(0, 2) || null;
    const stays = buildStaysFromSegments(routeSegments);

    if (visaOn && passportCountry && stays.length > 0) {
      const destCodes = Array.from(new Set(stays.map((s) => s.country_code))).filter(Boolean);
      const { data: reqRows } = await supabase
        .from('visa_requirements')
        .select('passport_country_code,destination_country_code,visa_type,max_stay_days,rolling_window_days,rolling_window_max_days,zone_id,notes,official_source_url,last_verified_at')
        .eq('passport_country_code', passportCountry)
        .in('destination_country_code', destCodes);
      const { data: zoneRows } = await supabase
        .from('visa_zone_members')
        .select('zone_id,country_code')
        .eq('zone_id', 'schengen');

      const visaAlerts = detectVisaWindowAlerts({
        passportCountry,
        stays,
        requirements: (reqRows || []) as VisaRequirementRow[],
        zoneMembers: (zoneRows || []) as Array<{ zone_id: string; country_code: string }>,
        now: new Date(),
      });
      for (const a of visaAlerts) {
        evaluated.push({
          kind: 'visa_window',
          severity: a.severity,
          countryCode: a.destinationCountry === 'SCHENGEN' ? 'FR' : a.destinationCountry,
          visaType: a.visaType,
          title: a.title,
          summary: a.summary,
          daysRemaining: a.daysRemaining ?? null,
          daysUsed: a.daysUsed ?? null,
          zoneId: a.zoneId ?? null,
          officialSourceUrl: a.officialSourceUrl ?? null,
        });
      }
    }

    if (culturalOn && stays.length > 0) {
      const countries = Array.from(new Set(stays.map((s) => s.country_code))).filter(Boolean);
      const { data: rows } = await supabase.from('cultural_legal_restrictions').select('*').in('country_code', countries).eq('is_active', true);

      const flightDates = routeSegments
        .filter((s) => s.depart_at && s.destination_country_code)
        .map((s) => ({
          date: new Date(s.depart_at as string).toISOString().slice(0, 10),
          airport_country: String(s.destination_country_code).toUpperCase().slice(0, 2),
        }));

      const cultural = detectCulturalRestrictions({
        now: new Date(),
        destinations: stays,
        restrictions: (rows || []) as CulturalRestrictionRow[],
        flightDates,
      });

      for (const c of cultural) {
        evaluated.push({
          kind: 'cultural_restriction',
          severity: c.severity,
          restrictionId: c.restriction_id,
          countryCode: c.country_code,
          region: c.region || null,
          eventName: c.event_name,
          eventNameLocal: c.event_name_local || null,
          eventType: c.event_type,
          restrictionSummary: c.restriction_summary,
          restrictionDetail: c.restriction_detail || null,
          travelerImpact: c.traveler_impact || [],
          preparationSteps: c.preparation_steps || [],
          positiveNote: c.positive_note || null,
          enforcementLevel: c.enforcement_level || null,
          penaltyDescription: c.penalty_description || null,
          insuranceNote: c.insurance_note || null,
          eventStart: c.event_start,
          eventEnd: c.event_end,
          daysUntil: c.days_until,
        });
      }
    }

    for (const a of evaluated) {
      const key =
        a.kind === 'activity_zone'
          ? `activity:${a.subtype}`
          : a.kind === 'border_crossing'
            ? `border:${a.toCountry}`
            : a.kind === 'missed_connection'
              ? `missed:${a.segmentId}`
              : a.kind === 'visa_window'
                ? `visa:${a.zoneId || a.countryCode}:${a.visaType}`
                : `cultural:${a.restrictionId}:${a.eventStart}`;
      if (firedRef.current.has(key)) continue;

      const displayed = await emitAlert(a);
      await refreshAlertsSummary();
      firedRef.current.add(key);
      if (displayed) {
        setVisible((prev) => [...prev.filter((p) => p.key !== key), { key, alert: a }]);
        if (a.kind === 'border_crossing') {
          const cc = a.toCountry;
          if (!countryInfo[cc]) {
            const r = await fetch(
              `/api/presence/country-info?country_code=${encodeURIComponent(cc)}&base_currency=${encodeURIComponent(baseCurrency)}`,
              { credentials: 'include' },
            );
            if (r.ok) {
              const payload = (await r.json()) as CountryInfoPayload;
              setCountryInfo((m) => ({ ...m, [cc]: payload }));
            }
          }
        }
      }
    }

    try {
      if (countryCode && countryCode !== lastCountry) {
        sessionStorage.setItem(borderKey, countryCode);
      }
    } catch {
      /* ignore */
    }
  }, [
    trackingStarted,
    featureOn,
    settingsLite,
    lat,
    lon,
    displayName,
    countryCode,
    tripId,
    gaps,
    summaries,
    routeSegments,
    categories,
    emitAlert,
    refreshAlertsSummary,
    countryInfo,
    baseCurrency,
    visaOn,
    culturalOn,
    profile,
    returnDate,
  ]);

  useEffect(() => {
    if (!geoReady || lat == null || lon == null) return;
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(() => {
      void runEvaluation();
    }, 600);
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [geoReady, lat, lon, displayName, countryCode, runEvaluation]);

  // Also run itinerary-driven intel once settings are ready (no geo required).
  useEffect(() => {
    if (!featureOn || !settingsLite?.enabled) return;
    void runEvaluation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureOn, settingsLite, visaOn, culturalOn, routeSegments, returnDate]);

  useEffect(() => {
    if (!geoReady || lat == null || lon == null) return;
    void reverseGeocode(lat, lon);
  }, [geoReady, lat, lon, reverseGeocode]);

  const startTracking = useCallback(() => {
    setGeoDenied(false);
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    requestPresenceLocationOnce()
      .then((pos) => {
        setGeoReady(true);
        setTrackingStarted(true);
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        stopWatchRef.current = watchPresenceLocation({
          onUpdate: (snap) => {
            setLat(snap.latitude);
            setLon(snap.longitude);
          },
          onError: (code) => {
            if (code === 1) setGeoDenied(true);
          },
        });
      })
      .catch(() => setGeoDenied(true));
  }, []);

  useEffect(() => {
    return () => {
      stopWatchRef.current?.();
      stopWatchRef.current = null;
    };
  }, []);

  const snooze = async (alert: PresenceUiAlert, mode: '2h' | 'rest_of_day' | 'trip') => {
    let alert_type = 'risk_alert';
    let alert_subtype: string | null = null;
    if (alert.kind === 'activity_zone') {
      alert_type = 'activity_zone';
      alert_subtype = alert.subtype;
    } else if (alert.kind === 'border_crossing') {
      alert_type = 'border_crossing';
    } else if (alert.kind === 'missed_connection') {
      alert_type = 'missed_connection';
      alert_subtype = alert.segmentId;
    } else if (alert.kind === 'visa_window') {
      alert_type = 'visa_window';
      alert_subtype = alert.zoneId ? String(alert.zoneId) : alert.countryCode;
    } else if (alert.kind === 'cultural_restriction') {
      alert_type = 'cultural_restriction';
      alert_subtype = alert.restrictionId;
    }
    const until = new Date(snoozeUntilMs(mode, new Date(), returnDate)).toISOString();
    await fetch('/api/presence/alerts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'snooze',
        trip_id: tripId,
        alert_type,
        alert_subtype,
        snoozed_until: until,
        metadata: { mode },
      }),
    });
  };

  const dismissVisible = (key: string) => {
    setVisible((v) => v.filter((x) => x.key !== key));
  };

  const saveSettings = async (next: PresenceSettingsForm) => {
    const res = await fetch('/api/presence/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId, ...next }),
    });
    if (res.ok) {
      const j = (await res.json()) as { settings: PresenceSettingsForm };
      setSettings(j.settings);
    }
  };

  if (!featureOn) {
    return null;
  }

  if (settingsReady && settings && !settings.enabled) {
    return null;
  }

  const cellularOk = isLikelyCellularData();
  const formSettings: PresenceSettingsForm =
    settings ||
    ({
      enabled: true,
      activity_zones_enabled: true,
      border_crossings_enabled: true,
      missed_connection_enabled: true,
      risk_alerts_enabled: true,
      daily_summary_enabled: true,
      daily_summary_time: '20:00',
      snooze_default_hours: 2,
      activity_zone_toggles: {
        ski_resorts: true,
        dive_centers: true,
        climbing_areas: true,
        motorbike_rental: true,
        water_sports: true,
        high_altitude: true,
      },
    } as PresenceSettingsForm);

  return (
    <div data-testid="trip-presence-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '14px 16px',
          background: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#334155', letterSpacing: '0.06em' }}>TRIP PRESENCE</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', maxWidth: 520, lineHeight: 1.45 }}>
              Location-aware coverage intelligence (in-app). Opt in to share approximate position — we never track silently.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #1e3a8a',
              background: 'white',
              color: '#1e3a8a',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Presence settings
          </button>
        </div>
        {!trackingStarted ? (
          <div style={{ marginTop: 12, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a' }}>
              Turn on Trip Presence when you want border crossing tips, activity-zone coverage checks, and tight-connection warnings. The
              browser will ask for location — you can revoke any time.
            </p>
            <button
              type="button"
              onClick={startTracking}
              style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#1d4ed8',
                color: 'white',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Enable location for this trip
            </button>
          </div>
        ) : null}
        {trackingStarted && geoDenied ? (
          <div style={{ marginTop: 12, padding: 12, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#78350f' }}>
              Location permission was blocked. Allow location for this site in your browser settings, then try again.
            </p>
            <button
              type="button"
              onClick={startTracking}
              style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#b45309',
                color: 'white',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {formSettings.daily_summary_enabled ? (
        <DailySummaryCard
          timeline={timeline}
          suppressedLines={suppressedSummary.lines}
          onKeep={() => refreshAlertsSummary()}
          onStopForTrip={() => saveSettings({ ...formSettings, enabled: false })}
        />
      ) : null}

      {visible.map(({ key, alert }) => {
        if (alert.kind === 'activity_zone') {
          return (
            <ActivityZoneAlert
              key={key}
              title={alert.title}
              summary={alert.summary}
              policies={alert.policies}
              tripId={tripId}
              onDismiss={() => dismissVisible(key)}
              onSnooze={async (m) => {
                await snooze(alert, m);
                dismissVisible(key);
              }}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          );
        }
        if (alert.kind === 'border_crossing') {
          const info = countryInfo[alert.toCountry];
          return (
            <BorderCrossingAlert
              key={key}
              fromCountry={alert.fromCountry}
              toCountry={alert.toCountry}
              coverageChanges={alert.coverageChanges}
              countryInfo={info || null}
              cellularOk={cellularOk}
              tripId={tripId}
              onDismiss={() => dismissVisible(key)}
              onSnooze={async (m) => {
                await snooze(alert, m);
                dismissVisible(key);
              }}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          );
        }
        if (alert.kind === 'missed_connection') {
          return (
          <MissedConnectionAlert
            key={key}
            airportLabel={alert.airportLabel}
            distanceKm={alert.distanceKm}
            driveMinutes={alert.driveMinutes}
            minutesToDepart={alert.minutesToDepart}
            coverageSummary={alert.coverageSummary}
            tripId={tripId}
            onDismiss={() => dismissVisible(key)}
            onSnooze={async (m) => {
              await snooze(alert, m);
              dismissVisible(key);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          );
        }
        if (alert.kind === 'visa_window') {
          return (
            <VisaWindowAlert
              key={key}
              alert={alert}
              onDismiss={() => dismissVisible(key)}
              onSnooze={async (m) => {
                await snooze(alert, m);
                dismissVisible(key);
              }}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          );
        }
        if (alert.kind === 'cultural_restriction') {
          return (
            <CulturalRestrictionAlert
              key={key}
              alert={alert}
              onDismiss={() => dismissVisible(key)}
              onSnooze={async (m) => {
                await snooze(alert, m);
                dismissVisible(key);
              }}
            />
          );
        }
        return null;
      })}

      <PresenceSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initial={formSettings}
        onSave={saveSettings}
      />
    </div>
  );
}
