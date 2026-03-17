'use client';

import type { ActivationStatus, FeaturePhase } from './types';

interface FilterState {
  phase: FeaturePhase | 'all';
  status: ActivationStatus | 'all';
  search: string;
  onlyPendingExtension: boolean;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  visibleCount: number;
}

const PHASES: Array<{ value: FeaturePhase | 'all'; label: string }> = [
  { value: 'all',        label: 'All phases' },
  { value: 'MVP',        label: 'MVP' },
  { value: 'Phase2',     label: 'Phase 2' },
  { value: 'Phase2Plus', label: 'Phase 2+' },
];

const STATUSES: Array<{ value: ActivationStatus | 'all'; label: string }> = [
  { value: 'all',        label: 'All statuses' },
  { value: 'LIVE',       label: 'Live' },
  { value: 'PARTIAL',    label: 'Partial' },
  { value: 'DISABLED',   label: 'Disabled' },
  { value: 'DEGRADED',   label: 'Degraded' },
  { value: 'ROLLED_BACK',label: 'Rolled back' },
];

export function FilterBar({ filters, onChange, totalCount, visibleCount }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Search features…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="h-8 px-3 text-sm border border-neutral-200 rounded-md bg-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 w-52"
      />

      <select
        value={filters.phase}
        onChange={(e) => onChange({ ...filters, phase: e.target.value as FilterState['phase'] })}
        className="h-8 px-2.5 text-sm border border-neutral-200 rounded-md bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        {PHASES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as FilterState['status'] })}
        className="h-8 px-2.5 text-sm border border-neutral-200 rounded-md bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.onlyPendingExtension}
          onChange={(e) => onChange({ ...filters, onlyPendingExtension: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-neutral-300 accent-neutral-700"
        />
        <span className="text-sm text-neutral-600">Pending extension only</span>
      </label>

      <span className="ml-auto text-xs text-neutral-400">
        {visibleCount} of {totalCount}
      </span>
    </div>
  );
}

export type { FilterState };
