export interface AxisDefinition {
  key: string;
  number: number;
  title: string;
  description: string;
  scope: 'all' | 'international' | 'on_demand';
}

export const DEEP_SCAN_AXES: AxisDefinition[] = [
  {
    key: 'transit_reliability',
    number: 1,
    title: 'Transit Reliability',
    description: 'Historical on-time performance for every leg and connection.',
    scope: 'all',
  },
  {
    key: 'coverage_itinerary_match',
    number: 2,
    title: 'Coverage-to-Itinerary Match',
    description: 'Attached policies mapped against your actual activities and routes.',
    scope: 'all',
  },
  {
    key: 'regional_risk',
    number: 3,
    title: 'Regional Risk Intelligence',
    description: 'Crime, civil unrest, and advisory status at destination.',
    scope: 'all',
  },
  {
    key: 'hyperlocal_weather',
    number: 4,
    title: 'Hyperlocal Weather',
    description: 'Microclimate-aware five-day modeling per itinerary stop.',
    scope: 'all',
  },
  {
    key: 'hidden_opportunity',
    number: 5,
    title: 'Hidden Opportunity Intelligence',
    description: 'Astronomical events, natural phenomena, and season-specific experiences.',
    scope: 'all',
  },
  {
    key: 'local_intelligence',
    number: 6,
    title: 'Local Intelligence Signals',
    description: 'Strikes, construction, and local closures that catch travelers off guard.',
    scope: 'all',
  },
  {
    key: 'health_medical',
    number: 7,
    title: 'Health & Medical Readiness',
    description: 'Required vaccinations, medical facility access, and pharmacy availability.',
    scope: 'all',
  },
  {
    key: 'financial_payment',
    number: 8,
    title: 'Financial & Payment',
    description: 'Card acceptance, currency behavior, and payment method coverage.',
    scope: 'all',
  },
  {
    key: 'regulatory_entry',
    number: 9,
    title: 'Regulatory & Entry Requirements',
    description: 'Visa, documentation, and border requirements for your nationality mix.',
    scope: 'international',
  },
  {
    key: 'passenger_rights',
    number: 10,
    title: 'Passenger Rights Posture',
    description: 'Statutory rights available under your itinerary\'s jurisdictions.',
    scope: 'international',
  },
  {
    key: 'authority_disruption',
    number: 11,
    title: 'Authority-Driven Disruption',
    description: 'On-demand activation when authority-driven disruption signals are detected.',
    scope: 'on_demand',
  },
];

export function axesForTrip(trip: { is_international?: boolean | null; disruption_detected?: boolean | null }): AxisDefinition[] {
  return DEEP_SCAN_AXES.filter((a) => {
    if (a.scope === 'all') return true;
    if (a.scope === 'international') return !!trip.is_international;
    if (a.scope === 'on_demand') return !!trip.disruption_detected;
    return false;
  });
}
