import { ClauseType } from './types';

export interface PhraseCluster {
  clauseType: ClauseType;
  primaryPhrases: string[];
  secondaryPhrases: string[];
  contextPhrases: string[];
  negationPhrases: string[];
}

export const PHRASE_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'trip_delay_threshold',
    primaryPhrases: [
      'delay of',
      'delayed for',
      'delay exceeds',
      'delay of at least',
      'delay greater than',
      'delay in excess of',
      'minimum delay',
    ],
    secondaryPhrases: ['hour', 'hours', 'consecutive hours', 'more than'],
    contextPhrases: ['trip', 'flight', 'departure', 'arrival', 'schedule', 'common carrier'],
    negationPhrases: ['does not cover', 'excludes', 'not covered'],
  },
  {
    clauseType: 'trip_delay_limit',
    primaryPhrases: [
      'maximum reimbursement',
      'up to',
      'limit of',
      'not to exceed',
      'maximum of',
      'shall not exceed',
    ],
    secondaryPhrases: ['per day', 'per trip', 'total', 'aggregate'],
    contextPhrases: ['trip delay', 'delay expenses', 'reasonable expenses'],
    negationPhrases: [],
  },
  {
    clauseType: 'claim_deadline_days',
    primaryPhrases: [
      'must file within',
      'submit within',
      'file a claim within',
      'claim must be made within',
      'within',
      'no later than',
      'deadline',
    ],
    secondaryPhrases: ['days', 'day', 'calendar days', 'business days', 'working days'],
    contextPhrases: ['claim', 'notice', 'written notice', 'notification', 'report'],
    negationPhrases: [],
  },
  {
    clauseType: 'requires_receipts',
    primaryPhrases: [
      'receipt required',
      'must provide receipts',
      'receipts must be submitted',
      'proof of purchase',
      'original receipts',
      'documentation required',
    ],
    secondaryPhrases: ['itemized', 'original', 'copy', 'documentation'],
    contextPhrases: ['expense', 'reimbursement', 'claim', 'payment'],
    negationPhrases: ['no receipt required', 'without receipt'],
  },
  {
    clauseType: 'requires_police_report',
    primaryPhrases: [
      'police report required',
      'must file a police report',
      'report to authorities',
      'report to police',
      'law enforcement report',
    ],
    secondaryPhrases: ['theft', 'stolen', 'loss', 'missing', 'criminal'],
    contextPhrases: ['baggage', 'property', 'belongings', 'theft', 'criminal act'],
    negationPhrases: [],
  },
  {
    clauseType: 'payment_method_requirement',
    primaryPhrases: [
      'must pay with',
      'payment must be made',
      'charged to',
      'paid with',
      'purchased with',
    ],
    secondaryPhrases: ['credit card', 'debit card', 'card', 'eligible card'],
    contextPhrases: ['coverage', 'eligible', 'qualify', 'benefit'],
    negationPhrases: ['cash', 'check', 'gift card', 'points only'],
  },
  {
    clauseType: 'baggage_liability_limit',
    primaryPhrases: [
      'liability limited to',
      'maximum liability',
      'shall not exceed',
      'limit of liability',
      'not liable for more than',
      'limited liability',
      'liability is limited',
      'maximum compensation',
      'maximum amount',
      'liable up to',
    ],
    secondaryPhrases: ['per bag', 'per passenger', 'per item', 'aggregate', 'per piece', 'each bag', 'each item'],
    contextPhrases: ['baggage', 'luggage', 'checked bag', 'carry-on', 'personal effects', 'checked baggage', 'unchecked baggage', 'lost', 'damaged', 'destroyed'],
    negationPhrases: [],
  },
  {
    clauseType: 'carrier_liability_cap',
    primaryPhrases: [
      'Montreal Convention',
      'Warsaw Convention',
      'SDR',
      'Special Drawing Rights',
      'international convention',
      'liability cap',
    ],
    secondaryPhrases: ['1,131', '1131', '1,288', '1288', '4,694', '4694'],
    contextPhrases: ['carrier liability', 'international carriage', 'per passenger'],
    negationPhrases: [],
  },
  {
    clauseType: 'hotel_cancellation_window',
    primaryPhrases: [
      'cancel by',
      'cancellation deadline',
      'cancel at least',
      'free cancellation',
      'cancellation policy',
      'cancel without penalty',
      'cancellation fee',
      'cancel up to',
      'cancellation terms',
    ],
    secondaryPhrases: ['hours before', 'days before', 'prior to', 'in advance', 'before arrival', 'before check-in'],
    contextPhrases: ['hotel', 'accommodation', 'reservation', 'booking', 'check-in', 'room', 'stay'],
    negationPhrases: ['non-refundable', 'no cancellation', 'cannot be cancelled'],
  },
  {
    clauseType: 'refund_eligibility_rule',
    primaryPhrases: [
      'eligible for refund',
      'refundable',
      'refund available',
      'may request a refund',
      'entitled to refund',
      'refund will be provided',
      'refund issued',
      'refund granted',
      'refund policy',
      'refundable ticket',
    ],
    secondaryPhrases: ['full refund', 'partial refund', 'pro-rated', 'prorated', 'less fees', 'minus fees'],
    contextPhrases: ['ticket', 'fare', 'cancellation', 'unused', 'portion', 'voluntary', 'involuntary', 'denied boarding', 'flight cancelled'],
    negationPhrases: ['non-refundable', 'no refund', 'not eligible', 'not refundable'],
  },
  {
    clauseType: 'payment_method_requirement',
    primaryPhrases: [
      'documentation must be provided',
      'must submit',
      'required documentation',
      'proof required',
      'must provide proof',
      'evidence of',
    ],
    secondaryPhrases: ['passport', 'visa', 'ID', 'identification', 'travel documents'],
    contextPhrases: ['boarding', 'check-in', 'entry', 'travel', 'international'],
    negationPhrases: [],
  },
  // Medical Insurance Clusters
  {
    clauseType: 'medical_emergency_coverage_limit',
    primaryPhrases: ['medical coverage', 'medical expense', 'emergency medical', 'medical treatment', 'maximum medical benefit'],
    secondaryPhrases: ['up to', 'maximum', 'limit', 'per person', 'per trip'],
    contextPhrases: ['emergency', 'hospital', 'physician', 'treatment', 'surgery', 'intensive care'],
    negationPhrases: ['does not cover', 'excludes'],
  },
  {
    clauseType: 'emergency_evacuation_limit',
    primaryPhrases: ['emergency evacuation', 'medical evacuation', 'air ambulance', 'evacuation coverage'],
    secondaryPhrases: ['maximum', 'up to', 'limit', 'coverage'],
    contextPhrases: ['nearest adequate facility', 'medical facility', 'hospital', 'emergency'],
    negationPhrases: [],
  },
  {
    clauseType: 'dental_emergency_limit',
    primaryPhrases: ['dental emergency', 'emergency dental', 'dental treatment', 'dental coverage'],
    secondaryPhrases: ['maximum', 'up to', 'limit'],
    contextPhrases: ['pain relief', 'emergency only', 'acute pain', 'extraction'],
    negationPhrases: ['routine dental', 'cosmetic'],
  },
  {
    clauseType: 'repatriation_remains_limit',
    primaryPhrases: ['repatriation of remains', 'return of remains', 'remains transportation'],
    secondaryPhrases: ['maximum', 'up to', 'coverage'],
    contextPhrases: ['death', 'deceased', 'burial', 'cremation'],
    negationPhrases: [],
  },
  // Rental Car Insurance Clusters
  {
    clauseType: 'rental_car_damage_limit',
    primaryPhrases: ['rental car damage', 'loss damage waiver', 'ldw', 'cdw', 'collision damage', 'vehicle damage'],
    secondaryPhrases: ['maximum', 'up to', 'coverage', 'limit', 'full value'],
    contextPhrases: ['collision', 'theft', 'vandalism', 'rental agreement', 'deductible'],
    negationPhrases: [],
  },
  {
    clauseType: 'personal_accident_coverage_limit',
    primaryPhrases: ['personal accident', 'accidental death', 'pai', 'death benefit', 'dismemberment'],
    secondaryPhrases: ['maximum', 'benefit', 'coverage'],
    contextPhrases: ['renter', 'passenger', 'accidental', 'bodily injury'],
    negationPhrases: [],
  },
  {
    clauseType: 'personal_effects_coverage_limit',
    primaryPhrases: ['personal effects', 'pec', 'personal belongings', 'personal property', 'theft coverage'],
    secondaryPhrases: ['maximum', 'per rental', 'per item', 'limit'],
    contextPhrases: ['theft', 'stolen', 'locked vehicle', 'belongings'],
    negationPhrases: [],
  },
  {
    clauseType: 'supplemental_liability_limit',
    primaryPhrases: ['supplemental liability', 'sli', 'liability coverage', 'third party liability'],
    secondaryPhrases: ['up to', 'maximum', 'coverage'],
    contextPhrases: ['bodily injury', 'property damage', 'third party'],
    negationPhrases: [],
  },
  // Cruise and Travel Booking Clusters
  {
    clauseType: 'cruise_cancellation_window',
    primaryPhrases: ['cancellation', 'cancel', 'cancellation penalty', 'days before'],
    secondaryPhrases: ['days', 'before departure', 'prior to', 'sailing'],
    contextPhrases: ['cruise', 'sailing', 'voyage', 'refund', 'penalty', 'forfeit'],
    negationPhrases: ['no refund', 'non-refundable'],
  },
  {
    clauseType: 'deposit_requirement',
    primaryPhrases: ['deposit', 'deposit required', 'deposit due', 'initial payment', 'booking deposit'],
    secondaryPhrases: ['per person', 'per cabin', 'at booking', 'required'],
    contextPhrases: ['booking', 'reservation', 'cruise', 'suite', 'cabin'],
    negationPhrases: [],
  },
  {
    clauseType: 'final_payment_deadline',
    primaryPhrases: ['final payment', 'payment due', 'full payment', 'balance due', 'payment deadline'],
    secondaryPhrases: ['days before', 'prior to', 'before departure'],
    contextPhrases: ['departure', 'sailing', 'cruise', 'booking'],
    negationPhrases: [],
  },
  {
    clauseType: 'check_in_deadline',
    primaryPhrases: ['check in', 'check-in', 'arrival time', 'port arrival', 'boarding time'],
    secondaryPhrases: ['minutes before', 'hours before', 'at least', 'no later than'],
    contextPhrases: ['departure', 'sailing', 'scheduled', 'boarding'],
    negationPhrases: [],
  },
  // Additional Travel Insurance Clusters
  {
    clauseType: 'baggage_delay_threshold',
    primaryPhrases: ['baggage delayed', 'baggage delay', 'luggage delayed', 'delayed baggage'],
    secondaryPhrases: ['hours', 'after arrival', 'from arrival', 'more than'],
    contextPhrases: ['baggage', 'luggage', 'essential items', 'clothing'],
    negationPhrases: [],
  },
  {
    clauseType: 'medical_evacuation_cost_estimate',
    primaryPhrases: ['evacuation cost', 'helicopter evacuation', 'air ambulance cost', 'medical evacuation'],
    secondaryPhrases: ['up to', 'can cost', 'may cost', 'range'],
    contextPhrases: ['expensive', 'thousands', 'emergency'],
    negationPhrases: [],
  },
  {
    clauseType: 'missed_connection_threshold',
    primaryPhrases: ['missed connection', 'connection missed', 'miss your connection', 'connection delay'],
    secondaryPhrases: ['hours', 'minimum', 'at least', 'delay of'],
    contextPhrases: ['connection', 'connecting flight', 'transfer', 'layover'],
    negationPhrases: [],
  },
];

export function getPhraseClustersForType(clauseType: ClauseType): PhraseCluster | undefined {
  return PHRASE_CLUSTERS.find((cluster) => cluster.clauseType === clauseType);
}

export function getAllPhraseClusters(): PhraseCluster[] {
  return PHRASE_CLUSTERS;
}
