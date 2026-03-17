import { PhraseCluster } from './phrase-clusters';

export const DELAY_THRESHOLD_CLUSTERS: PhraseCluster[] = [
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
      'delayed by more than',
      'delay equal to or exceeding',
      'after',
      'following a delay of',
      'if delayed',
      'when delayed',
      'delay for more than',
      'delay longer than',
      'delayed more than',
    ],
    secondaryPhrases: ['hour', 'hours', 'consecutive hours', 'more than', 'at least', '3 hours', '4 hours', '5 hours', '6 hours', '8 hours', '12 hours', '24 hours'],
    contextPhrases: ['trip', 'flight', 'departure', 'arrival', 'schedule', 'common carrier', 'delay coverage', 'covered delay', 'departure delay', 'arrival delay', 'scheduled departure'],
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
      'reimbursement limit',
      'covered up to',
      'reimburse up to',
      'pay up to',
      'maximum benefit',
      'benefit limit',
      'coverage limit',
      'maximum coverage',
      'limited to',
    ],
    secondaryPhrases: ['per day', 'per trip', 'total', 'aggregate', 'maximum', 'per person', 'per passenger', 'per occurrence', 'each day', 'daily maximum'],
    contextPhrases: ['trip delay', 'delay expenses', 'reasonable expenses', 'meals', 'lodging', 'accommodation', 'hotel', 'food', 'transportation', 'incidental expenses'],
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
      'file your claim',
      'submit your claim',
      'notify within',
      'written notice within',
      'must be filed within',
      'must be submitted within',
      'report within',
      'file no later than',
      'submit no later than',
      'notify no later than',
      'time limit',
      'filing deadline',
      'submission deadline',
    ],
    secondaryPhrases: ['days', 'day', 'calendar days', 'business days', 'working days', 'from date', 'of loss', 'of incident', '7 days', '14 days', '21 days', '30 days', '45 days', '60 days', '90 days', '180 days'],
    contextPhrases: ['claim', 'notice', 'written notice', 'notification', 'report', 'submit', 'file', 'proof of loss', 'claim form', 'documentation'],
    negationPhrases: [],
  },
];

export const LIABILITY_CLUSTERS: PhraseCluster[] = [
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
      'carrier liability',
      'liable for loss',
      'liable for damage',
      'compensation for baggage',
      'liability per bag',
      'liability per passenger',
      'maximum per bag',
      'maximum per passenger',
      'limit per bag',
      'limit per passenger',
      'not to exceed',
      'capped at',
      'limited to',
    ],
    secondaryPhrases: ['per bag', 'per passenger', 'per item', 'aggregate', 'per piece', 'each bag', 'each item', 'checked baggage', 'unchecked', 'per person', 'each passenger', 'for each', 'per checked bag'],
    contextPhrases: ['baggage', 'luggage', 'checked bag', 'carry-on', 'personal effects', 'checked baggage', 'unchecked baggage', 'lost', 'damaged', 'destroyed', 'delayed baggage', 'lost luggage', 'baggage claim', 'baggage compensation'],
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
      'convention liability',
      'international liability',
      'treaty limits',
      'liability limit',
      'limited by treaty',
      'limited by convention',
      'maximum liability',
      'liability shall not exceed',
    ],
    secondaryPhrases: ['1,131', '1131', '1,288', '1288', '4,694', '4694', '1,000', '1000', 'SDR', 'per passenger', 'per person'],
    contextPhrases: ['carrier liability', 'international carriage', 'per passenger', 'death', 'injury', 'bodily injury', 'delay', 'international flight', 'international travel', 'carrier', 'airline'],
    negationPhrases: [],
  },
];

