import type { ContextAction, ContextInputs, ContextResult, ContextualIntelligencePrefs } from './types';
import { DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS } from './types';

const FILING_WINDOW_DAYS = 60;
const FILING_ALERT_REMAINING_DAYS = 14;
const FILING_ALERT_MIN_AGE_DAYS = FILING_WINDOW_DAYS - FILING_ALERT_REMAINING_DAYS;

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function daysBetweenDates(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((e.getTime() - s.getTime()) / (86400 * 1000));
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDismissed(keys: string[], tripId: string, key: string): boolean {
  return keys.includes(`${tripId}:${key}`);
}

function incidentDisruptionType(inc: ContextInputs['incidents'][0]): string {
  const meta = inc.metadata as { disruption_type?: string } | null | undefined;
  return (inc.disruption_type || meta?.disruption_type || '').toLowerCase();
}

function isCaptureLike(inc: ContextInputs['incidents'][0]): boolean {
  const c = (inc.canonical_status || inc.status || '').toUpperCase();
  return c === 'OPEN' || c === 'EVIDENCE_GATHERING' || c === 'CAPTURE' || c === 'REVIEW' || c === 'REVIEW_PENDING';
}

function expectedEvidenceCount(disruptionType: string): number {
  const t = disruptionType.toLowerCase();
  if (t.includes('delay')) return 3;
  if (t.includes('cancel')) return 2;
  if (t.includes('bag')) return 2;
  if (t.includes('missed') || t.includes('connection')) return 3;
  return 2;
}

function evidenceCountForIncident(inputs: ContextInputs, incidentId: string): number {
  return inputs.evidence.filter((e) => e.incident_id === incidentId).length;
}

function uncategorizedEvidenceCount(inputs: ContextInputs, incidentId: string): number {
  return inputs.evidence.filter((e) => {
    if (e.incident_id !== incidentId) return false;
    const cat =
      e.evidence_category ||
      (e.metadata as { evidence_category?: string } | undefined)?.evidence_category ||
      (e.metadata as { category?: string } | undefined)?.category;
    return cat === 'uncategorized';
  }).length;
}

function checklistForDisruption(disruptionType: string): string[] {
  const t = disruptionType.toLowerCase();
  if (t.includes('cancel'))
    return ['Cancellation notice', 'Rebooking confirmation', 'Expense receipts'];
  if (t.includes('bag'))
    return ['Baggage desk receipt', 'PIR form photo', 'Baggage tag photo'];
  if (t.includes('missed') || t.includes('connection'))
    return ['Original boarding pass', 'Connection gate board', 'Carrier communication'];
  return ['Gate board showing delay', 'Carrier notification screenshot', 'Meal receipts (itemized)'];
}

function pickDelayCoverageSummary(inputs: ContextInputs): ContextInputs['coverageSummaries'][0] | null {
  for (const s of inputs.coverageSummaries) {
    const bt = (s.benefit_type || '').toLowerCase();
    if (bt.includes('delay') || bt.includes('trip') || bt.includes('disruption')) return s;
  }
  return inputs.coverageSummaries[0] ?? null;
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function mergeContextualIntelligencePrefs(raw: unknown): ContextualIntelligencePrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS };
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    preparation_prompts: o.preparation_prompts !== false,
    evidence_suggestions: o.evidence_suggestions !== false,
    disruption_guidance: o.disruption_guidance !== false,
    filing_deadline_warnings: o.filing_deadline_warnings !== false,
  };
}

function emptyQuiet(prefsOff: boolean): ContextResult {
  return {
    state: 'quiet_day',
    headline: prefsOff ? 'Contextual prompts are off' : '',
    subheadline: prefsOff ? 'Turn contextual intelligence back on in Settings → Preferences anytime.' : undefined,
    urgency: 'calm',
    actions: [],
    metadata: prefsOff ? { contextual_intel_user_off: true } : { hidden: true },
    dismissible: false,
  };
}

