export type FeaturePhase = 'MVP' | 'Phase2' | 'Phase2Plus';
export type ConnectorStatus = 'not_required' | 'required_unlicensed' | 'licensed_not_integrated' | 'active';
export type ActivationStatus = 'LIVE' | 'PARTIAL' | 'DISABLED' | 'SUPPRESSED' | 'DEGRADED' | 'ROLLED_BACK';
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface FeatureRegistryRow {
  feature_id: string;
  display_name: string;
  description: string;
  default_enabled: boolean;
  minimum_mode: string;
  phase: FeaturePhase;
  capability_tier_current: number;
  capability_tier_max: number;
  has_pending_extension: boolean;
  parent_feature_id: string | null;
  requires_connector: string | null;
  connector_status: ConnectorStatus;
  created_at: string;
}

export interface FeatureActivationStateRow {
  id: string;
  feature_id: string;
  region_id: string;
  enabled: boolean;
  activated_by: string | null;
  reason_code: string | null;
  metadata: Record<string, unknown>;
  rollout_percentage: number | null;
  rollout_strategy: string | null;
  rollout_scope_type: string | null;
  canary_only: boolean | null;
  enabled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureRolloutHealthStateRow {
  id: string;
  feature_id: string;
  region_id: string;
  window_minutes: number;
  last_evaluated_at: string;
  metrics: Record<string, unknown>;
  health_status: HealthStatus;
  last_rollback_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureIntelligenceRow {
  registry: FeatureRegistryRow;
  activation: FeatureActivationStateRow | null;
  health: FeatureRolloutHealthStateRow | null;
  subCapabilities: FeatureRegistryRow[];
  derivedStatus: ActivationStatus;
  pendingIssueCount: number;
}