export const REFUND_CANCELLATION_CLUSTERS: PhraseCluster[] = [
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
      'entitled to a refund',
      'right to a refund',
      'refund of',
      'refund for',
      'refunded',
      'reimbursement',
    ],
    secondaryPhrases: ['full refund', 'partial refund', 'pro-rated', 'prorated', 'less fees', 'minus fees', 'refund amount', 'refund the', 'refund your', 'return of'],
    contextPhrases: ['ticket', 'fare', 'cancellation', 'unused', 'portion', 'voluntary', 'involuntary', 'denied boarding', 'flight cancelled', 'non-refundable', 'cancel', 'rental', 'booking', 'reservation'],
    negationPhrases: ['non-refundable', 'no refund', 'not eligible', 'not refundable', 'not entitled'],
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
      'cancel your booking',
      'cancellation notice',
      'cancellation charge',
      'no show',
      'no-show',
      'must cancel',
      'cancellation must be made',
      'cancel before',
      'cancellation prior to',
      'cancel within',
      'cancellation window',
      'penalty-free cancellation',
      'cancellation cutoff',
    ],
    secondaryPhrases: ['hours before', 'days before', 'prior to', 'in advance', 'before arrival', 'before check-in', 'before departure', 'before pick-up', 'before rental', 'notice period', '24 hours', '48 hours', '72 hours', '7 days', '14 days', 'before scheduled'],
    contextPhrases: ['hotel', 'accommodation', 'reservation', 'booking', 'check-in', 'room', 'stay', 'cruise', 'cabin', 'stateroom', 'rental', 'vehicle', 'car rental', 'property', 'lodging', 'pick-up time', 'arrival date'],
    negationPhrases: ['non-refundable', 'no cancellation', 'cannot be cancelled', 'non-cancellable'],
  },
  {
    clauseType: 'trip_cancellation_limit',
    primaryPhrases: [
      'trip cancellation',
      'cancellation coverage',
      'cancel your trip',
      'trip cancelled',
      'cancellation benefit',
      'covered cancellation',
    ],
    secondaryPhrases: ['up to', 'maximum', 'limit', 'reimbursement'],
    contextPhrases: ['trip', 'travel', 'vacation', 'booking', 'prepaid', 'non-refundable'],
    negationPhrases: [],
  },
  {
    clauseType: 'trip_interruption_limit',
    primaryPhrases: [
      'trip interruption', 'interruption coverage', 'trip is interrupted',
      'interrupted trip', 'interruption benefit', 'trip interruption coverage up to',
      'trip interruption benefit limit', 'coverage if trip is interrupted',
      'benefit payable for interrupted trip', 'reimbursement for trip interruption',
      'trip interruption protection', 'maximum trip interruption benefit',
      'interruption of trip', 'interrupted your trip', 'trip cut short',
    ],
    secondaryPhrases: ['up to', 'maximum', 'limit', 'reimbursement', 'per person', 'per trip', 'benefit', 'coverage', 'not to exceed'],
    contextPhrases: ['trip', 'travel', 'vacation', 'return home', 'illness', 'injury', 'emergency', 'unused portion', 'prepaid', 'non-refundable', 'return transportation'],
    negationPhrases: [],
  },
];

