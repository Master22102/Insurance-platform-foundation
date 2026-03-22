/** F-6.5.2 — factual display labels for internal benefit_type keys. */
export const BENEFIT_TYPE_LABELS: Record<string, string> = {
  trip_cancellation: 'Trip cancellation',
  trip_delay: 'Trip delay',
  travel_delay: 'Trip delay',
  medical_emergency: 'Medical emergency',
  medical_expense: 'Medical emergency',
  baggage_loss: 'Baggage loss',
  baggage_delay: 'Baggage delay',
  baggage_protection: 'Baggage',
  missed_connection: 'Missed connection',
  emergency_evacuation: 'Emergency evacuation',
  trip_interruption: 'Trip interruption',
  rental_car: 'Rental car coverage',
  personal_liability: 'Personal liability',
};

export function benefitTypeDisplay(internal: string): string {
  if (!internal) return 'Coverage';
  const mapped = BENEFIT_TYPE_LABELS[internal];
  if (mapped) return mapped;
  return internal
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}
