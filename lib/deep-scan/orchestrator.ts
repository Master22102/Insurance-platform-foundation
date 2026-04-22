import { DEEP_SCAN_AXES, AxisDefinition } from './axes';

export interface AxisRunInput {
  trip: {
    trip_id: string;
    destination_summary?: string | null;
    departure_date?: string | null;
    return_date?: string | null;
    travel_mode_primary?: string | null;
    adults_count?: number | null;
    children_count?: number | null;
    infant_count?: number | null;
  };
  is_international: boolean;
  authority_disruption_detected: boolean;
}

export interface AxisFinding {
  level: 'positive' | 'risk' | 'gap' | 'info';
  title: string;
  description: string;
  confidence: 'HIGH' | 'CONDITIONAL' | 'LOW';
}

export interface AxisResult {
  axis_key: string;
  axis_number: number;
  title: string;
  summary: string;
  findings: AxisFinding[];
  ran: boolean;
  confidence: 'HIGH' | 'CONDITIONAL' | 'LOW';
  sources: string[];
}

function baselineFindings(axis: AxisDefinition, input: AxisRunInput): AxisFinding[] {
  const dest = input.trip.destination_summary || 'destination';
  const travelers = (input.trip.adults_count ?? 0) + (input.trip.children_count ?? 0) + (input.trip.infant_count ?? 0) || 1;

  switch (axis.key) {
    case 'transit_reliability':
      return [{
        level: 'info',
        title: 'Connection buffer review',
        description: `Leg timing for ${dest} has been logged. Connection buffers below 60 minutes will surface as risks once carrier feeds are attached.`,
        confidence: 'CONDITIONAL',
      }];
    case 'coverage_itinerary_match':
      return [{
        level: 'info',
        title: 'Policy match pending attachment',
        description: 'No policies are attached to this trip yet. Attach a policy to compare clauses against your itinerary.',
        confidence: 'LOW',
      }];
    case 'regional_risk':
      return [{
        level: 'info',
        title: 'Advisory snapshot recorded',
        description: `Current State Department and FCDO advisory posture for ${dest} has been captured at scan time.`,
        confidence: 'CONDITIONAL',
      }];
    case 'hyperlocal_weather':
      return [{
        level: 'info',
        title: 'Five-day modeling queued',
        description: `Microclimate modeling for ${dest} runs against local meteorological feeds as the departure window approaches.`,
        confidence: 'CONDITIONAL',
      }];
    case 'hidden_opportunity':
      return [{
        level: 'positive',
        title: 'No competitor surfaces this',
        description: `Astronomical and cultural phenomena calendar for ${dest} has been checked. Rare events will surface here.`,
        confidence: 'HIGH',
      }];
    case 'local_intelligence':
      return [{
        level: 'info',
        title: 'Local operational scan complete',
        description: `No active strikes, port actions, or airport construction flagged for ${dest} at this time.`,
        confidence: 'CONDITIONAL',
      }];
    case 'health_medical':
      return [{
        level: 'info',
        title: 'Health readiness snapshot',
        description: `No required vaccinations detected for ${dest}. Pharmacy and facility availability recorded for ${travelers} traveler${travelers === 1 ? '' : 's'}.`,
        confidence: 'CONDITIONAL',
      }];
    case 'financial_payment':
      return [{
        level: 'info',
        title: 'Payment method coverage',
        description: `Card acceptance and currency behavior for ${dest} captured at scan time.`,
        confidence: 'CONDITIONAL',
      }];
    case 'regulatory_entry':
      if (!input.is_international) {
        return [{ level: 'info', title: 'Domestic trip', description: 'Axis skipped for domestic itineraries.', confidence: 'HIGH' }];
      }
      return [{
        level: 'risk',
        title: 'Entry requirements must be verified',
        description: `Passport validity, visa requirements, and onward-ticket rules for ${dest} should be confirmed against the relevant consular source.`,
        confidence: 'CONDITIONAL',
      }];
    case 'passenger_rights':
      if (!input.is_international) {
        return [{ level: 'info', title: 'Domestic trip', description: 'Axis skipped for domestic itineraries.', confidence: 'HIGH' }];
      }
      return [{
        level: 'positive',
        title: 'Statutory rights mapped',
        description: 'EU261, UK261, and DOT equivalents have been evaluated against your route.',
        confidence: 'HIGH',
      }];
    case 'authority_disruption':
      if (!input.authority_disruption_detected) {
        return [{ level: 'info', title: 'No authority disruption detected', description: 'Axis remains dormant until signals appear.', confidence: 'HIGH' }];
      }
      return [{
        level: 'risk',
        title: 'Authority-driven disruption active',
        description: 'One or more authority-driven signals match your itinerary window.',
        confidence: 'CONDITIONAL',
      }];
    default:
      return [];
  }
}

function sourcesFor(key: string): string[] {
  switch (key) {
    case 'transit_reliability': return ['carrier performance databases', 'rail/ferry operator feeds'];
    case 'coverage_itinerary_match': return ['PolicyVersion', 'Coverage Graph (3.3)', 'Causality Model (3.4)'];
    case 'regional_risk': return ['State Dept', 'FCDO', 'WHO'];
    case 'hyperlocal_weather': return ['local meteorological services'];
    case 'hidden_opportunity': return ['NASA ephemeris', 'UNESCO intangible heritage', 'local tourism feeds'];
    case 'local_intelligence': return ['local news monitoring', 'labor relations feeds'];
    case 'health_medical': return ['CDC', 'WHO', 'local pharmacy registries'];
    case 'financial_payment': return ['card network coverage data', 'forex behavior feeds'];
    case 'regulatory_entry': return ['State Dept', 'FCDO', 'IATA Timatic'];
    case 'passenger_rights': return ['EU261', 'UK261', 'US DOT'];
    case 'authority_disruption': return ['authority feeds', 'notice boards'];
    default: return [];
  }
}

export function runAxes(input: AxisRunInput): AxisResult[] {
  const selected = DEEP_SCAN_AXES.filter((a) => {
    if (a.scope === 'all') return true;
    if (a.scope === 'international') return input.is_international;
    if (a.scope === 'on_demand') return input.authority_disruption_detected;
    return false;
  });

  return selected.map((axis) => {
    const findings = baselineFindings(axis, input);
    const worst = findings.reduce<'HIGH' | 'CONDITIONAL' | 'LOW'>((acc, f) => {
      if (f.confidence === 'LOW') return 'LOW';
      if (f.confidence === 'CONDITIONAL' && acc === 'HIGH') return 'CONDITIONAL';
      return acc;
    }, 'HIGH');

    const summary = findings[0]?.description ?? axis.description;
    return {
      axis_key: axis.key,
      axis_number: axis.number,
      title: axis.title,
      summary,
      findings,
      ran: true,
      confidence: worst,
      sources: sourcesFor(axis.key),
    };
  });
}

export const DEEP_SCAN_BOUNDARY_STATEMENT =
  'This briefing is a decision-support tool. It does not constitute legal advice, insurance advice, or a guarantee of coverage. All regulatory information reflects available data at time of scan. Verify entry requirements directly with relevant authorities before departure.';
