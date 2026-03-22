import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGuidanceSteps } from '@/lib/pipeline/coverage-and-routing';
import { filterAffectedRouteSegments } from './filter-affected-segments';
import type {
  CarrierResponseBrief,
  ClaimPacketPdfData,
  ClaimPacketStatus,
  EvidenceRow,
  PolicyClauseRow,
  RoutingDecisionPayload,
  RouteSegmentRow,
} from './types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function collectRequiredEvidenceLabels(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  const out: string[] = [];
  for (const item of steps) {
    const o = asRecord(item);
    const req = o?.required_evidence;
    if (Array.isArray(req)) {
      for (const x of req) {
        if (typeof x === 'string' && x.trim()) out.push(x.replace(/_/g, ' '));
      }
    }
  }
  return Array.from(new Set(out));
}

function parseRoutingFromPayload(payload: Record<string, unknown> | null): RoutingDecisionPayload {
  if (!payload) return {};
  const rd = payload.routing_decision;
  if (!rd || typeof rd !== 'object' || Array.isArray(rd)) return {};
  const r = rd as Record<string, unknown>;
  const idsRaw = r.referenced_clause_ids;
  const referenced_clause_ids = Array.isArray(idsRaw)
    ? idsRaw.map((x) => String(x)).filter(Boolean)
    : null;
  const meta = r.routing_metadata;
  return {
    structural_alignment_category: typeof r.structural_alignment_category === 'string' ? r.structural_alignment_category : undefined,
    matched_benefit_type: typeof r.matched_benefit_type === 'string' ? r.matched_benefit_type : null,
    alignment_confidence: typeof r.alignment_confidence === 'string' ? r.alignment_confidence : null,
    guidance_steps: r.guidance_steps,
    referenced_clause_ids,
    routing_metadata: meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : undefined,
  };
}

