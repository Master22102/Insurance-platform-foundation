export type ScanTier = 'quick' | 'deep';

export type IntelligenceAxis =
  | 'transit_reliability'
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

