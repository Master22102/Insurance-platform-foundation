import { supabase } from '@/lib/auth/supabase-client';

export type MinimumMode = 'NORMAL' | 'ELEVATED' | 'PROTECTIVE' | 'RECOVERY';
export type Phase = 'MVP' | 'Phase2' | 'Phase2Plus';
export type ConnectorStatus =
  | 'not_required'
  | 'required_unlicensed'
  | 'licensed_not_integrated'
  | 'active';

export interface RegisterFeatureInput {
  featureId: string;
  displayName: string;
  description: string;
  defaultEnabled: boolean;
  minimumMode: MinimumMode;
  phase: Phase;
  capabilityTierCurrent: number;
  capabilityTierMax: number;
  connectorStatus: ConnectorStatus;
  eventTypes?: string[];
}

/**
 * Invokes the FOCL registration checkpoint RPC. Caller must be a founder.
 * Throws if any declared event type is not yet in event_type_registry.
 */
export async function registerFeatureWithCheckpoints(
  input: RegisterFeatureInput,
): Promise<void> {
  const { error } = await supabase.rpc('register_feature_with_checkpoints', {
    p_feature_id: input.featureId,
    p_display_name: input.displayName,
    p_description: input.description,
    p_default_enabled: input.defaultEnabled,
    p_minimum_mode: input.minimumMode,
    p_phase: input.phase,
    p_capability_tier_current: input.capabilityTierCurrent,
    p_capability_tier_max: input.capabilityTierMax,
    p_connector_status: input.connectorStatus,
    p_event_types: input.eventTypes ?? [],
  });

  if (error) throw error;
}

export async function recordFounderAction(
  actionType: string,
  target: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('record_founder_action', {
    p_action_type: actionType,
    p_target: target,
    p_metadata: metadata,
  });
  if (error) throw error;
}
