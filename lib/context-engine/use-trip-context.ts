'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';
import { evaluateContext, mergeContextualIntelligencePrefs } from './evaluate';
import { parseDismissalsFromPreferences } from './dismiss-store';
import type { ContextInputs, ContextResult } from './types';
import { DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS } from './types';

const GLOBAL_REGION = '00000000-0000-0000-0000-000000000000';

function pollMsForTrip(inputs: { departure_date: string | null; return_date: string | null }): number | null {
  const now = new Date();
  const dep = inputs.departure_date ? new Date(inputs.departure_date) : null;
  const ret = inputs.return_date ? new Date(inputs.return_date) : null;
  if (!dep || !ret) return 5 * 60 * 1000;
  const start = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate());
  const end = new Date(ret.getFullYear(), ret.getMonth(), ret.getDate(), 23, 59, 59, 999);
  if (now < start) return 5 * 60 * 1000;
  if (now > end) return null;
  return 60 * 1000;
}

export function useTripContext(
  tripId: string | undefined,
  trip: {
    trip_id: string;
    trip_name: string;
    maturity_state: string;
    departure_date: string | null;
    return_date: string | null;
    destination_summary: string | null;
    paid_unlock: boolean;
    metadata?: Record<string, unknown> | null;
  } | null,
  profilePreferences: unknown,
  userId: string | undefined,
) {
  const [context, setContext] = useState<ContextResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const prefs = useMemo(() => {
    const raw =
      profilePreferences && typeof profilePreferences === 'object'
        ? (profilePreferences as Record<string, unknown>).contextual_intelligence
        : undefined;
    return mergeContextualIntelligencePrefs(raw);
  }, [profilePreferences]);
  const dismissals = useMemo(() => parseDismissalsFromPreferences(profilePreferences), [profilePreferences]);

  useEffect(() => {
    if (!tripId || !trip || !userId) {
      setContext(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [
          segRes,
          incRes,
          evRes,
          claimRes,
          crRes,
          snapRes,
          featRes,
        ] = await Promise.all([
          supabase.from('route_segments').select('*').eq('trip_id', tripId).order('sort_order', { ascending: true }),
          supabase
            .from('incidents')
            .select('id, title, canonical_status, status, disruption_type, metadata, created_at')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false }),
          supabase.from('evidence').select('id, incident_id, metadata, created_at').order('created_at', { ascending: false }),
          supabase.from('claims').select('claim_id, incident_id, claim_status, created_at').eq('trip_id', tripId),
          supabase.from('carrier_responses').select('response_id, incident_id, action_type').eq('trip_id', tripId),
          supabase
            .from('coverage_graph_snapshots')
            .select('snapshot_id')
            .eq('trip_id', tripId)
            .eq('graph_status', 'COMPLETE')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('feature_activation_state')
            .select('enabled')
            .eq('feature_id', 'F-6.6.14')
            .eq('region_id', GLOBAL_REGION)
            .maybeSingle(),
        ]);

        const snapshotId = snapRes.data?.snapshot_id;
        let summaries: ContextInputs['coverageSummaries'] = [];
        if (snapshotId) {
          const { data: sumData } = await supabase
            .from('coverage_summaries')
            .select('benefit_type, combined_limit, shortest_waiting_period_hours')
            .eq('snapshot_id', snapshotId);
          summaries = (sumData || []) as ContextInputs['coverageSummaries'];
        }

        const incidentIds = (incRes.data || []).map((i) => i.id);
        const evidenceRows = (evRes.data || []).filter((e) => incidentIds.includes(e.incident_id));

        const meta = trip.metadata as { context_weather_summary?: string } | undefined;
        const weatherSummary = meta?.context_weather_summary ?? null;

        const inputs: ContextInputs = {
          profile:
            profilePreferences && typeof profilePreferences === 'object'
              ? { preferences: profilePreferences as Record<string, unknown> }
              : undefined,
          trip: {
            trip_id: trip.trip_id,
            trip_name: trip.trip_name,
            maturity_state: trip.maturity_state,
            departure_date: trip.departure_date,
            return_date: trip.return_date,
            destination_summary: trip.destination_summary,
            paid_unlock: trip.paid_unlock,
          },
          routeSegments: (segRes.data || []).map((s: Record<string, unknown>) => ({
            segment_id: String(s.segment_id),
            origin: String(s.origin ?? ''),
            destination: String(s.destination ?? ''),
            carrier: (s.carrier_name as string) || (s.carrier as string) || null,
            flight_number: (s.flight_number as string) || null,
            reference: (s.reference as string) || null,
            notes: (s.notes as string) || null,
            depart_at: (s.depart_at as string) || null,
            arrive_at: (s.arrive_at as string) || null,
          })),
          incidents: (incRes.data || []).map((i: Record<string, unknown>) => ({
            id: String(i.id),
            title: String(i.title ?? ''),
            status: i.status != null ? String(i.status) : undefined,
            canonical_status: i.canonical_status != null ? String(i.canonical_status) : undefined,
            disruption_type: (i.disruption_type as string) || null,
            metadata: (i.metadata as Record<string, unknown>) || null,
            created_at: String(i.created_at),
          })),
          evidence: evidenceRows.map((e: Record<string, unknown>) => ({
            id: String(e.id),
            incident_id: String(e.incident_id),
            evidence_category:
              (e.metadata as { evidence_category?: string } | undefined)?.evidence_category ||
              (e.metadata as { category?: string } | undefined)?.category,
            metadata: (e.metadata as Record<string, unknown>) || null,
            created_at: String(e.created_at),
          })),
          claims: (claimRes.data || []).map((c: Record<string, unknown>) => ({
            claim_id: String(c.claim_id),
            incident_id: String(c.incident_id),
            claim_status: String(c.claim_status ?? ''),
            created_at: String(c.created_at),
            policy_label: null,
          })),
          carrierResponses: (crRes.data || []).map((r: Record<string, unknown>) => ({
            response_id: String(r.response_id),
            incident_id: String(r.incident_id),
            action_type: String(r.action_type ?? ''),
          })),
          coverageSummaries: summaries,
          dismissedContextKeys: dismissals,
          weatherSummary,
        };

        const foclOn = featRes.data == null ? true : featRes.data.enabled !== false;

        if (!foclOn) {
          if (!cancelled) {
            setContext({
              state: 'quiet_day',
              headline: '',
              urgency: 'calm',
              actions: [],
              metadata: { feature_off: true },
              dismissible: false,
            });
            setLoading(false);
          }
          return;
        }

        const result = evaluateContext(inputs, prefs);
        if (!cancelled) {
          setContext(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setContext(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId, trip, userId, tick, dismissals, prefs, profilePreferences]);

  useEffect(() => {
    if (!trip) return;
    const ms = pollMsForTrip(trip);
    if (ms == null) return;
    const id = setInterval(() => refresh(), ms);
    return () => clearInterval(id);
  }, [trip, refresh]);

  return { context, loading, refresh, prefs: prefs ?? DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS };
}