export const DOCUMENTATION_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'requires_receipts',
    primaryPhrases: [
      'receipt required',
      'must provide receipts',
      'receipts must be submitted',
      'proof of purchase',
      'original receipts',
      'documentation required',
      'submit receipts',
      'provide receipts',
      'receipts for',
    ],
    secondaryPhrases: ['itemized', 'original', 'copy', 'documentation', 'proof'],
    contextPhrases: ['expense', 'reimbursement', 'claim', 'payment', 'purchase', 'paid'],
    negationPhrases: ['no receipt required', 'without receipt', 'receipts not required'],
  },
  {
    clauseType: 'requires_police_report',
    primaryPhrases: [
      'police report required',
      'must file a police report',
      'report to authorities',
      'report to police',
      'law enforcement report',
      'police report must be filed',
      'file a police report',
      'obtain a police report',
    ],
    secondaryPhrases: ['theft', 'stolen', 'loss', 'missing', 'criminal', 'report number'],
    contextPhrases: ['baggage', 'property', 'belongings', 'theft', 'criminal act', 'stolen items'],
    negationPhrases: [],
  },
  {
    clauseType: 'requires_medical_certificate',
    primaryPhrases: [
      'medical certificate',
      'doctor\'s note',
      'physician\'s statement',
      'medical documentation',
      'medical report',
      'medical proof',
    ],
    secondaryPhrases: ['required', 'must provide', 'necessary', 'submit'],
    contextPhrases: ['illness', 'injury', 'medical', 'health', 'doctor', 'physician'],
    negationPhrases: [],
  },
  {
    clauseType: 'requires_carrier_delay_letter',
    primaryPhrases: [
      'carrier delay letter',
      'airline delay confirmation',
      'delay certificate',
      'carrier confirmation',
      'delay documentation',
      'written confirmation of delay',
    ],
    secondaryPhrases: ['from carrier', 'from airline', 'delay reason'],
    contextPhrases: ['delay', 'flight', 'carrier', 'airline', 'confirmation'],
    negationPhrases: [],
  },
  {
    clauseType: 'requires_baggage_pir',
    primaryPhrases: [
      'PIR',
      'Property Irregularity Report',
      'baggage claim form',
      'baggage report',
      'baggage claim report',
      'file a baggage claim',
    ],
    secondaryPhrases: ['report number', 'claim number', 'reference number'],
    contextPhrases: ['baggage', 'luggage', 'lost', 'damaged', 'delayed', 'missing'],
    negationPhrases: [],
  },
];

export const PAYMENT_ELIGIBILITY_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'payment_method_requirement',
    primaryPhrases: [
      'must pay with',
      'payment must be made',
      'charged to',
      'paid with',
      'purchased with',
      'paid for with',
      'payment by',
      'using your card',
      'card used for payment',
      'credit card',
      'debit card',
      'accepted payment',
      'payment accepted',
      'payment methods',
      'deposit',
      'security deposit',
      'rental deposit',
    ],
    secondaryPhrases: ['credit card', 'debit card', 'card', 'eligible card', 'covered card', 'prepaid', 'cash deposit'],
    contextPhrases: ['coverage', 'eligible', 'qualify', 'benefit', 'protection', 'covered', 'rental', 'reservation', 'booking'],
    negationPhrases: ['cash only', 'check', 'gift card', 'points only'],
  },
  {
    clauseType: 'common_carrier_requirement',
    primaryPhrases: [
      'common carrier',
      'licensed carrier',
      'scheduled airline',
      'public transportation',
      'commercial carrier',
    ],
    secondaryPhrases: ['airline', 'bus', 'train', 'cruise', 'ferry'],
    contextPhrases: ['trip', 'travel', 'transportation', 'ticket'],
    negationPhrases: ['private', 'charter', 'rental car'],
  },
  {
    clauseType: 'round_trip_requirement',
    primaryPhrases: [
      'round trip',
      'return trip',
      'roundtrip',
      'round-trip',
    ],
    secondaryPhrases: ['required', 'must be', 'only'],
    contextPhrases: ['ticket', 'fare', 'booking', 'travel'],
    negationPhrases: ['one-way', 'one way'],
  },
];