export function evaluateContext(
  inputs: ContextInputs,
  prefs: ContextualIntelligencePrefs = DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS,
): ContextResult {
  const now = inputs.now ?? new Date();
  const tripId = inputs.trip.trip_id;
  const dismissKeys = inputs.dismissedContextKeys;

  if (!prefs.enabled) {
    return emptyQuiet(true);
  }

  const departure = parseDate(inputs.trip.departure_date);
  const ret = parseDate(inputs.trip.return_date);

  const tripActive =
    departure &&
    ret &&
    now >= new Date(departure.getFullYear(), departure.getMonth(), departure.getDate()) &&
    now <= new Date(ret.getFullYear(), ret.getMonth(), ret.getDate(), 23, 59, 59, 999);

  const tripEnded = ret && now > new Date(ret.getFullYear(), ret.getMonth(), ret.getDate(), 23, 59, 59, 999);
  const tripNotStarted = departure && now < new Date(departure.getFullYear(), departure.getMonth(), departure.getDate());

  /** Rule 1 — Active disruption */
  if (prefs.disruption_guidance) {
    const disruptionIncidents = inputs.incidents.filter((inc) => {
      if (!isCaptureLike(inc)) return false;
      const created = new Date(inc.created_at);
      if (hoursBetween(created, now) > 48) return false;
      const dt = incidentDisruptionType(inc);
      return dt.length > 0 || /delay|cancel|disrupt|missed|baggage/i.test(inc.title);
    });

    for (const inc of disruptionIncidents) {
      const dKey = `disruption-${inc.id}`;
      if (isDismissed(dismissKeys, tripId, dKey)) continue;

      const dt = incidentDisruptionType(inc) || 'delay';
      const seg =
        inputs.routeSegments.find((s) => s.depart_at && new Date(s.depart_at) > new Date(now.getTime() - 86400000)) ||
        inputs.routeSegments[0];
      const carrier = seg?.carrier || '';
      const fn = (seg?.flight_number || seg?.reference || '').trim();
      const headline =
        fn || carrier
          ? `Disruption reported — ${[carrier, fn].filter(Boolean).join(' ')}`.trim()
          : inc.title?.trim() || 'Disruption reported';

      const cov = pickDelayCoverageSummary(inputs);
      const thresholdH = cov?.shortest_waiting_period_hours ?? null;
      const lim = cov?.combined_limit ?? null;

      const actions: ContextAction[] = [];
      actions.push({
        id: `open-${inc.id}`,
        label: 'Open incident and start capturing',
        type: 'navigate',
        href: `/trips/${tripId}/incidents/${inc.id}`,
        icon: 'camera',
        variant: 'primary',
      });
      if (thresholdH != null && prefs.disruption_guidance) {
        actions.push({
          id: 'threshold',
          label: `Delay coverage often starts after ${thresholdH}h — up to ${formatMoney(lim)}`,
          type: 'navigate',
          href: `/trips/${tripId}?tab=Coverage`,
          icon: 'shield',
          variant: 'secondary',
        });
      }

      return {
        state: 'active_disruption',
        headline,
        subheadline: seg?.destination ? `Itinerary includes ${seg.destination}` : undefined,
        urgency: 'urgent',
        actions,
        metadata: {
          incident_id: inc.id,
          disruption_type: dt,
          segment_id: seg?.segment_id,
          checklist_items: prefs.evidence_suggestions ? checklistForDisruption(dt) : [],
        },
        dismissible: true,
        dismissKey: dKey,
      };
    }
  }

  /** Rule 2 — Defer-protect */
  if (prefs.evidence_suggestions) {
    const activeInc = inputs.incidents
      .filter((i) => {
        const c = (i.canonical_status || i.status || '').toUpperCase();
        return c === 'OPEN' || c === 'EVIDENCE_GATHERING' || c === 'CAPTURE';
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (activeInc) {
      const evc = evidenceCountForIncident(inputs, activeInc.id);
      const hasCarrier = inputs.carrierResponses.some((r) => r.incident_id === activeInc.id);
      const claim = inputs.claims.find((c) => c.incident_id === activeInc.id);
      const claimRoutingStarted = claim && !['DRAFT', 'READY'].includes((claim.claim_status || '').toUpperCase());

      let incomplete = 0;
      if (evc === 0) incomplete += 1;
      if (!hasCarrier) incomplete += 1;
      if (!claimRoutingStarted) incomplete += 1;

      /* Defer-protect: user has started capturing (≥1 evidence) but still has ≥2 open steps. */
      if (incomplete >= 2 && evc >= 1) {
        return {
          state: 'defer_protect',
          headline: 'Capture now, organize later',
          subheadline: "You don't have to get everything perfect right now.",
          urgency: 'urgent',
          actions: [
            {
              id: 'organize',
              label: "I'm ready to organize",
              type: 'navigate',
              href: `/trips/${tripId}/incidents/${activeInc.id}`,
              variant: 'primary',
              icon: 'check',
            },
          ],
          metadata: {
            incident_id: activeInc.id,
            uncategorized_count: uncategorizedEvidenceCount(inputs, activeInc.id),
            incomplete_steps: incomplete,
          },
          dismissible: false,
        };
      }
    }
  }

  /** Rule 3 — Filing deadline */
  if (prefs.filing_deadline_warnings) {
    for (const cl of inputs.claims) {
      const dKey = `deadline-${cl.claim_id}`;
      if (isDismissed(dismissKeys, tripId, dKey)) continue;
      const created = new Date(cl.created_at);
      const ageDays = daysBetweenDates(created, now);
      const st = (cl.claim_status || '').toUpperCase();
      const inFlight = ['DRAFT', 'READY', 'SUBMITTED', 'ACKNOWLEDGED', 'DISPUTED'].includes(st);
      if (!inFlight) continue;
      if (ageDays < FILING_ALERT_MIN_AGE_DAYS || ageDays >= FILING_WINDOW_DAYS) continue;
      const remaining = Math.max(1, FILING_WINDOW_DAYS - ageDays);
      const label = cl.policy_label || 'Your policy';

      return {
        state: 'filing_deadline',
        headline: 'Filing deadline approaching',
        subheadline: `${label} — filing window closes in about ${remaining} days`,
        urgency: 'attention',
        actions: [
          {
            id: 'go-claim',
            label: 'Go to Claims',
            type: 'navigate',
            href: `/trips/${tripId}?tab=Claims`,
            icon: 'clock',
            variant: 'primary',
          },
        ],
        metadata: { claim_id: cl.claim_id, incident_id: cl.incident_id },
        dismissible: true,
        dismissKey: dKey,
      };
    }
  }

  /** Rule 4 — Departure imminent */
  if (prefs.disruption_guidance) {
    for (const seg of inputs.routeSegments) {
      if (!seg.depart_at) continue;
      const dep = new Date(seg.depart_at);
      if (dep <= now || dep.getTime() - now.getTime() > 2 * 60 * 60 * 1000) continue;
      const dKey = `departure-${seg.segment_id}`;
      if (isDismissed(dismissKeys, tripId, dKey)) continue;

      const mins = Math.max(1, Math.round((dep.getTime() - now.getTime()) / 60000));
      const timeRemaining =
        mins >= 60
          ? `${Math.floor(mins / 60)}h ${mins % 60}m`
          : `${mins} minutes`;

      const cov = pickDelayCoverageSummary(inputs);
      const th = cov?.shortest_waiting_period_hours;
      const amt = cov?.combined_limit;

      const actions: ContextAction[] = [];
      if (th != null) {
        actions.push({
          id: 'cov-delay',
          label: `If delayed, coverage often triggers after ${th}h — up to ${formatMoney(amt)}`,
          type: 'navigate',
          href: `/trips/${tripId}?tab=Coverage`,
          icon: 'shield',
          variant: 'secondary',
        });
      }
      actions.push({
        id: 'screenshots',
        label: 'Save delay screenshots if anything changes',
        type: 'navigate',
        href: `/trips/${tripId}/incidents/new`,
        icon: 'camera',
        variant: 'secondary',
      });

      const carrierBit = [seg.carrier, seg.flight_number].filter(Boolean).join(' ');

      return {
        state: 'departure_imminent',
        headline: `Heading to ${seg.destination || 'your next stop'} — departs in ${timeRemaining}`,
        subheadline: carrierBit || seg.reference || seg.origin ? `${carrierBit || ''} ${seg.origin ? `from ${seg.origin}` : ''}`.trim() : undefined,
        urgency: 'attention',
        actions,
        metadata: { segment_id: seg.segment_id, depart_at: seg.depart_at },
        dismissible: true,
        dismissKey: dKey,
      };
    }
  }

  /** Pet international travel — signal_profile from onboarding */
  const petTravel = (inputs.profile?.preferences as Record<string, unknown> | undefined)?.signal_profile as
    | Record<string, unknown>
    | undefined;
  const hasPetTravel = petTravel?.pet_travel === true;
  const petDestType = petTravel?.pet_destination_type as string | undefined;
  if (
    hasPetTravel &&
    petDestType === 'international' &&
    !isDismissed(dismissKeys, tripId, 'pet_international')
  ) {
    return {
      state: 'pre_trip',
      headline: 'You mentioned traveling internationally with a pet',
      subheadline:
        'Documentation rules vary by destination — microchips, health certificates, and advance government notices are common. Some countries need many weeks of preparation.',
      urgency: 'attention',
      actions: [
        {
          id: 'pet-readiness',
          type: 'navigate',
          label: 'See pet travel requirements',
          href: `/trips/${tripId}/readiness-pins?section=pet`,
          icon: 'shield',
          variant: 'primary',
        },
        {
          id: 'pet-dismiss',
          type: 'dismiss',
          label: 'I have this covered',
          variant: 'secondary',
        },
      ],
      metadata: {
        corpus_hint: 'USDA_APHIS_Pet_Travel',
        regulatory_docs: [
          'CDC_Dog_Import_Requirements',
          'MAFF_AQS_Japan_Pet_Import',
          'EU_Pet_Movement_Non_EU',
        ],
      },
      dismissible: true,
      dismissKey: 'pet_international',
    };
  }

  /** Rule 5 — Evidence needed */
  if (prefs.evidence_suggestions) {
    for (const inc of inputs.incidents) {
      if (!isCaptureLike(inc)) continue;
      const dKey = `evidence-${inc.id}`;
      if (isDismissed(dismissKeys, tripId, dKey)) continue;
      const dt = incidentDisruptionType(inc);
      const expected = expectedEvidenceCount(dt);
      const have = evidenceCountForIncident(inputs, inc.id);
      if (have >= expected) continue;

      return {
        state: 'evidence_needed',
        headline: `Open incident — ${have} of ~${expected} evidence items`,
        subheadline: `Adjusters typically need more documentation for ${dt || 'this disruption type'}`,
        urgency: 'attention',
        actions: [
          {
            id: 'add-evidence',
            label: 'Add evidence',
            type: 'navigate',
            href: `/trips/${tripId}/incidents/${inc.id}`,
            icon: 'camera',
            variant: 'primary',
          },
        ],
        metadata: { incident_id: inc.id, expected, have, disruption_type: dt },
        dismissible: true,
        dismissKey: dKey,
      };
    }
  }

  /** Rule 6 — Pre-trip */
  if (prefs.preparation_prompts && tripNotStarted && departure) {
    const days = daysBetweenDates(now, departure);
    if (days >= 0 && days <= 3) {
      const ms = (inputs.trip.maturity_state || '').toUpperCase();
      if (ms === 'DRAFT' || ms === 'PRE_TRIP_STRUCTURED') {
        const dKey = `pretrip-${tripId}-${inputs.trip.departure_date || ''}`;
        if (!isDismissed(dismissKeys, tripId, dKey)) {
          const dest = inputs.trip.destination_summary || 'your destination';
          return {
            state: 'pre_trip',
            headline: `Your trip to ${dest} starts in ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}`,
            subheadline: 'Get documents and coverage ready before you go.',
            urgency: 'calm',
            actions: [
              {
                id: 'docs',
                label: 'Download documents for offline access',
                type: 'navigate',
                href: `/trips/${tripId}?tab=Coverage`,
                icon: 'download',
                variant: 'secondary',
              },
              {
                id: 'coverage',
                label: 'Review coverage summary',
                type: 'navigate',
                href: `/trips/${tripId}?tab=Coverage`,
                icon: 'shield',
                variant: 'secondary',
              },
              {
                id: 'readiness',
                label: 'Check readiness pins',
                type: 'navigate',
                href: `/trips/${tripId}/readiness-pins`,
                icon: 'check',
                variant: 'primary',
              },
            ],
            metadata: { days_until_departure: days },
            dismissible: true,
            dismissKey: dKey,
          };
        }
      }
    }
  }

  /** Rule 7 — Quiet day */
  if (tripActive && !tripEnded) {
    const dayN = departure ? Math.max(1, daysBetweenDates(departure, now) + 1) : 1;
    const dest = inputs.trip.destination_summary || 'your trip';
    const nextSeg = inputs.routeSegments
      .filter((s) => s.depart_at && new Date(s.depart_at) > now)
      .sort((a, b) => new Date(a.depart_at!).getTime() - new Date(b.depart_at!).getTime())[0];

    const actions: ContextAction[] = [];
    if (nextSeg?.depart_at) {
      const t = new Date(nextSeg.depart_at).toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
      actions.push({
        id: 'next-flight',
        label: `Next leg: ${nextSeg.destination || 'En route'} · ${t}`,
        type: 'navigate',
        href: `/trips/${tripId}?tab=Route`,
        icon: 'clock',
        variant: 'secondary',
      });
    }

    return {
      state: 'quiet_day',
      headline: `Day ${dayN} in ${dest}`,
      subheadline: inputs.weatherSummary || 'No disruptions flagged. Enjoy your trip.',
      urgency: 'calm',
      actions,
      metadata: { day_number: dayN, next_segment_id: nextSeg?.segment_id },
      dismissible: false,
    };
  }

  /** Fallback — not on trip / archived */
  return {
    state: 'quiet_day',
    headline: tripEnded ? 'Trip wrapped' : 'Ready when you are',
    subheadline: tripEnded ? 'Review incidents or claims if anything is still open.' : undefined,
    urgency: 'calm',
    actions: tripEnded
      ? [
          {
            id: 'incidents',
            label: 'View incidents',
            type: 'navigate',
            href: `/trips/${tripId}?tab=Incidents`,
            variant: 'secondary',
          },
        ]
      : [],
    metadata: { phase: tripEnded ? 'post_trip' : 'idle' },
    dismissible: false,
  };
}
