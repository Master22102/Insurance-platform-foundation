/**
 * Database Types
 *
 * TypeScript definitions for database schema
 */

export type TripMaturityState =
  | 'DRAFT'
  | 'PRE_TRIP_STRUCTURED'
  | 'INCIDENT_OPEN'
  | 'DOCUMENTATION_IN_PROGRESS'
  | 'CLAIM_ROUTING_LOCKED'
  | 'CLAIM_SUBMITTED'
  | 'POST_TRIP_RESOLVED'
  | 'ARCHIVED';

export interface Trip {
  trip_id: string;
  trip_name: string;
  description: string;
  maturity_state: TripMaturityState;
  itinerary_hash: string | null;
  itinerary_version: number;
  jurisdiction_ids: string[];
  travel_mode_primary: string;
  is_group_trip: boolean;
  paid_unlock: boolean;
  paid_unlock_at: string | null;
  lifecycle_flags: Record<string, any>;
  created_at: string;
  created_by: string | null;
}

export type CanonicalIncidentStatus =
  | 'OPEN'
  | 'EVIDENCE_GATHERING'
  | 'REVIEW_PENDING'
  | 'CLAIM_ROUTING_READY'
  | 'SUBMITTED'
  | 'CLOSED'
  | 'DISPUTED';

export type CausalityStatus = 'CONFIRMED' | 'PROBABLE' | 'DISPUTED' | 'UNKNOWN';

export type OptionsEngineTrigger = 'narrative_detection' | 'explicit_tap';

export type ArrangementIntentConfirmed = 'arranging_own' | 'waiting_airline' | 'undecided';

export type DisruptionResolutionState =
  | 'DISRUPTION_SUSPECTED'
  | 'DISRUPTION_CONFIRMED'
  | 'CARRIER_ENGAGEMENT_ACTIVE'
  | 'OFFER_RECEIVED'
  | 'OFFER_EVALUATED'
  | 'OFFER_ACCEPTED'
  | 'OWN_RESOLUTION_ACTIVE'
  | 'DOCUMENTATION_ACTIVE'
  | 'EVIDENCE_COMPLETE'
  | 'ROUTING_DETERMINED'
  | 'RIGHTS_WINDOW_ACTIVE'
  | 'CLAIM_ACTIVE'
  | 'RESOLUTION_COMPLETE';

export type StatutoryFramework =
  | 'EU261'
  | 'US_DOT'
  | 'MONTREAL_CONVENTION'
  | 'UK_RETAINED';

export interface Incident {
  id: string;
  trip_id: string;
  canonical_status: CanonicalIncidentStatus;
  title: string;
  description: string;
  causality_status: CausalityStatus | null;
  disruption_type: string | null;
  dual_branch_active: boolean;
  disruption_start_at: string | null;
  disruption_end_at: string | null;
  documentation_completeness_state: string | null;
  resolution_status: string | null;
  cco_id: string | null;
  preference_context: Record<string, any> | null;
  options_engine_activated: boolean;
  options_engine_activated_at: string | null;
  options_engine_trigger: OptionsEngineTrigger | null;
  arrangement_intent_confirmed: ArrangementIntentConfirmed | null;
  live_options_connector_id: string | null;
  live_options_result: Record<string, any> | null;
  live_options_retrieved_at: string | null;
  live_options_expires_at: string | null;
  selected_option_id: string | null;
  booking_link_opened_at: string | null;
  created_at: string;
  created_by: string | null;
}

export type ChecklistItemCategory =
  | 'entry_requirement'
  | 'health_requirement'
  | 'platform_document'
  | 'emergency_prep';

export type ChecklistItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'uploaded'
  | 'verified'
  | 'waived'
  | 'waived_by_itinerary_change';