// New Medical and Insurance Coverage Clusters
const MEDICAL_INSURANCE_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'medical_emergency_coverage_limit',
    primaryPhrases: [
      'medical coverage',
      'medical expense',
      'emergency medical',
      'medical treatment',
      'maximum medical benefit',
      'medical reimbursement',
      'coverage for medical',
    ],
    secondaryPhrases: ['up to', 'maximum', 'limit', 'not to exceed', 'per person', 'per trip', 'per incident'],
    contextPhrases: ['emergency', 'hospital', 'physician', 'treatment', 'surgery', 'intensive care', 'medical bills'],
    negationPhrases: ['does not cover', 'excludes', 'not covered'],
  },
  {
    clauseType: 'emergency_evacuation_limit',
    primaryPhrases: [
      'emergency evacuation',
      'medical evacuation',
      'air ambulance',
      'evacuation coverage',
      'transportation to',
      'emergency transportation',
      'medical repatriation',
    ],
    secondaryPhrases: ['maximum', 'up to', 'limit', 'coverage', 'benefit'],
    contextPhrases: ['nearest adequate facility', 'medical facility', 'hospital', 'air ambulance', 'emergency', 'life-threatening'],
    negationPhrases: [],
  },
  {
    clauseType: 'dental_emergency_limit',
    primaryPhrases: [
      'dental emergency',
      'emergency dental',
      'dental treatment',
      'dental coverage',
      'acute dental',
      'emergency tooth',
    ],
    secondaryPhrases: ['maximum', 'up to', 'limit', 'per trip', 'per person'],
    contextPhrases: ['pain relief', 'emergency only', 'acute pain', 'extraction', 'temporary filling'],
    negationPhrases: ['routine dental', 'cosmetic', 'preventive'],
  },
  {
    clauseType: 'repatriation_remains_limit',
    primaryPhrases: [
      'repatriation of remains',
      'return of remains',
      'body repatriation',
      'remains transportation',
      'repatriation coverage',
    ],
    secondaryPhrases: ['maximum', 'up to', 'coverage', 'benefit'],
    contextPhrases: ['death', 'deceased', 'burial', 'cremation', 'preparation'],
    negationPhrases: [],
  },
];

// Rental Car Insurance Clusters
const RENTAL_CAR_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'rental_car_damage_limit',
    primaryPhrases: [
      'rental car damage',
      'loss damage waiver',
      'ldw',
      'cdw',
      'collision damage',
      'damage coverage',
      'vehicle damage',
      'rental vehicle protection',
    ],
    secondaryPhrases: ['maximum', 'up to', 'coverage', 'limit', 'per rental', 'full value'],
    contextPhrases: ['collision', 'theft', 'vandalism', 'rental agreement', 'deductible', 'loss of use'],
    negationPhrases: [],
  },
  {
    clauseType: 'personal_accident_coverage_limit',
    primaryPhrases: [
      'personal accident',
      'accidental death',
      'pai',
      'death benefit',
      'dismemberment',
      'accident insurance',
    ],
    secondaryPhrases: ['maximum', 'benefit', 'coverage'],
    contextPhrases: ['renter', 'passenger', 'accidental', 'bodily injury'],
    negationPhrases: [],
  },
  {
    clauseType: 'personal_effects_coverage_limit',
    primaryPhrases: [
      'personal effects',
      'pec',
      'personal belongings',
      'personal property',
      'theft coverage',
    ],
    secondaryPhrases: ['maximum', 'per rental', 'per item', 'limit'],
    contextPhrases: ['theft', 'stolen', 'locked vehicle', 'belongings'],
    negationPhrases: [],
  },
  {
    clauseType: 'supplemental_liability_limit',
    primaryPhrases: [
      'supplemental liability',
      'sli',
      'liability coverage',
      'third party liability',
      'additional liability',
      'liability protection',
    ],
    secondaryPhrases: ['up to', 'maximum', 'coverage'],
    contextPhrases: ['bodily injury', 'property damage', 'third party', 'others'],
    negationPhrases: [],
  },
];

