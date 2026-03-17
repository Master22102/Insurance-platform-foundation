export type ClauseType =
  | 'trip_delay_threshold'
  | 'trip_delay_limit'
  | 'claim_deadline_days'
  | 'requires_receipts'
  | 'requires_police_report'
  | 'requires_medical_certificate'
  | 'requires_carrier_delay_letter'
  | 'requires_baggage_pir'
  | 'requires_itinerary'
  | 'requires_payment_proof'
  | 'payment_method_requirement'
  | 'baggage_liability_limit'
  | 'carrier_liability_cap'
  | 'hotel_cancellation_window'
  | 'refund_eligibility_rule'
  | 'trip_cancellation_limit'
  | 'trip_interruption_limit'
  | 'common_carrier_requirement'
  | 'round_trip_requirement'
  | 'medical_emergency_coverage_limit'
  | 'emergency_evacuation_limit'
  | 'dental_emergency_limit'
  | 'rental_car_damage_limit'
  | 'personal_accident_coverage_limit'
  | 'personal_effects_coverage_limit'
  | 'supplemental_liability_limit'
  | 'cruise_cancellation_window'
  | 'deposit_requirement'
  | 'final_payment_deadline'
  | 'baggage_delay_threshold'
  | 'medical_evacuation_cost_estimate'
  | 'repatriation_remains_limit'
  | 'missed_connection_threshold'
  | 'check_in_deadline'
  | 'eu_delay_compensation_threshold'
  | 'eu_denied_boarding_compensation'
  | 'eu_care_obligation'
  | 'eu_rerouting_obligation'
  | 'eu_refund_deadline'
  | 'eu_cancellation_compensation';

export type ConfidenceTier =
  | 'HIGH'
  | 'CONDITIONAL'
  | 'AMBIGUOUS'
  | 'DOCUMENTATION_INCOMPLETE'
  | 'CONFLICT_PRESENT'
  | 'INSUFFICIENT_DATA';

export type ValueType = 'currency' | 'sdr' | 'duration' | 'days' | 'boolean' | 'text' | 'text_rule';

export interface ExtractedValue {
  type: ValueType;
  value: string | number | boolean;
  raw: string;
  unit?: string;
  scope?: string; // e.g., "per_person", "per_family", "per_trip"
}

export interface TextSection {
  heading: string | null;
  content: string;
  startIndex: number;
  endIndex: number;
  level: number;
}

export interface ClauseCandidate {
  clauseType: ClauseType;
  value: ExtractedValue;
  confidence: ConfidenceTier;
  sourceSnippet: string;
  sourceSection: string | null;
  matchedPhrases: string[];
  ambiguityFlags: string[];
  conflictFlags: string[];
  detectedByPass?: string;
}

export interface PromotedRule {
  clauseType: ClauseType;
  value: ExtractedValue;
  sourceSnippet: string;
  sourceSection: string | null;
  confidence: ConfidenceTier;
  promotedAt: string;
}

export interface DocumentRuleRow {
  ruleId: string;
  clauseType: ClauseType;
  value: ExtractedValue;
  sourceSnippet: string;
  confidence: ConfidenceTier;
  metadata: Record<string, any>;
}

export interface RawExtraction {
  success: boolean;
  method: string;
  text: string;
  error?: string;
  metadata: {
    fileSize: number;
    extractedLength: number;
    encoding?: string;
    cleaningMetadata?: {
      removedElements: string[];
      chromeRemoved: boolean;
      mainContentFound: boolean;
    };
  };
}

export interface ProcessingResult {
  fileName: string;
  fileType: string;
  extraction: RawExtraction;
  sections: TextSection[];
  candidates: ClauseCandidate[];
  promotedRules: PromotedRule[];
  warnings: string[];
  errors: string[];
  consolidationMetrics?: {
    beforeCount: number;
    afterCount: number;
    reductionCount: number;
    reductionPercent: number;
    conflictsDetected: number;
  };
  normalizationMetrics?: {
    beforeCount: number;
    afterCount: number;
    normalizedCount: number;
    normalizationRate: number;
  };
  conflictResolutionMetrics?: {
    totalPairs: number;
    duplicateEquivalent: number;
    compatibleRefinement: number;
    scopeDifference: number;
    exceptionClause: number;
    trueConflict: number;
    noConflict: number;
    blockingConflictsBefore: number;
    blockingConflictsAfter: number;
  };
}

export interface ExpectedClauses {
  required_clause_types?: ClauseType[];
  optional_clause_types?: ClauseType[];
  expected_values?: Record<string, any>;
}
