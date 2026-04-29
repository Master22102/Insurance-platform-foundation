export type ContextState =
  | 'active_disruption'
  | 'departure_imminent'
  | 'filing_deadline'
  | 'evidence_needed'
  | 'pre_trip'
  | 'new_country'
  | 'quiet_day'
  | 'defer_protect';

export interface ContextAction {
  id: string;
  label: string;
  type: 'navigate' | 'create_incident' | 'external_link' | 'dismiss';
  href?: string;
  icon?: 'download' | 'shield' | 'camera' | 'phone' | 'clock' | 'check' | 'alert';
  variant?: 'primary' | 'secondary' | 'warning';
}

export interface ContextResult {
  state: ContextState;
  headline: string;
  subheadline?: string;
  urgency: 'calm' | 'attention' | 'urgent';
  actions: ContextAction[];
  metadata: Record<string, unknown>;
  dismissible: boolean;
  dismissKey?: string;
}

export interface ContextInputs {
  trip: {
    trip_id: string;
    trip_name: string;
    maturity_state: string;
    departure_date: string | null;
    return_date: string | null;
    destination_summary: string | null;
    paid_unlock: boolean;
  };
  routeSegments: Array<{
    segment_id: string;
    origin: string;
    destination: string;
    carrier?: string | null;
    flight_number?: string | null;
    reference?: string | null;
    notes?: string | null;
    depart_at: string | null;
    arrive_at: string | null;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    status?: string;
    canonical_status?: string;
    disruption_type?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at: string;
  }>;
  evidence: Array<{
    id: string;
    incident_id: string;
    evidence_category?: string;
    metadata?: Record<string, unknown> | null;
    created_at: string;
  }>;
  claims: Array<{
    claim_id: string;
    incident_id: string;
    claim_status: string;
    created_at: string;
    policy_label?: string | null;
  }>;
  carrierResponses: Array<{
    response_id: string;
    incident_id: string;
    action_type: string;
  }>;
  coverageSummaries: Array<{
    benefit_type: string;
    combined_limit: number | null;
    shortest_waiting_period_hours: number | null;
  }>;
  dismissedContextKeys: string[];
  /** Deep scan / job snapshot text if present */
  weatherSummary?: string | null;
  now?: Date;
  /** User profile slice for signal-driven context (e.g. pet_travel on signal_profile) */
  profile?: {
    preferences?: Record<string, unknown>;
    nationality?: string;
    residence_country?: string;
  };
}

export type ContextualIntelligencePrefs = {
  enabled: boolean;
  preparation_prompts: boolean;
  evidence_suggestions: boolean;
  disruption_guidance: boolean;
  filing_deadline_warnings: boolean;
};

export const DEFAULT_CONTEXTUAL_INTELLIGENCE_PREFS: ContextualIntelligencePrefs = {
  enabled: true,
  preparation_prompts: true,
  evidence_suggestions: true,
  disruption_guidance: true,
  filing_deadline_warnings: true,
};