// Cruise and Travel Booking Clusters
const CRUISE_BOOKING_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'cruise_cancellation_window',
    primaryPhrases: [
      'cancellation',
      'cancel',
      'cancelled',
      'cancellation penalty',
      'cancellation fee',
      'full refund',
      'days before',
    ],
    secondaryPhrases: ['days', 'before departure', 'prior to', 'sailing', 'embarkation'],
    contextPhrases: ['cruise', 'sailing', 'voyage', 'departure date', 'refund', 'penalty', 'forfeit'],
    negationPhrases: ['no refund', 'non-refundable'],
  },
  {
    clauseType: 'deposit_requirement',
    primaryPhrases: [
      'deposit',
      'deposit required',
      'deposit due',
      'initial payment',
      'booking deposit',
      'reservation deposit',
    ],
    secondaryPhrases: ['per person', 'per cabin', 'at booking', 'required'],
    contextPhrases: ['booking', 'reservation', 'cruise', 'suite', 'cabin'],
    negationPhrases: [],
  },
  {
    clauseType: 'final_payment_deadline',
    primaryPhrases: [
      'final payment',
      'payment due',
      'full payment',
      'balance due',
      'payment deadline',
      'pay in full',
    ],
    secondaryPhrases: ['days before', 'prior to', 'before departure', 'before sailing'],
    contextPhrases: ['departure', 'sailing', 'cruise', 'booking'],
    negationPhrases: [],
  },
  {
    clauseType: 'check_in_deadline',
    primaryPhrases: [
      'check in',
      'check-in',
      'arrival time',
      'port arrival',
      'boarding time',
      'embarkation time',
    ],
    secondaryPhrases: ['minutes before', 'hours before', 'at least', 'no later than'],
    contextPhrases: ['departure', 'sailing', 'scheduled', 'boarding', 'embarkation'],
    negationPhrases: [],
  },
];

// Additional Travel Insurance Clusters
const ADDITIONAL_INSURANCE_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'baggage_delay_threshold',
    primaryPhrases: [
      'baggage delayed',
      'baggage delay',
      'luggage delayed',
      'delayed baggage',
      'baggage arrives',
    ],
    secondaryPhrases: ['hours', 'after arrival', 'from arrival', 'more than'],
    contextPhrases: ['baggage', 'luggage', 'essent ial items', 'clothing', 'toiletries'],
    negationPhrases: [],
  },
  {
    clauseType: 'medical_evacuation_cost_estimate',
    primaryPhrases: [
      'evacuation cost',
      'helicopter evacuation',
      'air ambulance cost',
      'medical evacuation',
      'evacuation expense',
    ],
    secondaryPhrases: ['up to', 'can cost', 'may cost', 'range'],
    contextPhrases: ['expensive', 'thousands', 'expensive procedure', 'emergency'],
    negationPhrases: [],
  },
  {
    clauseType: 'missed_connection_threshold',
    primaryPhrases: [
      'missed connection',
      'connection missed',
      'miss your connection',
      'connection delay',
    ],
    secondaryPhrases: ['hours', 'minimum', 'at least', 'delay of'],
    contextPhrases: ['connection', 'connecting flight', 'transfer', 'layover'],
    negationPhrases: [],
  },
];

export function getAllDelayThresholdClusters(): PhraseCluster[] {
  return DELAY_THRESHOLD_CLUSTERS;
}

export function getAllMedicalInsuranceClusters(): PhraseCluster[] {
  return MEDICAL_INSURANCE_CLUSTERS;
}

export function getAllRentalCarClusters(): PhraseCluster[] {
  return RENTAL_CAR_CLUSTERS;
}

export function getAllCruiseBookingClusters(): PhraseCluster[] {
  return CRUISE_BOOKING_CLUSTERS;
}

export function getAllAdditionalInsuranceClusters(): PhraseCluster[] {
  return ADDITIONAL_INSURANCE_CLUSTERS;
}

export function getAllLiabilityClusters(): PhraseCluster[] {
  return LIABILITY_CLUSTERS;
}

export function getAllRefundCancellationClusters(): PhraseCluster[] {
  return REFUND_CANCELLATION_CLUSTERS;
}

export function getAllDocumentationClusters(): PhraseCluster[] {
  return DOCUMENTATION_CLUSTERS;
}

export function getAllPaymentEligibilityClusters(): PhraseCluster[] {
  return PAYMENT_ELIGIBILITY_CLUSTERS;
}

