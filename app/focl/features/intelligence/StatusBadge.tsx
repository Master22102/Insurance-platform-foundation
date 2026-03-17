'use client';

import type { ActivationStatus, HealthStatus } from './types';

const STATUS_CONFIG: Record<ActivationStatus, { label: string; dot: string; text: string }> = {
  LIVE:        { label: 'LIVE',        dot: 'bg-emerald-500',   text: 'text-emerald-700' },
  PARTIAL:     { label: 'PARTIAL',     dot: 'bg-amber-400',     text: 'text-amber-700'   },
  DISABLED:    { label: 'DISABLED',    dot: 'bg-neutral-400',   text: 'text-neutral-500' },
  SUPPRESSED:  { label: 'SUPPRESSED',  dot: 'bg-neutral-400',   text: 'text-neutral-500' },
  DEGRADED:    { label: 'DEGRADED',    dot: 'bg-amber-500',     text: 'text-amber-700'   },
  ROLLED_BACK: { label: 'ROLLED BACK', dot: 'bg-red-500',       text: 'text-red-700'     },
};

const HEALTH_CONFIG: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  HEALTHY:   { label: 'HEALTHY',   dot: 'bg-emerald-500', text: 'text-emerald-700' },
  DEGRADED:  { label: 'DEGRADED',  dot: 'bg-amber-500',   text: 'text-amber-700'   },
  UNHEALTHY: { label: 'UNHEALTHY', dot: 'bg-red-500',      text: 'text-red-700'     },
};

export function ActivationBadge({ status }: { status: ActivationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-medium tracking-wide ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  const cfg = HEALTH_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-medium tracking-wide ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

const PHASE_CONFIG = {
  MVP:         { label: 'MVP',      bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Phase2:      { label: 'Phase 2',  bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  Phase2Plus:  { label: 'Phase 2+', bg: 'bg-neutral-100',text: 'text-neutral-500', border: 'border-neutral-200' },
};

export function PhaseBadge({ phase }: { phase: 'MVP' | 'Phase2' | 'Phase2Plus' }) {
  const cfg = PHASE_CONFIG[phase];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

export function ConnectorBadge({ status }: { status: string }) {
  if (status === 'not_required') return null;
  const map: Record<string, { label: string; color: string }> = {
    required_unlicensed:      { label: 'Connector needed',      color: 'text-amber-600' },
    licensed_not_integrated:  { label: 'Licensed, not active',  color: 'text-sky-600'   },
    active:                   { label: 'Connector active',      color: 'text-emerald-600' },
  };
  const cfg = map[status] ?? { label: status, color: 'text-neutral-500' };
  return <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>;
}
