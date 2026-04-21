'use client';

import { useState, useRef } from 'react';
import { ChevronRight, ExternalLink, CircleAlert as AlertCircle, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ActivationBadge, HealthBadge, PhaseBadge, ConnectorBadge } from './StatusBadge';
import type { FeatureIntelligenceRow } from './types';

interface Props {
  row: FeatureIntelligenceRow;
  onToggle: (featureId: string, enabled: boolean) => Promise<void>;
  onSetRollout: (featureId: string, pct: number) => Promise<void>;
}

export function FeatureRow({ row, onToggle, onSetRollout }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [rolloutValue, setRolloutValue] = useState<number>(
    row.activation?.rollout_percentage ?? 100,
  );
  const [savingRollout, setSavingRollout] = useState(false);
  const rolloutChanged = useRef(false);

  const { registry: reg, activation: act, health, subCapabilities, derivedStatus, pendingIssueCount } = row;
  const isEnabled = act ? act.enabled : reg.default_enabled;
  const currentPct = act?.rollout_percentage ?? 100;

  async function handleToggle(val: boolean) {
    setToggling(true);
    try {
      await onToggle(reg.feature_id, val);
    } finally {
      setToggling(false);
    }
  }

  async function handleSaveRollout() {
    setSavingRollout(true);
    try {
      await onSetRollout(reg.feature_id, rolloutValue);
      rolloutChanged.current = false;
    } finally {
      setSavingRollout(false);
    }
  }

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      {/* Collapsed row */}
      <button
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />

        {/* Feature ID + name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-neutral-400 select-all">{reg.feature_id}</span>
            {reg.has_pending_extension && (
              <span className="inline-flex items-center gap-1 text-xs text-sky-600 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">
                <Zap className="w-3 h-3" />
                Extension pending
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-neutral-800 mt-0.5 truncate">{reg.display_name}</div>
        </div>

        {/* Phase badge */}
        <div className="hidden sm:block flex-shrink-0">
          <PhaseBadge phase={reg.phase} />
        </div>

        {/* Tier */}
        <div className="hidden md:block flex-shrink-0 text-xs text-neutral-500 w-20 text-right">
          Tier {reg.capability_tier_current} of {reg.capability_tier_max}
        </div>

        {/* Status */}
        <div className="flex-shrink-0 w-28 text-right">
          <ActivationBadge status={derivedStatus} />
        </div>

        {/* Rollout % */}
        <div className="hidden lg:block flex-shrink-0 w-16 text-right text-xs text-neutral-500">
          {currentPct}%
        </div>

        {/* Health */}
        <div className="flex-shrink-0 w-24 text-right">
          {health ? (
            <HealthBadge status={health.health_status} />
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </div>

        {/* Pending issues */}
        <div className="flex-shrink-0 w-16 text-right">
          {pendingIssueCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertCircle className="w-3 h-3" />
              {pendingIssueCount}
            </span>
          ) : (
            <span className="text-xs text-neutral-300">—</span>
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5 space-y-5">
          {/* Description */}
          <p className="text-sm text-neutral-600 leading-relaxed max-w-3xl">{reg.description}</p>

          {/* Connector info */}
          {reg.connector_status !== 'not_required' && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-neutral-400 mt-0.5 w-32 flex-shrink-0">Connector</span>
              <div>
                <div className="text-sm text-neutral-700">{reg.requires_connector ?? '—'}</div>
                <ConnectorBadge status={reg.connector_status} />
              </div>
            </div>
          )}

          {/* Tier + phase detail */}
          <div className="flex flex-wrap gap-6 text-xs text-neutral-500">
            <span><span className="text-neutral-400">Phase</span> <span className="text-neutral-700 font-medium">{reg.phase}</span></span>
            <span><span className="text-neutral-400">Tier</span> <span className="text-neutral-700 font-medium">{reg.capability_tier_current} / {reg.capability_tier_max}</span></span>
            <span><span className="text-neutral-400">Default enabled</span> <span className="text-neutral-700 font-medium">{reg.default_enabled ? 'Yes' : 'No'}</span></span>
            <span><span className="text-neutral-400">Minimum mode</span> <span className="text-neutral-700 font-medium">{reg.minimum_mode}</span></span>
          </div>

          {/* Sub-capabilities */}
          {subCapabilities.length > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Sub-capabilities</div>
              <div className="space-y-2">
                {subCapabilities.map((sub) => (
                  <div
                    key={sub.feature_id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-white border border-neutral-200 rounded-md"
                  >
                    <span className="font-mono text-xs text-neutral-400">{sub.feature_id}</span>
                    <span className="text-sm text-neutral-700 flex-1">{sub.display_name}</span>
                    <PhaseBadge phase={sub.phase} />
                    {sub.connector_status !== 'not_required' && (
                      <ConnectorBadge status={sub.connector_status} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
            {/* Enable / disable toggle */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Activation</div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                />
                <span className="text-sm text-neutral-600">
                  {isEnabled ? 'Enabled' : 'Disabled'}
                  {toggling && <span className="ml-1.5 text-neutral-400">Saving…</span>}
                </span>
              </div>
            </div>

            {/* Rollout percentage */}
            {isEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Rollout</div>
                  <span className="text-xs font-mono text-neutral-700">{rolloutValue}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[rolloutValue]}
                  onValueChange={([v]) => {
                    setRolloutValue(v);
                    rolloutChanged.current = v !== currentPct;
                  }}
                  className="w-full"
                />
                {rolloutChanged.current && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 text-xs"
                    onClick={handleSaveRollout}
                    disabled={savingRollout}
                  >
                    {savingRollout ? 'Saving…' : 'Apply'}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Rollout health screen link */}
          <div className="pt-1 border-t border-neutral-100">
            <a
              href={`/focl/features/${encodeURIComponent(reg.feature_id)}/rollout-health`}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Rollout health screen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