// EU Passenger Rights Clusters
const EU_PASSENGER_RIGHTS_CLUSTERS: PhraseCluster[] = [
  {
    clauseType: 'eu_delay_compensation_threshold' as any,
    primaryPhrases: [
      'compensation of', 'entitled to compensation', 'delay exceeds',
      'right to compensation', 'compensation shall be', 'fixed compensation',
      'lump sum compensation', 'passengers shall receive', 'amount of compensation',
      'compensation payable', 'shall be compensated',
    ],
    secondaryPhrases: ['€250', '€400', '€600', '250', '400', '600', 'EUR', '3 hours', '4 hours', '2 hours', 'per passenger'],
    contextPhrases: ['delay', 'flight', 'arrival', 'departure', 'distance', 'kilometres', 'passenger rights', 'regulation', 'EC', 'EU'],
    negationPhrases: ['extraordinary circumstances', 'not entitled'],
  },
  {
    clauseType: 'eu_denied_boarding_compensation' as any,
    primaryPhrases: [
      'denied boarding', 'involuntary denied boarding', 'refused boarding',
      'denied boarding compensation', 'boarding refusal', 'overbooking compensation',
      'volunteers', 'denied embarkation',
    ],
    secondaryPhrases: ['compensation', '€250', '€400', '€600', 'relinquish', 'volunteers'],
    contextPhrases: ['passenger', 'flight', 'boarding', 'gate', 'overbooked', 'regulation'],
    negationPhrases: [],
  },
  {
    clauseType: 'eu_care_obligation' as any,
    primaryPhrases: [
      'right to care', 'meals and refreshments', 'hotel accommodation',
      'transport between', 'offered free of charge', 'care and assistance',
      'duty of care', 'assistance to passengers',
    ],
    secondaryPhrases: ['meals', 'refreshments', 'hotel', 'accommodation', 'telephone', 'communication', 'transport'],
    contextPhrases: ['delay', 'cancellation', 'waiting', 'overnight', 'airport', 'passenger'],
    negationPhrases: [],
  },
  {
    clauseType: 'eu_rerouting_obligation' as any,
    primaryPhrases: [
      'rerouting', 're-routing', 'alternative transport', 'earliest opportunity',
      'rebooking', 'alternative flight', 'at a later date', 'final destination',
    ],
    secondaryPhrases: ['comparable transport', 'earliest', 'convenience', 'final destination', 'subject to availability'],
    contextPhrases: ['cancellation', 'delay', 'denied boarding', 'passenger', 'flight'],
    negationPhrases: [],
  },
  {
    clauseType: 'eu_refund_deadline' as any,
    primaryPhrases: [
      'refund within', 'reimbursement within', 'seven days', '7 days',
      'reimbursed within', 'right to reimbursement', 'full reimbursement',
      'ticket price refunded', 'refund of the ticket',
    ],
    secondaryPhrases: ['seven', '7', 'days', 'full cost', 'ticket price', 'cash', 'bank transfer'],
    contextPhrases: ['cancellation', 'refund', 'reimbursement', 'passenger', 'flight', 'unused'],
    negationPhrases: [],
  },
  {
    clauseType: 'eu_cancellation_compensation' as any,
    primaryPhrases: [
      'cancellation compensation', 'cancelled flight compensation', 'flight cancellation',
      'compensation unless', 'extraordinary circumstances', 'informed of cancellation',
      'right to compensation for cancellation', 'compensation for cancelled',
    ],
    secondaryPhrases: ['€250', '€400', '€600', '14 days', 'two weeks', 'extraordinary', 'informed'],
    contextPhrases: ['cancellation', 'cancelled', 'flight', 'passenger', 'advance', 'notice'],
    negationPhrases: ['extraordinary circumstances'],
  },
];

export function getAllEuPassengerRightsClusters(): PhraseCluster[] {
  return EU_PASSENGER_RIGHTS_CLUSTERS;
}
