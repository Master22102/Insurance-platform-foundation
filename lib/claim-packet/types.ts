/**
 * F-6.5.14 — shared shapes for claim packet PDF + clipboard summary.
 */

export type ClaimPacketStatus = 'draft' | 'ready' | 'exported' | 'superseded';

export type RouteSegmentRow = {
  segment_id?: string;
  segment_type?: string | null;
  origin?: string | null;
  destination?: string | null;
  depart_at?: string | null;
  arrive_at?: string | null;
  reference?: string | null;
  notes?: string | null;
  sort_order?: number | null;
};

export type EvidenceRow = {
  id: string;
  name: string;
  evidence_category?: string | null;
  validation_status?: string | null;
  created_at?: string | null;
};

export type PolicyClauseRow = {
  clause_type: string;
  family_code?: string | null;
  canonical_text: string;
  confidence_label: string;
  source_citation: string;
};

export type RoutingDecisionPayload = {
  structural_alignment_category?: string;
  matched_benefit_type?: string | null;
  alignment_confidence?: string | null;
  guidance_steps?: unknown;
  referenced_clause_ids?: string[] | null;
  routing_metadata?: Record<string, unknown>;
};

export type CarrierResponseBrief = {
  action_type: string;
  action_label: string;
  value_amount?: number | null;
  currency_code?: string | null;
  carrier_ref?: string | null;
  created_at?: string | null;
  notes?: string | null;
};

export type ClaimPacketPdfData = {
  packetId: string;
  packetVersion: number;
  packetStatus: ClaimPacketStatus;
  preparedAt: string;
  wayfarerRefShort: string;
  tripName: string;
  destinationSummary: string;
  departureDate: string;
  returnDate: string;
  incidentTitle: string;
  incidentDescription: string;
  disruptionType: string;
  incidentDateLabel: string;
  /** Factual notes on recorded traveler responses (no interpretive carrier blame). */
  travelerRecordedNotes?: string;
  primaryProvider: string;
  matchedBenefitType: string;
  alignmentCategory: string;
  alignmentConfidence: string;
  clauses: PolicyClauseRow[];
  coverageLimitSummary?: string;
  evidence: EvidenceRow[];
  missingEvidenceLabels: string[];
  sequenceSteps: Array<{ step?: number; action?: string; note?: string }>;
  timeline: Array<{ dateLabel: string; description: string }>;
  /** Structured carrier actions (F-6.5.9); also merged into timeline. */
  carrierResponses: CarrierResponseBrief[];
  affectedSegments: RouteSegmentRow[];
};

/** Input for plain-text clipboard summary (client-safe). */
export type ClaimSummaryClipboardInput = {
  packetId: string;
  tripName: string;
  departureDate: string;
  returnDate: string;
  incidentTitle: string;
  disruptionType: string;
  incidentDate: string;
  matchedBenefitType: string;
  primaryProvider: string;
  alignmentCategory?: string;
  alignmentConfidence?: string;
  evidence: Array<{ name: string; category: string }>;
  sequenceSteps: Array<{ action: string; note?: string }>;
};