export interface ParticipantChecklistItem {
  item_id: string;
  trip_id: string;
  participant_account_id: string;
  item_category: ChecklistItemCategory;
  item_key: string;
  item_label: string;
  item_detail: string | null;
  source_country: string;
  destination_countries: string[];
  status: ChecklistItemStatus;
  blocking_coverage: boolean;
  itinerary_version: number;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export type ConfidenceTier =
  | 'HIGH'
  | 'CONDITIONAL'
  | 'AMBIGUOUS'
  | 'DOCUMENTATION_INCOMPLETE'
  | 'CONFLICT_PRESENT'
  | 'INSUFFICIENT_DATA';

export interface Policy {
  policy_id: string;
  account_id: string;
  trip_id: string | null;
  policy_label: string;
  active_version_id: string | null;
  provider_name: string | null;
  lifecycle_state: 'active' | 'superseded' | 'archived';
  created_at: string;
}

export interface PolicyVersion {
  version_id: string;
  policy_id: string;
  version_number: number;
  effective_date: string | null;
  expiration_date: string | null;
  governing_jurisdiction: string[];
  coverage_limits_json: Record<string, any>;
  deductible_json: Record<string, any> | null;
  exclusions_json: any[];
  content_hash: string;
  normalization_pipeline_version: string;
  confidence_tier: ConfidenceTier;
  source_type: 'pdf_upload' | 'email_forward' | 'manual_entry';
  raw_artifact_path: string | null;
  ingested_at: string;
  ingested_by: string;
  itr_trace_id: string | null;
}

export type ClaimStatus =
  | 'initiated'
  | 'evidence_gathering'
  | 'routing_determined'
  | 'packet_ready'
  | 'submitted_by_traveler'
  | 'outcome_recorded'
  | 'abandoned';

export type ClaimOutcome = 'approved' | 'denied' | 'partial' | 'pending' | 'unknown';

export interface Claim {
  claim_id: string;
  incident_id: string;
  trip_id: string;
  account_id: string;
  claim_status: ClaimStatus;
  claim_type: string | null;
  policy_version_id: string | null;
  submitted_at: string | null;
  carrier_reference: string | null;
  itr_trace_id: string | null;
  sequence_position: number | null;
  routing_rec_id: string | null;
  primary_provider: string | null;
  estimated_amount: number | null;
  currency_code: string | null;
  packet_id: string | null;
  outcome: ClaimOutcome | null;
  outcome_amount: number | null;
  outcome_recorded_at: string | null;
  denial_reason_text: string | null;
  filing_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export type ConfidenceLabel =
  | 'HIGH_STRUCTURAL_ALIGNMENT'
  | 'CONDITIONAL_ALIGNMENT'
  | 'AMBIGUOUS'
  | 'DOCUMENTATION_INCOMPLETE'
  | 'CONFLICT_PRESENT'
  | 'INSUFFICIENT_DATA';

export interface Contact {
  contact_id: string;
  account_id: string;
  contact_type: 'emergency' | 'carrier' | 'medical' | 'airline' | 'hotel' | 'legal' | 'other';
  name: string | null;
  phone: string | null;
  email: string | null;
  organization: string | null;
  notes: string | null;
  created_at: string;
}

export interface JurisdictionReference {
  jurisdiction_id: string;
  iso_country_code: string;
  country_name: string;
  region_code: string | null;
  is_eu_eea: boolean;
  is_us_state: boolean;
  created_at: string;
}

export type PolicyDocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'partial'
  | 'complete'
  | 'failed'
  | 'superseded';

export interface PolicyDocument {
  document_id: string;
  policy_id: string;
  account_id: string;
  trip_id: string | null;
  document_status: PolicyDocumentStatus;
  source_type: 'pdf_upload' | 'email_forward' | 'manual_entry';
  raw_artifact_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  content_hash: string | null;
  malware_scan_status: string | null;
  malware_scanned_at: string | null;
  ocr_engine_version: string | null;
  extraction_started_at: string | null;
  extraction_completed_at: string | null;
  extraction_error_message: string | null;
  pipeline_version: string | null;
  model_version: string | null;
  created_at: string;
  updated_at: string;
}

export type ExtractionStatus = 'PENDING_REVIEW' | 'AUTO_ACCEPTED' | 'CORRECTED' | 'REJECTED';

export type ReviewAction = 'ACCEPTED' | 'CORRECTED' | 'REJECTED';

export interface PolicyClause {
  clause_id: string;
  policy_document_id: string;
  policy_version_id: string | null;
  clause_type: string;
  family_code: string | null;
  canonical_text: string;
  source_citation: string;
  page_number: number | null;
  section_path: string | null;
  confidence_label: string;
  extraction_status: ExtractionStatus;
  extracted_by_model: string | null;
  cross_references: string[];
  unresolved_references: Record<string, any> | null;
  reviewer_id: string | null;
  reviewer_action: ReviewAction | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanJob {
  scan_job_id: string;
  trip_id: string | null;
  account_id: string;
  scan_type: 'quick' | 'deep';
  scan_axis: string | null;
  job_status: 'queued' | 'running' | 'complete' | 'failed' | 'suppressed';
  confidence_label: string | null;
  result_json: Record<string, any> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ScanCreditLedger {
  ledger_id: string;
  account_id: string;
  scan_job_id: string | null;
  credit_type: string;
  credit_delta: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
}

export interface CoverageGraphSnapshot {
  snapshot_id: string;
  trip_id: string;
  snapshot_version: number;
  computation_timestamp: string;
  input_hash: string;
  graph_status: 'COMPUTING' | 'COMPLETE' | 'STALE' | 'FAILED';
  itr_trace_id: string | null;
  created_at: string;
}

export type Classification = 'Operational' | 'External' | 'Unknown';

export type ControlType = 'Internal' | 'External' | 'Mixed';

export type EvidenceType = 'file' | 'log' | 'screenshot' | 'network_capture' | 'memory_dump' | 'other';

export interface Evidence {
  id: string;
  incident_id: string;
  type: EvidenceType;
  name: string;
  description: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  hash_sha256: string | null;
  metadata: Record<string, any>;
  upload_session_id: string | null;
  upload_status: string;
  chunk_manifest_hash: string | null;
  source_type: string | null;
  causality_tag: string | null;
  confidentiality_flag: boolean;
  created_at: string;
  created_by: string | null;
}

export type CoverageNodeSourceType =
  | 'policy_clause'
  | 'cc_benefit'
  | 'statutory_right'
  | 'manual';

export interface CoverageNode {
  node_id: string;
  snapshot_id: string;
  node_type: string | null;
  policy_version_id: string | null;
  benefit_type: string | null;
  coverage_trigger_clause_id: string | null;
  exclusion_clause_ids: string[];
  primacy_rank: number | null;
  overlap_flags: Record<string, any> | null;
  confidence_label: string | null;
  source_type: CoverageNodeSourceType | null;
  created_at: string;
}

export interface ClauseFamilyTaxonomy {
  clause_type: string;
  family_code: string;
  family_name: string;
  description: string | null;
}

export interface TripDraftVersion {
  draft_version_id: string;
  trip_id: string;
  version_number: number;
  draft_state: string;
  itinerary_hash: string | null;
  narration_text: string | null;
  route_segment_ids: string[];
  activity_candidate_ids: string[];
  readiness_gate_passed: boolean;
  created_by: string | null;
  created_at: string;
}

export interface RouteSegment {
  segment_id: string;
  trip_id: string;
  draft_version_id: string | null;
  origin_code: string;
  destination_code: string;
  departure_at: string | null;
  arrival_at: string | null;
  carrier_code: string | null;
  flight_number: string | null;
  travel_mode: string;
  connection_buffer_minutes: number | null;
  feasibility_status: string | null;
  conflict_flags: string[];
  environmental_context: Record<string, any> | null;
  sequence_position: number;
  created_at: string;
}

export interface ActivityCandidate {
  candidate_id: string;
  trip_id: string;
  draft_version_id: string | null;
  destination_code: string;
  activity_name: string;
  activity_category: string | null;
  source: 'ai_suggested' | 'creator_sourced' | 'manual';
  rejection_signal: boolean;
  rejection_reason: string | null;
  personalization_weight: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface UnresolvedItem {
  item_id: string;
  trip_id: string;
  draft_version_id: string | null;
  item_type: string;
  description: string;
  source_segment_id: string | null;
  source_candidate_id: string | null;
  resolution_state: 'open' | 'resolved' | 'deferred' | 'dismissed';
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface DraftNarrationVersion {
  narration_version_id: string;
  trip_id: string;
  draft_version_id: string;
  narration_text: string;
  conflict_summary: string | null;
  unresolved_item_ids: string[];
  voice_input_transcript: string | null;
  model_version: string | null;
  created_by: string | null;
  created_at: string;
}
