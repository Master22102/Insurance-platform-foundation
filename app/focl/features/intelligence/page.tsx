'use client';

import { useMemo, useState } from 'react';
import { RefreshCw, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureIntelligence } from './hooks';
import { FeatureRow } from './FeatureRow';
import { FilterBar } from './FilterBar';
import type { FilterState } from './FilterBar';
import type { ActivationStatus, FeaturePhase } from './types';

const DEFAULT_FILTERS: FilterState = {
  phase: 'all',
  status: 'all',
  search: '',
  onlyPendingExtension: false,
};

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4">
      <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-semibold text-neutral-800 leading-none">{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function FeatureIntelligencePage() {
  const { rows, loading, error, refresh, toggleFeature, setRolloutPercentage } = useFeatureIntelligence();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filters.phase !== 'all' && row.registry.phase !== filters.phase) return false;
      if (filters.status !== 'all' && row.derivedStatus !== filters.status) return false;
      if (filters.onlyPendingExtension && !row.registry.has_pending_extension) return false;
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        if (
          !row.registry.feature_id.toLowerCase().includes(q) &&
          !row.registry.display_name.toLowerCase().includes(q) &&
          !row.registry.description.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const summary = useMemo(() => {
    const live = rows.filter((r) => r.derivedStatus === 'LIVE').length;
    const degraded = rows.filter((r) => r.derivedStatus === 'DEGRADED' || r.derivedStatus === 'ROLLED_BACK').length;
    const pendingExt = rows.filter((r) => r.registry.has_pending_extension).length;
    const issues = rows.reduce((acc, r) => acc + r.pendingIssueCount, 0);
    return { live, degraded, pendingExt, issues, total: rows.length };
  }, [rows]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-neutral-800 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900 leading-tight">Feature Intelligence</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                FOCL Founder-Only Surface &mdash; F-6.5.16
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total features" value={summary.total} />
            <SummaryCard label="Live" value={summary.live} sub={`${Math.round((summary.live / Math.max(summary.total, 1)) * 100)}% of registry`} />
            <SummaryCard label="Degraded / rolled back" value={summary.degraded} />
            <SummaryCard label="Pending extensions" value={summary.pendingExt} sub={`${summary.issues} open issues`} />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            We could not load feature controls right now. Please refresh and try again.
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Main panel */}
        {!loading && !error && (
          <div className="space-y-4">
            {/* Column header */}
            <div className="hidden lg:flex items-center gap-4 px-5 text-xs text-neutral-400 uppercase tracking-wide">
              <div className="w-4" />
              <div className="flex-1">Feature</div>
              <div className="w-20 hidden sm:block">Phase</div>
              <div className="w-20 hidden md:block text-right">Tier</div>
              <div className="w-28 text-right">Status</div>
              <div className="w-16 text-right">Rollout</div>
              <div className="w-24 text-right">Health</div>
              <div className="w-16 text-right">Issues</div>
            </div>

            <FilterBar
              filters={filters}
              onChange={setFilters}
              totalCount={rows.length}
              visibleCount={filtered.length}
            />

            {filtered.length === 0 && (
              <div className="text-center py-16 text-neutral-400 text-sm">
                No features match the current filters.
              </div>
            )}

            <div className="space-y-2">
              {filtered.map((row) => (
                <FeatureRow
                  key={row.registry.feature_id}
                  row={row}
                  onToggle={toggleFeature}
                  onSetRollout={setRolloutPercentage}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