function buildTravelerRecordedNotes(incident: Record<string, unknown>): string | undefined {
  const meta = incident.metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  const m = meta as Record<string, unknown>;
  const cp = m.acceptance_checkpoint;
  if (!cp || typeof cp !== 'object' || Array.isArray(cp)) return undefined;
  const c = cp as Record<string, unknown>;
  const comp = typeof c.accepted_compensation === 'string' ? c.accepted_compensation : '';
  const arrange = typeof c.arrange_own_now === 'string' ? c.arrange_own_now : '';
  const parts: string[] = [];
  if (comp && comp !== 'none') {
    parts.push(`Recorded traveler selection for prior compensation offers: ${comp.replace(/_/g, ' ')}.`);
  } else if (comp === 'none') {
    parts.push('Recorded traveler selection: no compensation offers accepted yet (per traveler input).');
  }
  if (arrange && arrange !== 'undecided') {
    parts.push(`Self-arranged alternative transport (traveler input): ${arrange}.`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

function ts(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function mergeCarrierIntoTimeline(
  carriers: CarrierResponseBrief[],
  base: Array<{ dateLabel: string; description: string }>,
): Array<{ dateLabel: string; description: string }> {
  const fromCarrier = carriers.map((cr) => {
    const kind = String(cr.action_type || '').replace(/_/g, ' ');
    const amt =
      cr.value_amount != null && cr.value_amount !== undefined
        ? ` — ${cr.currency_code || 'USD'} ${cr.value_amount}`
        : '';
    const ref = cr.carrier_ref ? ` — ref: ${cr.carrier_ref}` : '';
    return {
      _t: ts(cr.created_at ?? undefined),
      dateLabel: formatDateLabel(cr.created_at ?? undefined),
      description: `Carrier action (traveler record): ${cr.action_label} (${kind})${amt}${ref}`,
    };
  });
  const maxC = fromCarrier.reduce((m, x) => Math.max(m, x._t), 0);
  const withBase = base.map((row, i) => ({
    _t: maxC + (i + 1) * 60_000,
    dateLabel: row.dateLabel,
    description: row.description,
  }));
  return [...fromCarrier, ...withBase]
    .sort((a, b) => a._t - b._t)
    .map(({ _t, ...row }) => row);
}

function buildTimeline(incident: Record<string, unknown>): Array<{ dateLabel: string; description: string }> {
  const rows: Array<{ dateLabel: string; description: string }> = [];
  const t0 = incident.disruption_start_at ? String(incident.disruption_start_at) : '';
  const t1 = incident.disruption_end_at ? String(incident.disruption_end_at) : '';
  if (t0) {
    rows.push({
      dateLabel: formatDateLabel(t0),
      description: 'Disruption window start (on record).',
    });
  }
  if (t1) {
    rows.push({
      dateLabel: formatDateLabel(t1),
      description: 'Disruption window end (on record).',
    });
  }
  const created = incident.created_at ? String(incident.created_at) : '';
  if (created) {
    rows.push({
      dateLabel: formatDateLabel(created),
      description: 'Incident record created in Wayfarer.',
    });
  }
  if (rows.length === 0) {
    rows.push({
      dateLabel: '—',
      description: 'Add dates in your incident record to strengthen the timeline.',
    });
  }
  return rows;
}

export async function assembleClaimPacketForPdf(
  supabase: SupabaseClient,
  packetId: string,
): Promise<{ ok: true; data: ClaimPacketPdfData } | { ok: false; error: string; status?: number }> {
  const { data: packet, error: pErr } = await supabase
    .from('claim_packets')
    .select('*')
    .eq('packet_id', packetId)
    .maybeSingle();

  if (pErr || !packet) {
    return { ok: false, error: 'Packet not found', status: 404 };
  }

  const payload = asRecord(packet.packet_payload as unknown);
  const routing = parseRoutingFromPayload(payload);

  const [
    { data: incident, error: iErr },
    { data: trip, error: tErr },
    { data: segments, error: sErr },
    { data: evidenceRows, error: eErr },
    { data: policies, error: polErr },
    { data: carrierRows, error: carErr },
  ] = await Promise.all([
    supabase.from('incidents').select('*').eq('id', packet.incident_id).maybeSingle(),
    supabase.from('trips').select('trip_name, destination_summary, departure_date, return_date').eq('trip_id', packet.trip_id).maybeSingle(),
    supabase
      .from('route_segments')
      .select('*')
      .eq('trip_id', packet.trip_id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('evidence')
      .select('id, name, evidence_category, validation_status, created_at')
      .eq('incident_id', packet.incident_id)
      .order('created_at', { ascending: true }),
    supabase.from('policies').select('provider_name').eq('trip_id', packet.trip_id).limit(1),
    supabase
      .from('carrier_responses')
      .select('action_type, action_label, value_amount, currency_code, carrier_ref, created_at, notes')
      .eq('incident_id', packet.incident_id)
      .order('created_at', { ascending: true }),
  ]);

  if (iErr || !incident) return { ok: false, error: 'Incident not found', status: 404 };
  if (tErr || !trip) return { ok: false, error: 'Trip not found', status: 404 };
  if (sErr) return { ok: false, error: 'Could not load itinerary segments', status: 500 };
  if (eErr) return { ok: false, error: 'Could not load evidence', status: 500 };
  if (polErr) return { ok: false, error: 'Could not load policy context', status: 500 };
  /* Pre-migration: carrier_responses may not exist yet — degrade without failing PDF. */
  const carriersSafe = carErr ? [] : ((carrierRows || []) as CarrierResponseBrief[]);

  const inc = incident as Record<string, unknown>;
  const segList = (segments || []) as RouteSegmentRow[];
  const affected = filterAffectedRouteSegments(segList, {
    title: inc.title as string,
    description: inc.description as string,
    disruption_type: inc.disruption_type as string,
    disruption_start_at: inc.disruption_start_at as string,
    metadata: (inc.metadata as Record<string, unknown>) || null,
  });

  const clauseIds = routing.referenced_clause_ids?.filter(Boolean) ?? [];
  let clauses: PolicyClauseRow[] = [];
  if (clauseIds.length > 0) {
    const { data: clauseData, error: cErr } = await supabase
      .from('policy_clauses')
      .select('clause_type, family_code, canonical_text, confidence_label, source_citation, extraction_status')
      .in('clause_id', clauseIds)
      .eq('extraction_status', 'AUTO_ACCEPTED');
    if (!cErr && clauseData) {
      clauses = clauseData as PolicyClauseRow[];
    }
  }

  const benefitLimit = clauses.find((c) => c.clause_type === 'benefit_limit');
  const coverageLimitSummary = benefitLimit
    ? benefitLimit.canonical_text.length > 280
      ? `${benefitLimit.canonical_text.slice(0, 277)}…`
      : benefitLimit.canonical_text
    : undefined;

  const primaryProvider =
    (policies && policies[0] && typeof policies[0].provider_name === 'string' && policies[0].provider_name.trim()) ||
    '—';

  const packetSteps = packet.sequence_steps;
  const seqFromPacket = normalizeGuidanceSteps(packetSteps);
  const seqFromRouting = normalizeGuidanceSteps(routing.guidance_steps);
  const sequenceSteps = seqFromPacket.length > 0 ? seqFromPacket : seqFromRouting;

  const requiredFromSteps = collectRequiredEvidenceLabels(packetSteps);
  const requiredFromRouting = collectRequiredEvidenceLabels(routing.guidance_steps);
  const required = Array.from(new Set([...requiredFromSteps, ...requiredFromRouting]));

  const evidence = (evidenceRows || []) as EvidenceRow[];
  const evBlob = evidence
    .map((x) => `${x.name || ''} ${x.evidence_category || ''}`.toLowerCase())
    .join(' ');
  const missingEvidenceLabels = required.filter((label) => {
    const L = label.toLowerCase();
    const under = L.replace(/\s+/g, '_');
    return !evBlob.includes(L) && !evBlob.includes(under);
  });

  const meta = inc.metadata && typeof inc.metadata === 'object' && !Array.isArray(inc.metadata) ? (inc.metadata as Record<string, unknown>) : {};
  const metaDisruption = typeof meta.disruption_type === 'string' ? meta.disruption_type : '';
  const disruptionType = String(inc.disruption_type || metaDisruption || payload?.disruption_type || '—');

  const incidentDateLabel =
    formatDateLabel(inc.disruption_start_at as string) !== '—'
      ? formatDateLabel(inc.disruption_start_at as string)
      : formatDateLabel(inc.created_at as string);

  const wayfarerRefShort = String(packetId).replace(/-/g, '').slice(0, 8).toUpperCase();

  const baseTimeline = buildTimeline(inc);
  const mergedTimeline = mergeCarrierIntoTimeline(carriersSafe, baseTimeline);

  const data: ClaimPacketPdfData = {
    packetId,
    packetVersion: Number(packet.packet_version) || 1,
    packetStatus: (packet.packet_status as ClaimPacketStatus) || 'ready',
    preparedAt: new Date().toISOString(),
    wayfarerRefShort,
    tripName: String(trip.trip_name || 'Trip'),
    destinationSummary: String(trip.destination_summary || '—'),
    departureDate: trip.departure_date ? String(trip.departure_date) : '—',
    returnDate: trip.return_date ? String(trip.return_date) : '—',
    incidentTitle: String(inc.title || 'Incident'),
    incidentDescription: String(inc.description || ''),
    disruptionType,
    incidentDateLabel,
    travelerRecordedNotes: buildTravelerRecordedNotes(inc),
    primaryProvider,
    matchedBenefitType: String(routing.matched_benefit_type || '—'),
    alignmentCategory: String(routing.structural_alignment_category || '—'),
    alignmentConfidence: String(routing.alignment_confidence || '—'),
    clauses,
    coverageLimitSummary,
    evidence,
    missingEvidenceLabels,
    sequenceSteps,
    timeline: mergedTimeline,
    carrierResponses: carriersSafe,
    affectedSegments: affected,
  };

  return { ok: true, data };
}
