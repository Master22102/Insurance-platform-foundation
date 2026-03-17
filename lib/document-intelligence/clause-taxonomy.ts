import { ClauseType } from './types';

export const CLAUSE_TAXONOMY: Record<ClauseType, { description: string; eligibleForPromotion: boolean }> = {
  trip_delay_threshold: {
    description: 'Minimum delay duration to trigger trip delay coverage',
    eligibleForPromotion: true,
  },
  trip_delay_limit: {
    description: 'Maximum reimbursement amount for trip delay expenses',
    eligibleForPromotion: true,
  },
  claim_deadline_days: {
    description: 'Number of days within which a claim must be filed',
    eligibleForPromotion: true,
  },
  requires_receipts: {
    description: 'Whether receipts are required for reimbursement',
    eligibleForPromotion: true,
  },
  requires_police_report: {
    description: 'Whether a police report is required for certain claims',
    eligibleForPromotion: true,
  },
  payment_method_requirement: {
    description: 'Required payment method for coverage eligibility',
    eligibleForPromotion: true,
  },
  baggage_liability_limit: {
    description: 'Maximum liability for lost or damaged baggage',
    eligibleForPromotion: true,
  },
  carrier_liability_cap: {
    description: 'Carrier liability cap under international convention',
    eligibleForPromotion: true,
  },
  hotel_cancellation_window: {
    description: 'Time window for hotel cancellation without penalty',
    eligibleForPromotion: true,
  },
  refund_eligibility_rule: {
    description: 'Conditions under which refunds are eligible',
    eligibleForPromotion: true,
  },
  requires_medical_certificate: {
    description: 'Whether a medical certificate is required for certain claims',
    eligibleForPromotion: true,
  },
  requires_carrier_delay_letter: {
    description: 'Whether a carrier delay confirmation letter is required',
    eligibleForPromotion: true,
  },
  requires_baggage_pir: {
    description: 'Whether a Property Irregularity Report (PIR) is required for baggage claims',
    eligibleForPromotion: true,
  },
  requires_itinerary: {
    description: 'Whether travel itinerary documentation is required',
    eligibleForPromotion: true,
  },
  requires_payment_proof: {
    description: 'Whether proof of payment is required for claims',
    eligibleForPromotion: true,
  },
  trip_cancellation_limit: {
    description: 'Maximum reimbursement for trip cancellation',
    eligibleForPromotion: true,
  },
  trip_interruption_limit: {
    description: 'Maximum reimbursement for trip interruption',
    eligibleForPromotion: true,
  },
  common_carrier_requirement: {
    description: 'Requirement that travel must be on a common carrier',
    eligibleForPromotion: true,
  },
  round_trip_requirement: {
    description: 'Requirement that travel must be round-trip',
    eligibleForPromotion: true,
  },
  medical_emergency_coverage_limit: {
    description: 'Maximum coverage for emergency medical expenses',
    eligibleForPromotion: true,
  },
  emergency_evacuation_limit: {
    description: 'Maximum coverage for emergency medical evacuation',
    eligibleForPromotion: true,
  },
  dental_emergency_limit: {
    description: 'Maximum coverage for emergency dental treatment',
    eligibleForPromotion: true,
  },
  rental_car_damage_limit: {
    description: 'Maximum coverage for rental car damage (CDW/LDW)',
    eligibleForPromotion: true,
  },
  personal_accident_coverage_limit: {
    description: 'Maximum coverage for accidental death or dismemberment',
    eligibleForPromotion: true,
  },
  personal_effects_coverage_limit: {
    description: 'Maximum coverage for stolen or lost personal belongings',
    eligibleForPromotion: true,
  },
  supplemental_liability_limit: {
    description: 'Maximum third-party liability coverage',
    eligibleForPromotion: true,
  },
  cruise_cancellation_window: {
    description: 'Time window for cruise cancellation without full penalty',
    eligibleForPromotion: true,
  },
  deposit_requirement: {
    description: 'Required deposit amount for booking',
    eligibleForPromotion: true,
  },
  final_payment_deadline: {
    description: 'Deadline for final payment before departure',
    eligibleForPromotion: true,
  },
  baggage_delay_threshold: {
    description: 'Minimum delay duration to trigger baggage delay coverage',
    eligibleForPromotion: true,
  },
  medical_evacuation_cost_estimate: {
    description: 'Estimated or maximum cost for medical evacuation',
    eligibleForPromotion: true,
  },
  repatriation_remains_limit: {
    description: 'Maximum coverage for repatriation of remains',
    eligibleForPromotion: true,
  },
  missed_connection_threshold: {
    description: 'Minimum delay to trigger missed connection coverage',
    eligibleForPromotion: true,
  },
  check_in_deadline: {
    description: 'Required check-in time before departure',
    eligibleForPromotion: true,
  },
  eu_delay_compensation_threshold: {
    description: 'EU261 compensation threshold based on delay duration and distance',
    eligibleForPromotion: true,
  },
  eu_denied_boarding_compensation: {
    description: 'EU261 compensation for involuntary denied boarding',
    eligibleForPromotion: true,
  },
  eu_care_obligation: {
    description: 'EU261 airline duty of care (meals, hotel, transport)',
    eligibleForPromotion: true,
  },
  eu_rerouting_obligation: {
    description: 'EU261 right to rerouting or alternative transport',
    eligibleForPromotion: true,
  },
  eu_refund_deadline: {
    description: 'EU261 deadline for ticket reimbursement (7 days)',
    eligibleForPromotion: true,
  },
  eu_cancellation_compensation: {
    description: 'EU261 compensation for flight cancellation',
    eligibleForPromotion: true,
  },
};

export function isEligibleForPromotion(clauseType: ClauseType): boolean {
  return CLAUSE_TAXONOMY[clauseType]?.eligibleForPromotion ?? false;
}
