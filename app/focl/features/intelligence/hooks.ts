'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/auth/supabase-client';
import type {
  FeatureRegistryRow,
  FeatureActivationStateRow,
  FeatureRolloutHealthStateRow,
  FeatureIntelligenceRow,
  ActivationStatus,
} from './types';

const DEFAULT_REGION = '00000000-0000-0000-0000-000000000000';

function deriveStatus(
  registry: FeatureRegistryRow,
  activation: FeatureActivationStateRow | null,
  health: FeatureRolloutHealthStateRow | null,
): ActivationStatus {
  const enabled = activation ? activation.enabled : registry.default_enabled;

  if (!enabled) return 'DISABLED';

  if (health) {
    if (health.health_status === 'UNHEALTHY') return 'ROLLED_BACK';
    if (health.health_status === 'DEGRADED') return 'DEGRADED';
  }

  const pct = activation?.rollout_percentage;
  if (pct != null && pct < 100) return 'PARTIAL';

  return 'LIVE';
}

function countPendingIssues(health: FeatureRolloutHealthStateRow | null): number {
  if (!health) return 0;
  const m = health.metrics as Record<string, number>;
  return (m.inbox_open_count ?? 0) + (m.battery_warning_count ?? 0);
}

export function useFeatureIntelligence() {
  const [rows, setRows] = useState<FeatureIntelligenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [regRes, actRes, healthRes] = await Promise.all([
      supabase
        .from('feature_registry')
        .select('*')
        .order('feature_id', { ascending: true }),
      supabase
        .from('feature_activation_state')
        .select('*')
        .eq('region_id', DEFAULT_REGION),
      supabase
        .from('feature_rollout_health_state')
        .select('*')
        .eq('region_id', DEFAULT_REGION),
    ]);

    if (regRes.error) { setError(regRes.error.message); setLoading(false); return; }
    if (actRes.error) { setError(actRes.error.message); setLoading(false); return; }
    if (healthRes.error) { setError(healthRes.error.message); setLoading(false); return; }

    const registry = (regRes.data ?? []) as FeatureRegistryRow[];
    const activation = (actRes.data ?? []) as FeatureActivationStateRow[];
    const health = (healthRes.data ?? []) as FeatureRolloutHealthStateRow[];

    const actMap = new Map(activation.map((a) => [a.feature_id, a]));
    const healthMap = new Map(health.map((h) => [h.feature_id, h]));

    const topLevel = registry.filter((r) => r.parent_feature_id === null);
    const subMap = new Map<string, FeatureRegistryRow[]>();
    for (const r of registry) {
      if (r.parent_feature_id) {
        const arr = subMap.get(r.parent_feature_id) ?? [];
        arr.push(r);
        subMap.set(r.parent_feature_id, arr);
      }
    }

    const result: FeatureIntelligenceRow[] = topLevel.map((reg) => {
      const act = actMap.get(reg.feature_id) ?? null;
      const h = healthMap.get(reg.feature_id) ?? null;
      return {
        registry: reg,
        activation: act,
        health: h,
        subCapabilities: subMap.get(reg.feature_id) ?? [],
        derivedStatus: deriveStatus(reg, act, h),
        pendingIssueCount: countPendingIssues(h),
      };
    });

    setRows(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFeature = useCallback(async (featureId: string, enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.rpc('set_feature_activation_state', {
      p_feature_id: featureId,
      p_region_id: DEFAULT_REGION,
      p_enabled: enabled,
      p_reason_code: enabled ? 'feature_activated_ok' : 'feature_deactivated_ok',
      p_actor_id: user?.id ?? null,
    });
    await load();
  }, [load]);

  const setRolloutPercentage = useCallback(async (featureId: string, percentage: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.rpc('set_feature_rollout_percentage', {
      p_feature_id: featureId,
      p_region_id: DEFAULT_REGION,
      p_percentage: percentage,
      p_actor_id: user?.id ?? null,
      p_reason_code: 'rollout_percentage_increased',
    });
    await load();
  }, [load]);

  return { rows, loading, error, refresh: load, toggleFeature, setRolloutPercentage };
}
