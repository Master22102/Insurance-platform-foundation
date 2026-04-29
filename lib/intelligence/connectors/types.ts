export type ScanTier = 'quick' | 'deep';

/**
 * Deep Scan connector axes — canonical semantics: `docs/DEEP_SCAN_AXIS_DOCTRINE.md`.
 * **`hidden_opportunity` (Axis 5):** experiential / discovery intelligence (astronomical events,
 * natural phenomena, local cultural events off mainstream packages, season-specific experiences).
 * Do not use this axis for reimbursements, cash benefits, or policy protections — use
 * `coverage_itinerary_match` (Axis 2) and coverage/signal outputs instead.
 */
export type IntelligenceAxis =
  | 'transit_reliability'
  | 'coverage_itinerary_match'
  | 'regional_risk'
  | 'hyperlocal_weather'
  | 'hidden_opportunity'
  | 'local_signals'
  | 'disruption_probability'
  | 'transport_practice'
  | 'cultural_legal'
  | 'financial_currency'
  | 'international_regulatory'
  | 'authority_disruption';

export type ConnectorStatus = 'ok' | 'degraded' | 'unavailable';

export interface ConnectorContext {
  scanTier: ScanTier;
  isInternational: boolean;
  hasAuthoritySignal: boolean;
  tripId?: string;
  itineraryHash?: string;
  locations?: string[];
  /** Onboarding / profile signals (e.g. pet_travel). */
  signal_profile?: Record<string, unknown>;
  /** Route segment destinations for regulatory heuristics. */
  route_segments?: Array<{ destination?: string; origin?: string }>;
  /** Populated after Deep Scan so `coverage_itinerary_match` can summarize server signals. */
  deepScanSnapshot?: {
    policiesAnalyzed?: number;
    signals?: Array<{ type?: string }>;
  };
}

export interface AxisResult {
  axis: IntelligenceAxis;
  status: ConnectorStatus;
  source: string;
  summary: string;
  details?: Record<string, unknown>;
  fetchedAt: string;
}

export interface AxisProvider {
  id: string;
  axis: IntelligenceAxis;
  enabled: boolean;
  fetch(context: ConnectorContext): Promise<AxisResult>;
}

